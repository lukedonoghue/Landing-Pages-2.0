import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:50525/';
const output = new URL('../project/build/', import.meta.url);
const chrome = '/Users/mac/.cache/puppeteer/chrome/mac_arm-138.0.7204.168/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const checks = [];
const record = (name, value = true) => { assert(value, name); checks.push(name); };
const path = name => new URL(`screenshots/${name}`, output).pathname;
await mkdir(new URL('screenshots/', output), { recursive: true });

async function assertDialogChrome(page) {
  const chrome = await page.evaluate(() => {
    const d = document.querySelector('#enquiry-dialog');
    const c = document.querySelector('#dialog-close').getBoundingClientRect();
    const h = document.querySelector('#dialog-title').getBoundingClientRect();
    return { open: d.open, closeTop: c.top, closeBottom: c.bottom, titleTop: h.top, titleBottom: h.bottom, height: innerHeight };
  });
  record('dialog title and close stay visible', chrome.open && chrome.closeTop >= 0 && chrome.closeBottom <= chrome.height && chrome.titleTop >= 0 && chrome.titleBottom <= chrome.height);
}

async function run() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  record('four shared enquiry openers', await page.locator('[data-open-modal]').count() === 4);
  record('verified public phone in header and final contact', await page.locator('a[href="tel:+447803362187"]').count() >= 2);
  record('official privacy destination', await page.locator('a[href="https://gardenroomco.com/privacy-policy/"]').count() >= 1);

  for (let i = 0; i < 4; i++) {
    const opener = page.locator('[data-open-modal]').nth(i);
    await opener.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
    await opener.click();
    record(`opener ${i + 1} opens same dialog in place`, await page.locator('#enquiry-dialog').evaluate(d => d.open));
    const during = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
    record(`opener ${i + 1} keeps URL and scroll`, Math.abs(during.y - before.y) <= 2 && during.hash === before.hash);
    await page.locator('#dialog-close').click();
    const after = await page.evaluate((index) => ({ y: scrollY, active: document.activeElement === document.querySelectorAll('[data-open-modal]')[index] }), i);
    record(`opener ${i + 1} restores focus and scroll`, after.active && Math.abs(after.y - before.y) <= 2);
  }

  await page.locator('[data-open-modal]').nth(3).click();
  await page.locator('#submit-enquiry').click();
  record('empty submission shows linked required errors', await page.locator('#error-list a').count() === 3);
  record('validation summary receives focus', await page.evaluate(() => document.activeElement?.id === 'error-summary'));
  await assertDialogChrome(page);
  await page.screenshot({ path: path('desktop-validation.png') });

  await page.locator('#name').fill('   ');
  await page.locator('#email').fill('bad-email');
  await page.locator('#phone').fill('call me maybe');
  await page.locator('#message').fill('  ');
  await page.locator('#submit-enquiry').click();
  record('whitespace, malformed email and alphabetic phone rejected', await page.locator('#error-list a').count() === 4);
  await page.locator('#name').fill('Alex Example');
  record('one corrected error disappears while other errors remain', await page.locator('#name-error').isHidden() && await page.locator('#error-list a').count() === 3);
  await page.locator('#error-list a[href="#phone"]').click();
  record('keyboard-usable summary target focuses phone field', await page.evaluate(() => document.activeElement?.id === 'phone'));
  await page.locator('#email').fill('preview@example.invalid');
  await page.locator('#phone').fill('+44 7700 900123');
  await page.locator('#message').fill('A small garden office for one person, with power and room for a desk.');
  record('all corrected errors clear', await page.locator('#error-summary').isHidden());

  let failedCalls = 0;
  await page.route('**/api/enquiry', async route => {
    failedCalls++;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic receiver failure' }) });
  });
  await page.locator('#submit-enquiry').click();
  await page.locator('#form-feedback').waitFor({ state: 'visible' });
  record('failure is visible beside action and focused', failedCalls === 1 && await page.evaluate(() => document.activeElement?.id === 'form-feedback'));
  record('failure retains the entered message', (await page.locator('#message').inputValue()).includes('small garden office'));
  await page.screenshot({ path: path('desktop-failure.png') });
  await page.unroute('**/api/enquiry');
  await page.locator('#submit-enquiry').click();
  await page.locator('#confirmed-view').waitFor({ state: 'visible' });
  record('local receiver confirms success before success state', await page.locator('#confirmed-view').isVisible() && await page.locator('#enquiry-form').isHidden());
  await page.screenshot({ path: path('desktop-confirmed.png') });
  await page.locator('#dialog-close').click();
  await page.locator('[data-open-modal]').nth(0).click();
  record('confirmed state persists on reopen', await page.locator('#confirmed-view').isVisible());
  await page.locator('#new-enquiry').click();
  record('new enquiry requires explicit reset', await page.locator('#enquiry-form').isVisible() && (await page.locator('#name').inputValue()) === '');
  await page.locator('#dialog-close').click();
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(base);
  await mobile.locator('[data-open-modal]').nth(1).click();
  await mobile.locator('#submit-enquiry').click();
  await assertDialogChrome(mobile);
  record('mobile empty-submit summary visible', await mobile.locator('#error-summary').isVisible());
  await mobile.screenshot({ path: path('mobile-validation.png') });
  await mobile.locator('#dialog-close').click();
  record('mobile close restores hero opener', await mobile.evaluate(() => document.activeElement === document.querySelectorAll('[data-open-modal]')[1]));
  await mobile.locator('#menu-toggle').click();
  record('mobile navigation opens', await mobile.locator('#main-nav').isVisible());
  await mobile.locator('#main-nav a[href="#questions"]').click();
  record('mobile navigation closes after selection', await mobile.locator('#main-nav').isHidden());
  await mobile.close();

  const tiny = await browser.newPage({ viewport: { width: 320, height: 700 } });
  await tiny.goto(base);
  await tiny.screenshot({ path: path('320x700-first.png') });
  record('320px viewport has no horizontal overflow', await tiny.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  record('320px first screen reveals next section', await tiny.evaluate(() => document.querySelector('.trust-strip').getBoundingClientRect().top < innerHeight - 40));
  await tiny.close();

  const short = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  await short.goto(base);
  await short.locator('[data-open-modal]').nth(1).click();
  await short.locator('#submit-enquiry').click();
  await assertDialogChrome(short);
  record('short-height validation still shows submit action', await short.locator('#submit-enquiry').isVisible());
  await short.screenshot({ path: path('short-validation.png') });
  await short.locator('#dialog-close').click();
  await short.close();

  const duplicate = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await duplicate.goto(base);
  await duplicate.locator('[data-open-modal]').nth(1).click();
  await duplicate.locator('#name').fill('Alex Example');
  await duplicate.locator('#email').fill('preview@example.invalid');
  await duplicate.locator('#message').fill('A garden office with power for a desk and monitor.');
  let duplicateCalls = 0;
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let markObserved;
  const observed = new Promise(resolve => { markObserved = resolve; });
  await duplicate.route('**/api/enquiry', async route => {
    duplicateCalls++;
    markObserved();
    await hold;
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ localPreview: true, receipt: 'synthetic-held-1' }) });
  });
  await duplicate.evaluate(() => {
    const f = document.getElementById('enquiry-form');
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await observed;
  record('in-flight duplicate emits one request', duplicateCalls === 1);
  await duplicate.locator('#dialog-close').click();
  await duplicate.locator('[data-open-modal]').nth(1).click();
  record('pending reopen prevents editing', await duplicate.locator('#name').isDisabled());
  release();
  await duplicate.locator('#confirmed-view').waitFor({ state: 'visible' });
  record('held response confirms only its submitted snapshot', await duplicate.locator('#confirmed-view').isVisible());
  await duplicate.screenshot({ path: path('mobile-confirmed.png') });
  await duplicate.close();

  const timed = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await timed.goto(base);
  await timed.evaluate(() => {
    const original = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => original(callback, delay === 8000 ? 150 : delay, ...args);
  });
  await timed.route('**/api/enquiry', () => new Promise(() => {}));
  await timed.locator('[data-open-modal]').nth(1).click();
  await timed.locator('#name').fill('Alex Example');
  await timed.locator('#email').fill('preview@example.invalid');
  await timed.locator('#message').fill('A small studio in the garden.');
  await timed.locator('#submit-enquiry').click();
  await timed.locator('#form-feedback').waitFor({ state: 'visible' });
  record('bounded wait yields recoverable uncertain state', (await timed.locator('#form-feedback').textContent()).includes('could not confirm whether'));
  await timed.close();
}

try {
  await run();
  await writeFile(new URL('conversion-review.json', output), JSON.stringify({ status: 'pass', checks, screenshots: ['desktop-validation.png','desktop-failure.png','desktop-confirmed.png','mobile-validation.png','mobile-confirmed.png','short-validation.png','320x700-first.png'], limit: 'All submissions were synthetic and local; no production lead delivery was tested.' }, null, 2));
  console.log(JSON.stringify({ status: 'pass', checks: checks.length }));
} catch (error) {
  await writeFile(new URL('conversion-review.json', output), JSON.stringify({ status: 'blocked', checks, failure: String(error.stack || error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
