#!/usr/bin/env node
/** Original browser QA harness. Measurements support, but do not replace, visual review. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const VERSION = '1.0.0';
const argv = process.argv.slice(2);
const option = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`--${name} requires a value`);
  return argv[i + 1];
};
if (!argv.length || argv.includes('--help')) {
  console.log(`node measure_funnel.mjs <url> --out <project>/build/layout-audit.json [--project-root <project>]\n  [--snapshot build/gate-snapshot.json] [--mode preview|handoff|live]\n  [--playwright-module /absolute/path/to/playwright/index.mjs] [--browser-executable /path/to/chromium]\n  [--form-fixture /path/to/local-fixture.json] [--thank-you /thank-you.html]\nAll write requests are blocked. Form fixtures work only on localhost/loopback; no real leads are submitted.`);
  process.exit(0);
}
const started = new Date().toISOString();
const url = new URL(argv[0]);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use a running HTTP(S) server');
const root = option('project-root') ? resolve(option('project-root')) : null;
const output = resolve(option('out', root ? `${root}/build/layout-audit.json` : 'layout-audit.json'));
await mkdir(dirname(output), { recursive: true });
const mode = option('mode', 'preview');
if (!['preview', 'handoff', 'live'].includes(mode)) throw new Error('Invalid mode');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = async (path) => digest(await readFile(path));
let sourceFingerprint = null;
let snapshot = null;
let catalogueRequired = true;
if (root) {
  try { catalogueRequired = JSON.parse(await readFile(resolve(root, 'funnel.json'), 'utf8')).catalogue?.enabled !== false; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const sourceNow = () => {
  const python = option('python', 'python3');
  const here = dirname(fileURLToPath(import.meta.url));
  const result = spawnSync(python, ['-c', 'import sys,json;sys.path.insert(0,sys.argv[1]);from check_gates import source_snapshot;from pathlib import Path;print(json.dumps(source_snapshot(Path(sys.argv[2]))))', here, root], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot fingerprint source: ${result.stderr}`);
  return JSON.parse(result.stdout).source_fingerprint;
};
if (root) {
  snapshot = JSON.parse(await readFile(resolve(root, option('snapshot', 'build/gate-snapshot.json')), 'utf8'));
  sourceFingerprint = sourceNow();
  if (snapshot.source_fingerprint !== sourceFingerprint) throw new Error('Source changed since snapshot; take a new snapshot before browser QA');
  if (snapshot.mode !== mode) throw new Error('Snapshot and browser report mode differ');
  if (!relative(root, output).startsWith(`build/`)) throw new Error('With --project-root, keep reports under build/');
}
const fixturePath = option('form-fixture');
if (fixturePath && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Form fixtures are restricted to loopback URLs');
const fixture = fixturePath ? JSON.parse(await readFile(resolve(fixturePath), 'utf8')) : null;
const modulePath = option('playwright-module', process.env.FUNNEL_PLAYWRIGHT_MODULE || '');
let runtime;
if (modulePath) runtime = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
else {
  const require = createRequire(pathToFileURL(resolve(root || process.cwd(), 'package.json')));
  try { runtime = await import(pathToFileURL(require.resolve('playwright')).href); }
  catch { runtime = await import(pathToFileURL(require.resolve('playwright-core')).href); }
}
const chromium = runtime.chromium || runtime.default?.chromium;
if (!chromium) throw new Error('The selected module does not provide Playwright chromium');
const executablePath = option('browser-executable', process.env.FUNNEL_CHROMIUM || '');
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = { schema_version: 1, gate: 'browser', status: 'blocked', executed_at: started,
  source_fingerprint: sourceFingerprint, tool: { name: 'measure_funnel', version: VERSION, node: process.version, browser: browser.version() },
  target: { mode, url: url.href }, execution: { kind: 'automated', command: process.argv.slice(1), started_at: started, exit_code: null },
  checks: [], viewports: [], artifacts: [], failures: [], warnings: [],
  limits: ['Measurements are not visual/aesthetic approval.', 'All write requests are blocked; this run does not prove live CRM delivery, backend error handling, or conversion persistence.', 'Source fingerprint identifies local input. For remote URLs, deployment evidence must separately tie that input to the running revision.'] };
const evidencePath = (path) => root ? relative(root, path).split('\\').join('/') : path;
const addShot = async (page, name, fullPage = true) => {
  const file = resolve(dirname(output), 'screenshots', `${name}.png`);
  await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage, animations: 'disabled' });
  report.artifacts.push({ path: evidencePath(file), type: 'screenshot', sha256: await hashFile(file) });
  return evidencePath(file);
};
const check = (name, passed, detail, context = {}) => {
  report.checks.push({ name, status: passed ? 'pass' : 'blocked', detail, ...context });
  if (!passed) report.failures.push(`${name}: ${detail}`);
};
const widths = [360, 390, 768, 1024, 1180, 1280, 1440];
const viewports = [...widths.map((width) => ({ width, height: width < 768 ? 844 : width < 1280 ? 800 : 900 })), { width: 1280, height: 600 }, { width: 1440, height: 720 }];

async function settle(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    await Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 6000))]);
    // Exercise actual lazy loading by moving the viewport, rather than changing loading attributes.
    for (let y = 0, stop = Math.min(document.documentElement.scrollHeight, 35000); y < stop; y += Math.max(300, innerHeight * 0.7)) {
      scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 70));
    }
    await Promise.race([Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {}))), new Promise((done) => setTimeout(done, 6000))]);
    scrollTo(0, 0);
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const describe = (el) => el.id ? `#${CSS.escape(el.id)}` : `${el.tagName.toLowerCase()}${[...el.classList].slice(0, 2).map((name) => `.${CSS.escape(name)}`).join('')}`;
    const visible = (el) => { const s = getComputedStyle(el), b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0 && b.width > 0 && b.height > 0; };
    const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const rgba = (color) => { const m = color.match(/^rgba?\(([^)]+)\)/); return m ? m[1].split(',').map(Number) : null; };
    const light = (rgb) => rgb.slice(0, 3).map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
    const headings = [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const lines = new Map();
      while (walker.nextNode()) {
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        for (const r of range.getClientRects()) if (r.height > 2 && r.width > 1) {
          const key = Math.round(r.top / 2) * 2;
          const line = lines.get(key) || { left: r.left, right: r.right };
          line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right); lines.set(key, line);
        }
      }
      const widths = [...lines.values()].map((line) => line.right - line.left);
      const style = getComputedStyle(el), foreground = rgba(style.color);
      let background = null, image = false;
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node); image ||= s.backgroundImage !== 'none';
        const color = rgba(s.backgroundColor);
        if (color && (color.length === 3 || color[3] === 1)) { background = color; break; }
      }
      const ratio = foreground && background && !image ? (Math.max(light(foreground), light(background)) + .05) / (Math.min(light(foreground), light(background)) + .05) : null;
      return { selector: describe(el), text: el.textContent.trim(), box: box(el), lines: widths.length, lineWidths: widths,
        font: style.fontFamily, fontSize: style.fontSize, loadedFont: document.fonts.check(`${style.fontSize} ${style.fontFamily}`), contrastRatioOnSolidBackground: ratio,
        shortLastLine: widths.length >= 3 && widths.at(-1) < Math.max(...widths) / 3 };
    });
    const images = [...document.images].filter(visible).map((el) => {
      const b = el.getBoundingClientRect(), s = getComputedStyle(el);
      const naturalRatio = el.naturalWidth / (el.naturalHeight || 1), renderedRatio = b.width / b.height;
      return { selector: describe(el), src: el.currentSrc || el.src, loaded: el.complete && el.naturalWidth > 0,
        naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, box: box(el), objectFit: s.objectFit, objectPosition: s.objectPosition,
        croppedAreaFraction: s.objectFit === 'cover' ? 1 - Math.min(naturalRatio / renderedRatio, renderedRatio / naturalRatio) : 0 };
    });
    const ctas = [...document.querySelectorAll('[data-open-modal]')].filter(visible).map((el) => {
      const b = el.getBoundingClientRect(), within = b.top >= 0 && b.bottom <= innerHeight;
      const top = within ? document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, b.left + b.width / 2)), b.top + b.height / 2) : null;
      return { selector: describe(el), text: el.textContent.trim(), box: box(el), aboveFold: within, centerUnobscured: Boolean(top && (el === top || el.contains(top))) };
    });
    const overflow = [...document.querySelectorAll('body *')].filter(visible).filter((el) => {
      const b = el.getBoundingClientRect();
      if (b.left >= -1 && b.right <= innerWidth + 1) return false;
      // Children intentionally clipped by a carousel/scroll region are not page overflow.
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) return false;
      }
      return true;
    }).slice(0, 30).map((el) => ({ selector: describe(el), box: box(el), overflowX: getComputedStyle(el).overflowX }));
    return { pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight,
      overflow, headings, images, ctas, fontStatus: document.fonts.status,
      loadedFonts: [...document.fonts].map((font) => ({ family: font.family, style: font.style, weight: font.weight, status: font.status })),
      links: [...document.querySelectorAll('a[href]')].map((a) => ({ text: a.textContent.trim(), href: a.href })) };
  });
}

async function inspectModal(page, viewport, screenshotName) {
  const triggers = page.locator('[data-open-modal]');
  const modal = page.locator('#lead-modal');
  const result = { triggerCount: await triggers.count(), submits: 'not_attempted', trace: [] };
  if (!(await modal.count()) || !result.triggerCount) { check('modal_presence', false, 'Expected #lead-modal and [data-open-modal]', { viewport }); return result; }
  // Every trigger must activate the same modal and restore keyboard focus on Escape.
  for (let i = 0; i < result.triggerCount; i++) {
    const trigger = triggers.nth(i);
    if (!(await trigger.isVisible())) continue;
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    const opened = await modal.isVisible() && (await modal.getAttribute('aria-hidden')) !== 'true';
    check('cta_opens_modal', opened, `Trigger ${i + 1}`, { viewport });
    if (!opened) continue;
    if (i === 0) {
      let escaped = false;
      for (let tab = 0; tab < 18; tab++) {
        await page.keyboard.press(tab < 12 ? 'Tab' : 'Shift+Tab');
        const focus = await page.evaluate(() => ({ inside: Boolean(document.activeElement?.closest('#lead-modal')), tag: document.activeElement?.tagName, name: document.activeElement?.getAttribute('name'), id: document.activeElement?.id }));
        result.trace.push(focus); escaped ||= !focus.inside;
      }
      check('modal_focus_trap', !escaped, '18 forward/reverse Tab presses remain in the modal', { viewport });
      result.screenshot = await addShot(page, `${screenshotName}-modal`, false);
      if (fixture) {
        const next = modal.locator('[data-next]');
        if (await next.isVisible()) {
          const before = await page.evaluate(() => [...document.querySelectorAll('.wizard__step')].findIndex((el) => !el.hidden));
          await next.click();
          const invalid = await modal.locator(':invalid').count();
          const after = await page.evaluate(() => [...document.querySelectorAll('.wizard__step')].findIndex((el) => !el.hidden));
          check('required_field_validation', invalid === 0 || before === after, 'Invalid fields cannot advance the wizard', { viewport });
        }
        for (let step = 0; step < 12; step++) {
          for (const [name, value] of Object.entries(fixture.fields || {})) {
            const fields = modal.locator(`[name=${JSON.stringify(name)}]`);
            for (let j = 0; j < await fields.count(); j++) {
              const field = fields.nth(j);
              if (!(await field.isVisible())) continue;
              const tag = await field.evaluate((el) => el.tagName);
              const type = await field.getAttribute('type');
              if (type === 'checkbox') { if (value) await field.check(); }
              else if (type === 'radio') { if (await field.inputValue() === String(value)) await field.check(); }
              else if (tag === 'SELECT') await field.selectOption(String(value));
              else await field.fill(String(value));
            }
          }
          if (!(await next.isVisible())) break;
          const before = await page.evaluate(() => [...document.querySelectorAll('.wizard__step')].findIndex((el) => !el.hidden));
          await next.click();
          const after = await page.evaluate(() => [...document.querySelectorAll('.wizard__step')].findIndex((el) => !el.hidden));
          check('fixture_step_forward', after > before, `Step ${before + 1} -> ${after + 1}`, { viewport });
          check('wizard_focus_retained', await page.evaluate(() => Boolean(document.activeElement?.closest('#lead-modal')) && document.activeElement.getClientRects().length > 0), 'Focus remains visible inside modal after Continue', { viewport });
          if (after <= before) break;
        }
        const back = modal.locator('[data-back]');
        if (await back.isVisible()) {
          const before = await page.evaluate(() => [...document.querySelectorAll('.wizard__step')].findIndex((el) => !el.hidden));
          await back.click();
          const after = await page.evaluate(() => [...document.querySelectorAll('.wizard__step')].findIndex((el) => !el.hidden));
          check('fixture_step_back', after === before - 1, 'Back returns to the previous step', { viewport });
          check('wizard_focus_retained', await page.evaluate(() => Boolean(document.activeElement?.closest('#lead-modal')) && document.activeElement.getClientRects().length > 0), 'Focus remains visible inside modal after Back', { viewport });
        }
      }
    }
    await page.keyboard.press('Escape');
    const closed = !(await modal.isVisible()) || (await modal.getAttribute('aria-hidden')) === 'true';
    const restored = await trigger.evaluate((el) => document.activeElement === el);
    check('modal_escape_and_restore', closed && restored, `Trigger ${i + 1}: closed=${closed}, focus restored=${restored}`, { viewport });
  }
  return result;
}

try {
  for (const viewport of viewports) {
    const name = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    const consoleErrors = [], networkErrors = [], blockedWrites = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('net::ERR_FAILED')) consoleErrors.push(message.text()); });
    page.on('response', (response) => { if (response.status() >= 400) networkErrors.push({ url: response.url(), status: response.status() }); });
    await context.route('**/*', async (route) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { blockedWrites.push({ method: route.request().method(), url: route.request().url() }); await route.abort(); }
      else await route.continue();
    });
    await page.addInitScript(() => document.addEventListener('submit', (event) => { event.preventDefault(); event.stopImmediatePropagation(); }, true));
    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
    await settle(page);
    const landing = await measure(page);
    landing.screenshot = await addShot(page, `${name}-landing`);
    check('page_overflow', landing.pageWidth <= viewport.width + 1, `${landing.pageWidth}px page in ${viewport.width}px viewport`, { viewport, screenshot: landing.screenshot });
    check('loaded_images', landing.images.every((img) => img.loaded), 'All visible images decode after scrolling', { viewport });
    check('loaded_fonts', landing.fontStatus === 'loaded' && landing.headings.every((heading) => heading.loadedFont), 'Fonts settled before layout measurement', { viewport });
    if (!landing.ctas.some((cta) => cta.aboveFold && cta.centerUnobscured)) report.warnings.push(`${name}: no unobscured modal CTA entirely above the fold; review hero composition`);
    for (const heading of landing.headings) {
      if (heading.shortLastLine) report.warnings.push(`${name}: short final heading line at ${heading.selector}`);
      if (heading.contrastRatioOnSolidBackground !== null && heading.contrastRatioOnSolidBackground < 3) report.warnings.push(`${name}: measured heading contrast below 3 at ${heading.selector}; inspect actual background`);
    }
    for (const img of landing.images) if (img.croppedAreaFraction > .35) report.warnings.push(`${name}: ${Math.round(img.croppedAreaFraction * 100)}% cover crop at ${img.selector}; inspect subject visibility`);
    const modal = await inspectModal(page, viewport, name);
    const thankUrl = new URL(option('thank-you', 'thank-you.html'), url);
    await page.goto(thankUrl.href, { waitUntil: 'networkidle', timeout: 30000 });
    await settle(page);
    const thankYou = await measure(page);
    thankYou.screenshot = await addShot(page, `${name}-thank-you`);
    check('thank_you_overflow', thankYou.pageWidth <= viewport.width + 1, 'Thank-you page fits viewport', { viewport });
    check('thank_you_images', thankYou.images.every((img) => img.loaded), 'Thank-you images decode', { viewport });
    const pdfs = thankYou.links.filter((link) => new URL(link.href).pathname.toLowerCase().endsWith('.pdf'));
    if (pdfs.length) {
      for (const pdf of pdfs) {
        const response = await context.request.get(pdf.href);
        const body = await response.body();
        check('catalogue_download', response.ok() && body.subarray(0, 5).toString() === '%PDF-', `Download resolves to a PDF: ${pdf.href}`, { viewport });
      }
    } else if (catalogueRequired) check('catalogue_download', false, 'Catalogue enabled but thank-you page contains no PDF link', { viewport });
    check('browser_errors', consoleErrors.length === 0, consoleErrors.join('; ') || 'No page/console errors', { viewport });
    check('http_errors', networkErrors.length === 0, JSON.stringify(networkErrors), { viewport });
    report.viewports.push({ ...viewport, landing, modal, thankYou, consoleErrors, networkErrors, blockedWrites });
    await context.close();
  }
  if (root) check('source_unchanged', sourceNow() === sourceFingerprint, 'Project source fingerprint is unchanged during the run');
} catch (error) {
  report.failures.push(error.stack || error.message);
} finally {
  await browser.close();
}
report.status = report.failures.length ? 'blocked' : report.warnings.length ? 'pass_with_warnings' : 'pass';
report.execution.exit_code = report.failures.length ? 1 : 0;
report.completed_at = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, report: output, viewports: report.viewports.length, failures: report.failures, warnings: report.warnings.length }, null, 2));
process.exitCode = report.execution.exit_code;
