#!/usr/bin/env node
/** Browser checks for the lightweight landing-page core. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRenderedFonts } from './rendered_fonts.mjs';

const VERSION = '1.5.0';
const argv = process.argv.slice(2);
const option = (name, fallback = '') => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`--${name} requires a value`);
  return argv[index + 1];
};

if (!argv.length || argv.includes('--help')) {
  console.log('node measure_page.mjs <url> --out <project>/build/browser-review.json [--project-root <project>] [--brand-report <source-brand.json>] [--thank-you /thank-you.html] [--playwright-module /path/to/playwright/index.mjs] [--browser-executable /path/to/chromium]');
  process.exit(0);
}

const url = new URL(argv[0]);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use a running HTTP(S) URL');
const root = option('project-root') ? resolve(option('project-root')) : null;
const output = resolve(option('out', root ? `${root}/build/browser-review.json` : 'browser-review.json'));
await mkdir(dirname(output), { recursive: true });
const brandPath = option('brand-report', root ? resolve(root, 'build/brand.json') : '');
let brand = null;
if (brandPath) {
  try { brand = JSON.parse(await readFile(resolve(brandPath), 'utf8')); }
  catch (error) { if (option('brand-report') || error.code !== 'ENOENT') throw error; }
}

const modulePath = option('playwright-module', process.env.PAGE_PLAYWRIGHT_MODULE || '');
let runtime;
if (modulePath) {
  runtime = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
} else {
  const require = createRequire(resolve(root || process.cwd(), 'package.json'));
  try {
    runtime = await import(pathToFileURL(require.resolve('playwright')).href);
  } catch {
    runtime = await import(pathToFileURL(require.resolve('playwright-core')).href);
  }
}
const chromium = runtime.chromium || runtime.default?.chromium;
if (!chromium) throw new Error('Playwright Chromium is unavailable');
const executablePath = option('browser-executable', process.env.PAGE_CHROMIUM || '');
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

const viewports = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1024, height: 800, label: 'laptop' },
  { width: 1280, height: 600, label: 'short-laptop' },
  { width: 1440, height: 900, label: 'desktop' },
];
const report = {
  schema_version: 1,
  gate: 'browser-page',
  status: 'blocked',
  executed_at: new Date().toISOString(),
  tool: { name: 'measure_page', version: VERSION },
  target: { url: url.href },
  viewports: [],
  artifacts: [],
  checks: [],
  failures: [],
  warnings: [],
  typographyComparison: [],
  limits: [
    'Measurements do not replace visual review of the screenshot pixels.',
    'The run does not submit forms or prove a live backend destination.',
    'Automated overlap checks cannot identify every face or focal subject.',
  ],
};

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidencePath = (path) => root ? relative(root, path).split('\\').join('/') : path;
const addShot = async (page, name, fullPage = true) => {
  const path = resolve(dirname(output), 'screenshots', `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage, animations: 'disabled' });
  report.artifacts.push({ path: evidencePath(path), type: 'screenshot', sha256: digest(await readFile(path)) });
  return evidencePath(path);
};
const check = (name, passed, detail, context = {}) => {
  report.checks.push({ name, status: passed ? 'pass' : 'blocked', detail, ...context });
  if (!passed) report.failures.push(`${name}: ${detail}`);
};
const warn = (message) => {
  if (!report.warnings.includes(message)) report.warnings.push(message);
};

async function settle(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    await Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 5000))]);
    const stop = Math.min(document.documentElement.scrollHeight, 30000);
    for (let y = 0; y < stop; y += Math.max(320, innerHeight * 0.75)) {
      scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 50));
    }
    await Promise.race([
      Promise.all([...document.images].map((image) => image.decode().catch(() => {}))),
      new Promise((done) => setTimeout(done, 5000)),
    ]);
    scrollTo(0, 0);
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const describe = (element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const classes = [...element.classList].slice(0, 2).map((name) => `.${CSS.escape(name)}`).join('');
      return `${element.tagName.toLowerCase()}${classes}`;
    };
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (a, b) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return width * height;
    };
    const unobscured = (element) => {
      const box = element.getBoundingClientRect();
      if (box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth) return false;
      const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, box.top + box.height / 2));
      const top = document.elementFromPoint(x, y);
      return Boolean(top && (top === element || element.contains(top)));
    };

    const all = [...document.querySelectorAll('body *')];
    const images = [...document.images].filter(visible).map((image) => {
      const box = rect(image);
      const style = getComputedStyle(image);
      const naturalRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
      const renderedRatio = box.width / Math.max(1, box.height);
      const crop = style.objectFit === 'cover' ? 1 - Math.min(naturalRatio / renderedRatio, renderedRatio / naturalRatio) : 0;
      return {
        selector: describe(image),
        src: image.currentSrc || image.src,
        loaded: image.complete && image.naturalWidth > 0,
        role: image.dataset.imageRole || '',
        contentBearing: image.dataset.contentBearing === 'true',
        objectFit: style.objectFit,
        cropFraction: crop,
        box,
      };
    });

    const primarySelector = '[data-primary-action], [data-open-modal], .cta-primary, .primary-cta';
    let primaryElements = [...document.querySelectorAll(primarySelector)].filter(visible);
    if (!primaryElements.length) {
      primaryElements = [...document.querySelectorAll('a[href^="tel:"], form button[type="submit"]')].filter(visible).slice(0, 1);
    }
    const primary = primaryElements.map((element) => ({ selector: describe(element), text: element.textContent.trim(), box: rect(element), unobscured: unobscured(element) }));

    const hero = document.querySelector('h1')?.closest('[data-hero], .hero, section');
    let following = hero?.nextElementSibling;
    while (following && !visible(following)) following = following.nextElementSibling;
    const heroContinuation = hero && following ? {
      hero: describe(hero),
      following: describe(following),
      nextTop: rect(following).top,
      visiblePixels: Math.max(0, Math.min(innerHeight, rect(following).bottom) - Math.max(0, rect(following).top)),
      viewportHeight: innerHeight,
    } : null;

    const overflow = all.filter(visible).filter((element) => {
      const box = element.getBoundingClientRect();
      if (box.left >= -1 && box.right <= innerWidth + 1) return false;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) return false;
      }
      return true;
    }).slice(0, 20).map((element) => ({ selector: describe(element), box: rect(element) }));

    const critical = [...document.querySelectorAll('h1, [data-primary-action], [data-open-modal], form button[type="submit"], [data-submit], footer a')].filter(visible);
    const overlays = all.filter(visible).filter((element) => {
      const identity = `${element.id} ${element.className || ''} ${element.getAttribute('aria-label') || ''}`.toLowerCase();
      const position = getComputedStyle(element).position;
      return (identity.includes('consent') || identity.includes('cookie') || identity.includes('chat')) && ['fixed', 'sticky'].includes(position);
    });
    const overlayConflicts = [];
    for (const overlay of overlays) {
      const overlayBox = rect(overlay);
      for (const element of critical) {
        if (overlay === element || overlay.contains(element) || element.contains(overlay)) continue;
        if (overlap(overlayBox, rect(element)) > 4) overlayConflicts.push({ overlay: describe(overlay), target: describe(element) });
      }
    }

    const contentCollisions = [];
    for (const image of [...document.images].filter((item) => visible(item) && item.dataset.contentBearing === 'true')) {
      const imageBox = rect(image);
      const candidates = [...document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,label')].filter(visible);
      for (const element of candidates) {
        if (!element.textContent.trim() || element.contains(image) || image.contains(element)) continue;
        if (overlap(imageBox, rect(element)) > 16) contentCollisions.push({ image: describe(image), text: describe(element) });
      }
    }

    // Text ranges exclude padding so positioned labels cannot silently paint over prose.
    const textNodes = [...document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,label,small')]
      .filter((element) => visible(element) && element.textContent.trim() && !element.closest('[aria-hidden="true"]'));
    const textRects = (element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const boxes = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        boxes.push(...range.getClientRects());
      }
      return boxes;
    };
    const positionedTextCollisions = [];
    const compared = new Set();
    for (const element of textNodes.filter((item) => getComputedStyle(item).position === 'absolute')) {
      for (const other of textNodes) {
        if (element === other || element.contains(other) || other.contains(element)) continue;
        const key = [textNodes.indexOf(element), textNodes.indexOf(other)].sort((a, b) => a - b).join(':');
        if (compared.has(key)) continue;
        compared.add(key);
        if (textRects(element).some((a) => textRects(other).some((b) => overlap(a, b) > Math.max(4, Math.min(a.width * a.height, b.width * b.height) * 0.15)))) {
          positionedTextCollisions.push({ positioned: describe(element), other: describe(other), text: element.textContent.trim() });
        }
      }
    }

    const footerLinks = [...document.querySelectorAll('footer a')].filter(visible);
    const footerGapIssues = [];
    for (let index = 0; index < footerLinks.length; index++) {
      for (let other = index + 1; other < footerLinks.length; other++) {
        const a = rect(footerLinks[index]);
        const b = rect(footerLinks[other]);
        const verticalOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (!verticalOverlap) continue;
        const gap = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
        if (gap < 8) footerGapIssues.push({ first: describe(footerLinks[index]), second: describe(footerLinks[other]), gap });
      }
    }

    const smallPrimary = primaryElements.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width < 24 || box.height < 24;
    }).map(describe);
    const smallTargets = [...document.querySelectorAll('button, [role="button"], footer a')].filter(visible).filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width < 24 || box.height < 24;
    }).map(describe);

    const fontEvidence = (element) => element ? {
      selector: describe(element), text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 180),
      fontFamily: getComputedStyle(element).fontFamily,
    } : null;
    const prose = [...document.querySelectorAll('main p,article p,p')].filter(visible)
      .find((element) => element.textContent.trim().length >= 60 && getComputedStyle(element).textTransform !== 'uppercase');
    return {
      typography: { heading: fontEvidence([...document.querySelectorAll('h1')].find(visible)), body: fontEvidence(prose) },
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      h1Count: [...document.querySelectorAll('h1')].filter(visible).length,
      images,
      primary,
      heroContinuation,
      primaryDeclared: [...document.querySelectorAll('[data-primary-action]')].length,
      overflow,
      overlayConflicts,
      contentCollisions,
      positionedTextCollisions,
      footerGapIssues,
      smallPrimary,
      smallTargets,
    };
  });
}

async function inspectTabVisibility(page, dialog) {
  const stops = [];
  const seen = new Set();
  for (let step = 0; step < 80; step += 1) {
    const state = await dialog.evaluate((container) => {
      const element = document.activeElement;
      const contained = container.contains(element);
      const identity = [...document.querySelectorAll('*')].indexOf(element);
      const control = element?.matches('input,select,textarea,button,a[href],[tabindex]') && element !== container;
      if (!contained || !control) return { identity, contained, control };
      let target = element;
      let box = target.getBoundingClientRect();
      // Custom checkboxes may keep the native input visually hidden inside a visible label.
      if ((box.width <= 1 || box.height <= 1) && element.labels?.length) {
        target = element.labels[0];
        box = target.getBoundingClientRect();
      }
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const hit = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null;
      return {
        identity, contained, control,
        selector: element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}[name="${element.getAttribute('name') || ''}"]`,
        unobscured: Boolean(hit && (target === hit || target.contains(hit) || hit.control === element)),
        box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
        hit: hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}${hit.className ? `.${String(hit.className).trim().replace(/\s+/g, '.')}` : ''}` : null,
      };
    });
    if (!state.contained) return { complete: true, escaped: true, stops };
    if (state.control) {
      if (seen.has(state.identity)) return { complete: true, escaped: false, stops };
      seen.add(state.identity);
      stops.push(state);
    }
    await page.keyboard.press('Tab');
    await page.waitForTimeout(40);
  }
  return { complete: false, escaped: false, stops };
}

async function inspectModal(page, viewport, name) {
  const trigger = page.locator('[data-open-modal]:visible').first();
  if (!(await trigger.count())) return { present: false };
  await trigger.focus();
  await trigger.press('Enter');
  await page.waitForTimeout(100);
  const dialog = page.locator('#lead-modal, dialog[open], [role="dialog"]:visible').first();
  const opened = await dialog.count() && await dialog.isVisible();
  check('modal_opens', Boolean(opened), 'Primary modal trigger opens a visible dialog', { viewport });
  if (!opened) return { present: true, opened: false };

  const action = dialog.locator('[data-next]:visible, [data-submit]:visible, button[type="submit"]:visible').last();
  let actionResult = { found: false, visibleInViewport: false, unobscured: false };
  if (await action.count()) {
    actionResult = await action.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const visibleInViewport = box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight && box.right <= innerWidth;
      const top = visibleInViewport ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
      return { found: true, visibleInViewport, unobscured: Boolean(top && (top === element || element.contains(top))), box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right } };
    });
  }
  check('modal_primary_action_visible', actionResult.found && actionResult.visibleInViewport && actionResult.unobscured, JSON.stringify(actionResult), { viewport });

  const screenshot = await addShot(page, `${name}-modal`, false);
  const keyboard = await inspectTabVisibility(page, dialog);
  const obscured = keyboard.stops.filter((stop) => !stop.unobscured);
  check('modal_tab_focus_unobscured', keyboard.complete && !keyboard.escaped && keyboard.stops.length > 0 && obscured.length === 0,
    JSON.stringify({ complete: keyboard.complete, escaped: keyboard.escaped, stopCount: keyboard.stops.length, obscured }), { viewport });

  const focusContained = await page.evaluate(async () => {
    const dialog = [...document.querySelectorAll('#lead-modal, dialog[open], [role="dialog"]')].find((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    });
    if (!dialog) return false;
    const outside = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].find((element) => !dialog.contains(element) && element.getClientRects().length && !element.hasAttribute('disabled'));
    if (!outside) return true;
    outside.focus();
    await new Promise((done) => setTimeout(done, 40));
    return dialog.contains(document.activeElement);
  });
  check('modal_forced_focus_contained', focusContained, 'Programmatic focus cannot remain outside the open dialog', { viewport });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  const closedAndRestored = await page.evaluate(() => {
    const dialog = document.querySelector('#lead-modal, dialog[open], [role="dialog"]');
    const open = dialog && getComputedStyle(dialog).display !== 'none' && dialog.getAttribute('aria-hidden') !== 'true' && (!('open' in dialog) || dialog.open);
    return !open && Boolean(document.activeElement?.matches('[data-open-modal]'));
  });
  check('modal_escape_and_restore', closedAndRestored, 'Escape closes the dialog and restores focus', { viewport });
  return { present: true, opened: true, action: actionResult, focusContained, keyboard, screenshot };
}

try {
  for (const viewport of viewports) {
    const name = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    const consoleErrors = [];
    const networkErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', (response) => { if (response.status() >= 400) networkErrors.push({ url: response.url(), status: response.status() }); });

    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
    await settle(page);
    const metrics = await measure(page);
    const rendered = await readRenderedFonts(page, metrics.typography);
    for (const [role, sample] of Object.entries(metrics.typography)) {
      if (sample) sample.renderedFonts = rendered.fonts[role] || [];
    }
    if (rendered.error) warn(`${name}: rendered-font inspection unavailable: ${rendered.error}`);
    if (brand?.measurements?.length) {
      const source = [...brand.measurements].sort((a, b) => Math.abs(a.viewport.width - viewport.width) - Math.abs(b.viewport.width - viewport.width))[0];
      const expected = {
        heading: source.roles?.hero_heading?.[0],
        body: source.roles?.body?.find((item) => item.text?.length >= 60 && item.textTransform !== 'uppercase'),
      };
      const family = (value) => (value || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
      for (const role of ['heading', 'body']) {
        const observed = metrics.typography[role];
        if (!expected[role]?.fontFamily || !observed?.fontFamily) {
          warn(`${name}: ${role} typography sample unavailable; verify representative rendered elements manually`);
          continue;
        }
        const matches = family(expected[role].fontFamily) === family(observed.fontFamily);
        const expectedFont = expected[role].renderedFonts?.[0]?.familyName;
        const observedFont = observed.renderedFonts?.[0]?.familyName;
        const renderedMatches = expectedFont && observedFont ? family(expectedFont) === family(observedFont) : null;
        report.typographyComparison.push({ viewport, role, source: expected[role], applied: observed, matches, renderedMatches });
        if (!matches) warn(`${name}: ${role} font differs: source ${expected[role].fontFamily}; applied ${observed.fontFamily}. Restore source font or document a permitted substitution with evidence.`);
        if (matches && renderedMatches !== null) {
          check('declared_brand_font_really_renders', renderedMatches,
            `${role}: source renders ${expectedFont}; page renders ${observedFont}`, { viewport });
        } else if (renderedMatches === null) {
          warn(`${name}: ${role} actual font is unverified; capture source and output rendered-font evidence before claiming brand parity`);
        }
      }
    }
    const screenshot = await addShot(page, `${name}-landing`);
    check('horizontal_overflow', metrics.pageWidth <= viewport.width + 1 && metrics.overflow.length === 0, JSON.stringify({ pageWidth: metrics.pageWidth, overflow: metrics.overflow }), { viewport, screenshot });
    check('visible_h1', metrics.h1Count === 1, `Visible H1 count: ${metrics.h1Count}`, { viewport });
    if (metrics.heroContinuation) {
      check('hero_reveals_following_content', metrics.heroContinuation.visiblePixels > 0, JSON.stringify(metrics.heroContinuation), { viewport });
    } else {
      warn(`${name}: hero continuation not identifiable; verify the following content in the first viewport manually`);
    }
    check('images_loaded', metrics.images.every((image) => image.loaded), 'Every rendered image decoded', { viewport });
    check('content_images_not_cover_cropped', metrics.images.filter((image) => image.contentBearing).every((image) => image.objectFit !== 'cover'), JSON.stringify(metrics.images.filter((image) => image.contentBearing && image.objectFit === 'cover')), { viewport });
    check('content_images_have_no_text_collision', metrics.contentCollisions.length === 0, JSON.stringify(metrics.contentCollisions), { viewport });
    check('positioned_text_does_not_overlap_prose', metrics.positionedTextCollisions.length === 0, JSON.stringify(metrics.positionedTextCollisions), { viewport });
    check('fixed_ui_does_not_cover_conversion_content', metrics.overlayConflicts.length === 0, JSON.stringify(metrics.overlayConflicts), { viewport });
    check('footer_links_have_gap', metrics.footerGapIssues.length === 0, JSON.stringify(metrics.footerGapIssues), { viewport });
    check('primary_targets_are_operable', metrics.smallPrimary.length === 0, JSON.stringify(metrics.smallPrimary), { viewport });
    if (!metrics.primaryDeclared) warn(`${name}: add data-primary-action to the main CTA for deterministic review`);
    if (['mobile', 'short-laptop'].includes(viewport.label)) {
      check('primary_action_visible_in_first_view', metrics.primary.some((item) => item.unobscured), JSON.stringify(metrics.primary), { viewport });
    }
    if (metrics.smallTargets.length) warn(`${name}: targets smaller than 24 CSS pixels: ${metrics.smallTargets.join(', ')}`);
    for (const image of metrics.images) {
      if (!image.role) warn(`${name}: unclassified rendered image ${image.selector}`);
      if (!image.contentBearing && image.cropFraction > 0.45) warn(`${name}: aggressive crop at ${image.selector}`);
    }

    const modal = await inspectModal(page, viewport, name);
    check('console_errors', consoleErrors.length === 0, consoleErrors.join('; ') || 'No console errors', { viewport });
    check('network_errors', networkErrors.length === 0, JSON.stringify(networkErrors), { viewport });
    report.viewports.push({ ...viewport, screenshot, metrics, modal, consoleErrors, networkErrors });
    await context.close();
  }

  const thankPath = option('thank-you');
  if (thankPath) {
    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    const thankUrl = new URL(thankPath, url);
    const response = await page.goto(thankUrl.href, { waitUntil: 'networkidle', timeout: 30000 });
    await settle(page);
    const metrics = await measure(page);
    const screenshot = await addShot(page, '390x844-thank-you');
    check('thank_you_loads', Boolean(response?.ok()), `Status ${response?.status()}`, { viewport, screenshot });
    check('thank_you_fits', metrics.pageWidth <= viewport.width + 1, `Page width ${metrics.pageWidth}`, { viewport, screenshot });
    report.thankYou = { url: thankUrl.href, screenshot, metrics };
    await context.close();
  }
} catch (error) {
  report.failures.push(error.stack || error.message);
} finally {
  await browser.close();
}

report.status = report.failures.length ? 'blocked' : report.warnings.length ? 'pass_with_warnings' : 'pass';
report.completed_at = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, report: output, failures: report.failures.length, warnings: report.warnings.length }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
