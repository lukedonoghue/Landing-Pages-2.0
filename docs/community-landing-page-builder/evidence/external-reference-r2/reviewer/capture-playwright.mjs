import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const url = 'http://127.0.0.1:4199/';
const sizes = [[390, 844], [768, 1024], [1024, 800], [1280, 600], [1440, 900]];
const formsOnly = process.argv.includes('--forms-only');
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.hero-image').evaluate(image => image.decode().catch(() => {}));
  await page.waitForTimeout(200);
  return { context, page };
}

async function sectionShot(page, selector, name) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  await locator.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  await locator.screenshot({ path: path.join(out, name), animations: 'disabled' });
}

const observations = formsOnly
  ? JSON.parse(fs.readFileSync(path.join(out, 'capture-data.json'), 'utf8'))
  : { url, capturedAt: new Date().toISOString(), viewports: [], forms: [] };
observations.forms = [];
try {
  if (!formsOnly) for (const [width, height] of sizes) {
    console.log(`viewport ${width}x${height}`);
    const { context, page } = await open(width, height);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.screenshot({ path: path.join(out, `${width}x${height}-first.png`) });
    await page.screenshot({ path: path.join(out, `${width}x${height}-full.png`), fullPage: true });
    const metrics = await page.evaluate(() => {
      const box = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        hero: box('.hero'),
        evidence: box('.evidence'),
        heroAction: box('.hero .button'),
        logo: box('.brand img'),
        fonts: {
          heading: getComputedStyle(document.querySelector('h1')).fontFamily,
          body: getComputedStyle(document.querySelector('.hero-lead')).fontFamily,
          loaded: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family),
        },
        images: [...document.images].map(image => ({
          src: image.currentSrc,
          alt: image.alt,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        })),
      };
    });
    if (width === 390 || width === 1440) {
      for (const [selector, label] of [
        ['#projects', 'projects'], ['#approach', 'approach'], ['.materials', 'materials'],
        ['.review', 'review'], ['#questions', 'questions'], ['#enquire', 'enquiry'],
        ['.site-footer', 'footer'],
      ]) await sectionShot(page, selector, `${width}-${label}.png`);
      await page.locator('#questions summary').first().click();
      await sectionShot(page, '#questions', `${width}-questions-open.png`);
    }
    if (width <= 768) {
      await page.locator('.menu-toggle').click();
      await page.screenshot({ path: path.join(out, `${width}-menu-open.png`) });
    }
    observations.viewports.push({ size: `${width}x${height}`, ...metrics, errors });
    await context.close();
  }

  for (const [width, height] of [[390, 844], [1280, 600], [1440, 900]]) {
    console.log(`form ${width}x${height}`);
    const { context, page } = await open(width, height);
    let outcome = 'failure';
    let interceptedPosts = 0;
    await page.route('**/api/enquiry', async route => {
      interceptedPosts++;
      await route.fulfill({
        status: outcome === 'success' ? 200 : 503,
        contentType: 'application/json',
        body: outcome === 'success' ? JSON.stringify({ ok: true, receipt: 'synthetic-review-receipt' }) : JSON.stringify({ ok: false }),
      });
    });
    await page.locator('.submit-button').click();
    await page.locator('#error-summary').waitFor({ state: 'visible' });
    await page.waitForTimeout(2200);
    const validationFocus = await page.evaluate(() => {
      const rect = document.querySelector('#name').getBoundingClientRect();
      const summary = document.querySelector('#error-summary').getBoundingClientRect();
      return {
        focusedId: document.activeElement?.id,
        nameTop: rect.top,
        nameBottom: rect.bottom,
        summaryTop: summary.top,
        summaryBottom: summary.bottom,
        scrollY,
        maxScrollY: document.documentElement.scrollHeight - innerHeight,
      };
    });
    await page.screenshot({ path: path.join(out, `${width}-form-validation-viewport.png`) });
    await sectionShot(page, '.form-shell', `${width}-form-validation.png`);
    const validation = await page.locator('#error-summary').innerText();
    await page.locator('#name').fill('Visual Review');
    await page.locator('#email').fill('visual.review@example.invalid');
    await page.locator('#message').fill('Synthetic visual acceptance enquiry. No live lead.');
    await page.locator('.submit-button').click();
    await page.locator('#form-result').getByText('We could not confirm this enquiry.', { exact: false }).waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, `${width}-form-failure-viewport.png`) });
    await sectionShot(page, '.form-shell', `${width}-form-failure.png`);
    const failure = await page.locator('#form-result').innerText();
    outcome = 'success';
    await page.locator('.submit-button').click();
    await page.locator('#success-panel').waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, `${width}-form-success-viewport.png`) });
    await sectionShot(page, '.form-shell', `${width}-form-success.png`);
    const success = await page.locator('#success-panel').innerText();
    observations.forms.push({ size: `${width}x${height}`, validation, validationFocus, failure, success, interceptedPosts });
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'capture-data.json'), JSON.stringify(observations, null, 2));
  console.log(JSON.stringify({ viewports: observations.viewports.map(item => item.size), forms: observations.forms }, null, 2));
} finally {
  await browser.close();
}
