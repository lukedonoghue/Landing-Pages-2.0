import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from './qa-tools/node_modules/playwright/index.mjs';

const base = 'http://127.0.0.1:52843';
const output = new URL('./project/build/', import.meta.url);
const shots = new URL('./project/build/screenshots/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const findings = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function record(name, condition) {
  assert.ok(condition, name);
  findings.push(name);
}

async function isFocusedVisible(targetPage = page) {
  return targetPage.evaluate(() => {
    const element = document.activeElement;
    const box = element.getBoundingClientRect();
    const x = Math.max(1, Math.min(innerWidth - 1, box.left + box.width / 2));
    const y = Math.max(1, Math.min(innerHeight - 1, box.top + box.height / 2));
    return box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight && (document.elementFromPoint(x, y) === element || element.contains(document.elementFromPoint(x, y)));
  });
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.header-action').click();
  await page.waitForTimeout(1400);
  await record('Primary CTA reaches the enquiry form', await page.locator('#lead-form').isVisible());
  await page.screenshot({ path: new URL('form-mobile.png', shots).pathname, fullPage: false });

  await page.locator('#name').fill('   ');
  await page.locator('#email').fill('   ');
  await page.locator('#submit-button').click();
  await page.waitForTimeout(100);
  await record('Whitespace-only required fields are rejected', await page.locator('#error-summary').isVisible() && await page.locator('#name-error').isVisible() && await page.locator('#email-error').isVisible());
  await record('Validation focus is visible', await isFocusedVisible());
  await page.screenshot({ path: new URL('form-errors-mobile.png', shots).pathname, fullPage: false });

  await page.locator('#name').fill('Synthetic Visitor');
  await record('Correcting one field clears only its error', !(await page.locator('#name-error').isVisible()) && await page.locator('#email-error').isVisible() && (await page.locator('#error-summary').innerText()).includes('Email:') && !(await page.locator('#error-summary').innerText()).includes('Name:'));
  await page.locator('#error-summary a').focus();
  await page.keyboard.press('Enter');
  await record('Error summary link focuses its field', await page.evaluate(() => document.activeElement?.id === 'email'));
  await page.locator('#email').fill('bad@');
  await page.locator('#submit-button').click();
  await record('Malformed email is rejected', (await page.locator('#email-error').innerText()).includes('valid email'));

  await page.locator('#email').fill('synthetic@example.test');
  await page.locator('#phone').fill('abcdefghi');
  await page.locator('#submit-button').click();
  await record('Alphabetic phone junk is rejected', (await page.locator('#phone-error').innerText()).includes('usable phone'));
  await page.locator('#phone').fill('+44 7700 900123');
  await page.locator('#message').fill('A synthetic garden office enquiry for local testing.');

  await page.route('**/api/enquiry', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"accepted":false}' }));
  await page.locator('#submit-button').click();
  await page.locator('#submit-status').waitFor({ state: 'visible' });
  await record('Failed response is visible beside action and retains entries', await page.locator('#submit-status').isVisible() && (await page.locator('#name').inputValue()) === 'Synthetic Visitor' && await isFocusedVisible());
  await page.screenshot({ path: new URL('form-failure-mobile.png', shots).pathname, fullPage: false });
  await page.unroute('**/api/enquiry');

  const before = (await (await page.request.get(`${base}/__qa/count`)).json()).accepted;
  await page.locator('#submit-button').click();
  await page.locator('#result-panel').waitFor({ state: 'visible' });
  await record('Local receiver confirms a preview result only', await page.locator('#result-panel').isVisible() && (await page.locator('#result-panel').innerText()).includes('Nothing was sent') && await isFocusedVisible());
  const after = (await (await page.request.get(`${base}/__qa/count`)).json()).accepted;
  await record('Exactly one synthetic submission reached local receiver', after === before + 1);
  await page.screenshot({ path: new URL('form-success-mobile.png', shots).pathname, fullPage: false });

  await page.locator('#new-enquiry').click();
  await record('New enquiry deliberately resets confirmed state', await page.locator('#lead-form').isVisible() && (await page.locator('#name').inputValue()) === '');
  await page.locator('#name').fill('Synthetic Duplicate');
  await page.locator('#email').fill('duplicate@example.test');
  let calls = 0;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/enquiry', async route => {
    calls += 1;
    await held;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: true, preview: true, receipt: 'synthetic-duplicate-check' }) });
  });
  await page.evaluate(() => {
    const form = document.querySelector('#lead-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  await record('Pending request disables edits and blocks duplicate submit events', calls === 1 && await page.locator('#name').isDisabled());
  release();
  await page.locator('#result-panel').waitFor({ state: 'visible' });
  await page.unroute('**/api/enquiry');

  const deadlinePage = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  await deadlinePage.goto(base, { waitUntil: 'networkidle' });
  await deadlinePage.locator('#name').focus();
  for (const id of ['email', 'phone', 'postcode', 'use', 'message', 'marketing', 'submit-button']) {
    await deadlinePage.keyboard.press('Tab');
    await deadlinePage.waitForTimeout(550);
    await record(`Short-height keyboard focus reaches visible ${id}`, await deadlinePage.evaluate(expected => document.activeElement?.id === expected, id) && await isFocusedVisible(deadlinePage));
  }
  await deadlinePage.locator('#name').fill('Synthetic Timeout');
  await deadlinePage.locator('#email').fill('timeout@example.test');
  await deadlinePage.route('**/api/enquiry', () => {});
  await deadlinePage.locator('#submit-button').click();
  await deadlinePage.locator('#submit-status').waitFor({ state: 'visible', timeout: 10000 });
  await record('Unresolved request times out with a retryable uncertain state', (await deadlinePage.locator('#submit-status').innerText()).includes('could not confirm') && await deadlinePage.locator('#submit-button').isEnabled());
  await deadlinePage.screenshot({ path: new URL('form-failure-short-laptop.png', shots).pathname, fullPage: false });
  await deadlinePage.close();

  await writeFile(new URL('form-review.json', output), JSON.stringify({ status: 'pass', checks: findings, receiverAcceptedBefore: before, receiverAcceptedAfter: after, mode: 'synthetic local receiver only' }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'pass', checks: findings.length }, null, 2));
} catch (error) {
  await writeFile(new URL('form-review.json', output), JSON.stringify({ status: 'blocked', checks: findings, error: error.stack || error.message }, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
