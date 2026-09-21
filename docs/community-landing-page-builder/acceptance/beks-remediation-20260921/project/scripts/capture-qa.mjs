import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4177';
mkdirSync('build/qa', { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { base, captured_at: new Date().toISOString(), viewports: {}, requests: [] };

async function inspect(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const failures = [];
  page.on('response', response => {
    if (response.status() >= 400) failures.push({ status: response.status(), url: response.url() });
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(image => {
      image.loading = 'eager';
      image.removeAttribute('loading');
    });
    const step = Math.max(300, Math.floor(window.innerHeight * .7));
    for (let top = 0; top < document.body.scrollHeight; top += step) {
      window.scrollTo(0, top);
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0), null, { timeout: 15000 });
  await page.screenshot({ path: `build/qa/${name}.png`, fullPage: true });

  const layout = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim(),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyHeight: document.body.scrollHeight,
    images: Array.from(document.images).map(image => ({
      alt: image.alt,
      currentSrc: image.currentSrc,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    })),
    demoNotice: document.querySelector('.demo-notice')?.textContent?.trim(),
    formCount: document.querySelectorAll('form[data-lead-form]').length,
    analytics: window.LeadFunnel?.privacyState?.(),
  }));

  await page.locator('[data-open-modal]').first().click();
  await page.locator('#first-name').fill('Taylor Demo');
  await page.locator('#email').fill('taylor.demo@example.invalid');
  await page.locator('[data-next]').click();
  const modal = {
    visible: await page.locator('#lead-modal').isVisible(),
    step: await page.locator('[data-step-current]').textContent(),
    submitVisible: await page.locator('[data-submit]').isVisible(),
    warning: await page.locator('.modal-warning').textContent(),
  };
  await page.screenshot({ path: `build/qa/${name}-modal.png`, fullPage: false });
  await page.locator('[data-close-modal]').click();
  modal.closed = !(await page.locator('#lead-modal').isVisible());

  report.viewports[name] = { viewport, layout, modal, failures };
  await context.close();
}

try {
  await inspect('desktop-1440x900', { width: 1440, height: 900 });
  await inspect('mobile-390x844', { width: 390, height: 844 });
  const pdf = await fetch(`${base}/assets/bookkeeping-month-end-clarity-checklist.pdf`);
  report.pdf = { status: pdf.status, contentType: pdf.headers.get('content-type'), bytes: (await pdf.arrayBuffer()).byteLength };
  writeFileSync('build/qa/capture-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
