import { chromium } from '/Users/mac/node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const url = 'http://127.0.0.1:4175/';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { viewportChecks: [], conversion: [], failures: [] };

function check(ok, label, detail = '') {
  report.conversion.push({ ok, label, detail });
  if (!ok) report.failures.push(label + (detail ? `: ${detail}` : ''));
}

for (const [label, width, height] of [
  ['mobile', 390, 844], ['tablet', 768, 1024], ['laptop', 1024, 800],
  ['short-laptop', 1280, 600], ['desktop', 1440, 900]
]) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(root, `build/screenshots/${label}-first.png`) });
  const data = await page.evaluate(() => {
    const hero = document.querySelector('.hero').getBoundingClientRect();
    const strip = document.querySelector('.trust-strip').getBoundingClientRect();
    const action = document.querySelector('.hero-actions .button').getBoundingClientRect();
    const small = [...document.querySelectorAll('a,button,summary')].filter(el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width && r.height && (r.width < 24 || r.height < 24);
    }).map(el => ({ text: el.textContent.trim().slice(0, 70), tag: el.tagName, className: el.className, width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) }));
    return { heroBottom: Math.round(hero.bottom), followingTop: Math.round(strip.top), actionBottom: Math.round(action.bottom), small, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
  report.viewportChecks.push({ label, width, height, ...data });
  if (label === 'mobile' || label === 'desktop') {
    for (const [name, selector] of [['hero', '.hero'], ['design', '.design-figure'], ['projects', '.project-grid'], ['enquiry', '.enquiry-section']]) {
      await page.locator(selector).screenshot({ path: join(root, `build/screenshots/${label}-${name}.png`) });
    }
  }
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('.hero-actions a').click();
await page.locator('#submit-button').click();
await page.waitForTimeout(200);
check(await page.locator('#validation-summary').isVisible(), 'Empty form reveals summary');
check(await page.evaluate(() => document.activeElement?.id === 'validation-summary'), 'Empty form focuses summary');
check(await page.locator('#name-error').textContent() === 'Enter your name.', 'Whitespace name error available');
await page.screenshot({ path: join(root, 'build/screenshots/mobile-validation.png') });
await page.locator('#name').fill('   ');
await page.locator('#name').dispatchEvent('input');
check(await page.locator('#name-error').textContent() === 'Enter your name.', 'Whitespace name stays invalid');
await page.locator('#name').fill('Preview Visitor');
check(await page.locator('#name-error').textContent() === '', 'Corrected name clears inline error');
check(!(await page.locator('#validation-summary').textContent()).includes('Enter your name.'), 'Corrected name clears summary entry');
check((await page.locator('#validation-summary').textContent()).includes('Enter your email address.'), 'Other summary errors remain');
await page.locator('#validation-summary a[href="#email"]').click();
check(await page.evaluate(() => document.activeElement?.id === 'email'), 'Summary link focuses email control');
await page.locator('#email').fill('preview@example.test');
await page.locator('#phone').fill('phone junk');
await page.locator('#message').fill('A small room for painting in the garden.');
await page.locator('#submit-button').click();
check((await page.locator('#phone-error').textContent()).includes('usable phone'), 'Alphabetic phone junk rejected');
await page.locator('#phone').fill('+44 7700 900123');

await page.route('**/api/enquiries', async route => {
  await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"preview_failure"}' });
}, { times: 1 });
await page.locator('#submit-button').click();
await page.locator('#form-status').waitFor({ state: 'visible' });
check((await page.locator('#form-status').textContent()).includes('could not confirm'), 'Receiver failure is visible');
check(await page.locator('#name').inputValue() === 'Preview Visitor', 'Failure retains values');
await page.screenshot({ path: join(root, 'build/screenshots/mobile-failure.png') });
await page.locator('#submit-button').click();
await page.locator('#form-success').waitFor({ state: 'visible' });
check((await page.locator('#form-success').textContent()).includes('not sent'), 'Success waits for local confirmation');
await page.screenshot({ path: join(root, 'build/screenshots/mobile-success.png') });
await page.reload();
check(!(await page.locator('#form-success').isVisible()), 'Refresh does not retain a conversion');
await page.close();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(url, { waitUntil: 'networkidle' });
await desktop.locator('#submit-button').click();
await desktop.waitForTimeout(200);
check(await desktop.evaluate(() => {
  const box = document.querySelector('#validation-summary').getBoundingClientRect();
  return document.activeElement?.id === 'validation-summary' && box.top >= 0 && box.bottom < innerHeight;
}), 'Desktop validation summary visible from submit position');
await desktop.screenshot({ path: join(root, 'build/screenshots/desktop-validation.png') });
await desktop.close();

const duplicate = await browser.newPage({ viewport: { width: 390, height: 844 } });
await duplicate.goto(url, { waitUntil: 'networkidle' });
await duplicate.locator('#name').fill('Preview Visitor');
await duplicate.locator('#email').fill('preview@example.test');
await duplicate.locator('#message').fill('A small garden office for work.');
let invocations = 0;
let release;
const held = new Promise(resolve => { release = resolve; });
await duplicate.route('**/api/enquiries', async route => {
  invocations++;
  await held;
  const data = route.request().postDataJSON();
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'preview-confirmed', requestId: data.requestId }) });
});
await duplicate.locator('#submit-button').click();
await duplicate.waitForTimeout(100);
await duplicate.locator('#enquiry-form').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
check(await duplicate.locator('#name').isDisabled(), 'Inputs locked while pending');
check(invocations === 1, 'Second submit event does not create another request', String(invocations));
release();
await duplicate.locator('#form-success').waitFor({ state: 'visible' });
await duplicate.close();

const timeout = await browser.newPage({ viewport: { width: 390, height: 844 } });
await timeout.goto(url, { waitUntil: 'networkidle' });
await timeout.locator('#name').fill('Preview Visitor');
await timeout.locator('#email').fill('preview@example.test');
await timeout.locator('#message').fill('A small garden office for work.');
await timeout.route('**/api/enquiries', async route => {
  await new Promise(resolve => setTimeout(resolve, 11000));
  await route.abort().catch(() => {});
});
await timeout.locator('#submit-button').click();
await timeout.locator('#form-status').waitFor({ state: 'visible', timeout: 10500 });
check((await timeout.locator('#form-status').textContent()).includes('could not confirm what happened'), 'Timed-out request shows uncertainty');
check(await timeout.locator('#name').inputValue() === 'Preview Visitor', 'Timeout preserves values');
await timeout.close();

await browser.close();
await writeFile(join(root, 'build/conversion-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ failures: report.failures, viewportChecks: report.viewportChecks, conversionChecks: report.conversion.length }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
