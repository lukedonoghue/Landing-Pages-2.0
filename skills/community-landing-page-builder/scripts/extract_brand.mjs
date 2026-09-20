#!/usr/bin/env node
/** Read-only rendered-brand measurements. Original implementation; interpretation requires visual review. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readRenderedFonts } from './rendered_fonts.mjs';

const args = process.argv.slice(2);
const option = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`--${name} requires a value`);
  return args[index + 1];
};
if (!args.length || args.includes('--help')) {
  console.log(`node extract_brand.mjs <url> --out build/brand.json\n  [--playwright-module /path/to/playwright/index.mjs] [--browser-executable /path/to/chromium]\nRead-only, isolated 390px and 1440px browser views. All write requests are blocked.`);
  process.exit(0);
}
const url = new URL(args[0]);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) client URL');
const output = resolve(option('out', 'build/brand.json'));
await mkdir(dirname(output), { recursive: true });
const suppliedModule = option('playwright-module', process.env.FUNNEL_PLAYWRIGHT_MODULE || '');
let runtime;
if (suppliedModule) runtime = await import(isAbsolute(suppliedModule) ? pathToFileURL(suppliedModule).href : suppliedModule);
else {
  const require = createRequire(pathToFileURL(resolve(process.cwd(), 'package.json')));
  try { runtime = await import(pathToFileURL(require.resolve('playwright')).href); }
  catch { runtime = await import(pathToFileURL(require.resolve('playwright-core')).href); }
}
const chromium = runtime.chromium || runtime.default?.chromium;
if (!chromium) throw new Error('The selected module does not export Playwright chromium');
const executablePath = option('browser-executable', process.env.FUNNEL_CHROMIUM || '');
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = {
  schema_version: 1,
  kind: 'rendered_brand_measurement',
  status: 'blocked',
  url: url.href,
  captured_at: new Date().toISOString(),
  tool: { name: 'extract_brand', version: '1.2.0', node: process.version, browser: browser.version() },
  measurements: [], artifacts: [], failures: [],
  interpretation: 'Measurements describe rendered CSS and visible geometry. They do not automatically select the correct brand identity, official font, logo, or design direction.',
  limits: [
    'Surface areas approximate visible bounding-box area in the first viewport. Overlapping parent/child backgrounds are counted independently; these are not pixel shares.',
    'Computed stacks and FontFace entries alone do not prove glyph fonts. renderedFonts records Chromium evidence for the selected heading and prose samples only.',
    'Background images, gradients, transparency, pseudo-elements, canvas, and video need screenshot review. No dominant image-color extraction is attempted.',
    'No cookies or login state are imported. Consent dialogs or anonymous variants can affect the visible sample.',
    'All write requests are blocked. Normal GET requests still reach the supplied site.'
  ]
};

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [], blockedWrites = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.continue();
      blockedWrites.push({ method: route.request().method(), url: route.request().url() });
      return route.abort();
    });
    await page.addInitScript(() => document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true));
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(async () => {
      await Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 6000))]);
      await Promise.race([Promise.all([...document.images].filter(image => image.getBoundingClientRect().top < innerHeight).map(image => image.decode().catch(() => {}))), new Promise(done => setTimeout(done, 6000))]);
    });
    // Entrance animations can hide the only heading after fonts and images load.
    await page.waitForFunction(() => [...document.querySelectorAll('h1')].some(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return element.textContent.trim() && box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    }), null, { timeout: 4000 }).catch(() => {});
    const data = await page.evaluate(() => {
      const selector = element => element.id ? `#${CSS.escape(element.id)}` : element.tagName.toLowerCase() + [...element.classList].slice(0, 3).map(name => `.${CSS.escape(name)}`).join('');
      const bounds = element => {
        const box = element.getBoundingClientRect();
        const width = Math.max(0, Math.min(innerWidth, box.right) - Math.max(0, box.left));
        const height = Math.max(0, Math.min(innerHeight, box.bottom) - Math.max(0, box.top));
        return { x: box.x, y: box.y, width: box.width, height: box.height, visibleAreaApprox: width * height };
      };
      const visible = element => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && bounds(element).visibleAreaApprox > 0;
      };
      const typography = element => {
        const style = getComputedStyle(element);
        return { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textTransform: style.textTransform, color: style.color, fontStackAvailable: document.fonts.check(`${style.fontSize} ${style.fontFamily}`) };
      };
      const roles = {};
      for (const [role, query] of Object.entries({ hero_heading: 'h1', section_heading: 'h2', subheading: 'h3', body: 'p', navigation: 'nav a,header a', label: 'label', link: 'main a,article a' })) {
        roles[role] = [...document.querySelectorAll(query)].filter(visible).slice(0, 8).map(element => ({ selector: selector(element), text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 180), bounds: bounds(element), ...typography(element) }));
      }
      const candidates = [...document.querySelectorAll('body,body *')].filter(visible);
      const surfaces = new Map();
      const imageBackgrounds = [];
      for (const element of candidates) {
        const style = getComputedStyle(element), box = bounds(element);
        const color = style.backgroundColor;
        if (style.backgroundImage !== 'none') imageBackgrounds.push({ selector: selector(element), backgroundImage: style.backgroundImage, backgroundSize: style.backgroundSize, backgroundPosition: style.backgroundPosition, bounds: box });
        const transparent = color === 'transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(color);
        if (transparent || box.visibleAreaApprox < 4) continue;
        const entry = surfaces.get(color) || { color, summedVisibleBoxArea: 0, elements: 0, examples: [] };
        entry.summedVisibleBoxArea += box.visibleAreaApprox;
        entry.elements++;
        if (entry.examples.length < 5) entry.examples.push({ selector: selector(element), bounds: box, opacity: style.opacity });
        surfaces.set(color, entry);
      }
      const buttons = [...document.querySelectorAll('button,[role="button"],input[type="submit"],[data-open-modal],a[class*="button"],a[class*="btn"],a[class*="cta"]')].filter(visible).slice(0, 24).map(element => {
        const style = getComputedStyle(element);
        return { selector: selector(element), text: (element.textContent || element.value || '').trim().replace(/\s+/g, ' ').slice(0, 120), bounds: bounds(element), ...typography(element), backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, borderColor: style.borderColor, borderWidth: style.borderWidth, borderRadius: style.borderRadius, boxShadow: style.boxShadow, padding: style.padding };
      });
      const images = [...document.images].filter(visible).map(element => ({ selector: selector(element), src: element.currentSrc || element.src, alt: element.alt, bounds: bounds(element), loaded: element.complete && element.naturalWidth > 0, objectFit: getComputedStyle(element).objectFit, objectPosition: getComputedStyle(element).objectPosition }));
      return { title: document.title, finalUrl: location.href, roles, buttons, images,
        surfaceMethod: 'visible clipped bounding-box area; independent overlapping boxes; first viewport only',
        coloredSurfaces: [...surfaces.values()].sort((a, b) => b.summedVisibleBoxArea - a.summedVisibleBoxArea).slice(0, 20),
        imageBackgrounds: imageBackgrounds.slice(0, 20), fontStatus: document.fonts.status,
        fontFaces: [...document.fonts].map(font => ({ family: font.family, weight: font.weight, style: font.style, status: font.status })) };
    });
    const fontSamples = {
      heading: data.roles.hero_heading.find(item => item.text),
      body: data.roles.body.find(item => item.text.length >= 60 && item.textTransform !== 'uppercase'),
    };
    const rendered = await readRenderedFonts(page, fontSamples);
    for (const [role, sample] of Object.entries(fontSamples)) {
      if (sample) sample.renderedFonts = rendered.fonts[role] || [];
    }
    data.fontRenderError = rendered.error;
    const screenshot = resolve(dirname(output), `brand-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: false, animations: 'disabled' });
    const artifact = { path: relative(dirname(output), screenshot), type: 'screenshot', sha256: createHash('sha256').update(await readFile(screenshot)).digest('hex') };
    report.artifacts.push(artifact);
    // Preserve first-viewport evidence; only seek missing typography below it.
    for (const [role, query] of Object.entries({ heading: 'h1', body: 'main p,article p,p' })) {
      if (fontSamples[role]?.renderedFonts?.length) continue;
      const deadline = Date.now() + 4000;
      const candidates = page.locator(query);
      for (let index = 0; index < Math.min(await candidates.count(), 20); index++) {
        if (Date.now() >= deadline) break;
        const candidate = candidates.nth(index);
        const eligible = await candidate.evaluate((element, role) => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          return element.textContent.trim().length >= (role === 'body' ? 60 : 1) && style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0 && (role !== 'body' || style.textTransform !== 'uppercase');
        }, role);
        if (!eligible) continue;
        try { await candidate.scrollIntoViewIfNeeded({ timeout: Math.max(1, Math.min(1500, deadline - Date.now())) }); } catch { continue; }
        await page.waitForFunction(element => Number(getComputedStyle(element).opacity) > 0, await candidate.elementHandle(), { timeout: Math.max(1, Math.min(1500, deadline - Date.now())) }).catch(() => {});
        const sample = await candidate.evaluate(element => {
          if (Number(getComputedStyle(element).opacity) <= 0) return null;
          const parts = [];
          for (let node = element; node?.nodeType === 1; node = node.parentElement) {
            const siblings = node.parentElement ? [...node.parentElement.children].filter(sibling => sibling.tagName === node.tagName) : [node];
            parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
          }
          const style = getComputedStyle(element);
          return { selector: parts.join(' > '), text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 180), fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, textTransform: style.textTransform, sampleScrollY: scrollY };
        });
        if (!sample) continue;
        const glyphs = await readRenderedFonts(page, { [role]: sample });
        sample.renderedFonts = glyphs.fonts[role] || [];
        if (!sample.renderedFonts.length) continue;
        const samplePath = resolve(dirname(output), `brand-${viewport.width}x${viewport.height}-${role}.png`);
        await page.screenshot({ path: samplePath, fullPage: false, animations: 'disabled' });
        sample.screenshot = relative(dirname(output), samplePath);
        report.artifacts.push({ path: sample.screenshot, type: 'screenshot', sha256: createHash('sha256').update(await readFile(samplePath)).digest('hex') });
        fontSamples[role] = sample;
        break;
      }
    }
    data.typography = fontSamples;
    report.measurements.push({ viewport, httpStatus: response?.status() ?? null, screenshot: artifact.path, errors, blockedWrites, ...data });
    if (!response || !response.ok()) report.failures.push(`${viewport.width}px: navigation returned ${response?.status() ?? 'no response'}`);
    await context.close();
  }
  report.status = report.failures.length ? 'blocked' : 'pass';
} catch (error) {
  report.failures.push(error.stack || error.message);
} finally {
  await browser.close();
}
report.completed_at = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, report: output, measurements: report.measurements.length, screenshots: report.artifacts.map(artifact => resolve(dirname(output), artifact.path)), failures: report.failures }, null, 2));
process.exitCode = report.status === 'blocked' ? 1 : 0;
