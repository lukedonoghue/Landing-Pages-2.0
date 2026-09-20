import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/mac/node_modules/playwright-core/index.mjs';

const root = new URL('../', import.meta.url);
const shots = new URL('screenshots/', import.meta.url);
const url = 'http://127.0.0.1:43877/';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/mac/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'
});
const checks = [];
const record = (name) => checks.push(name);
await mkdir(shots, { recursive: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const writes = [];
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });
  await page.goto(url);
  assert.equal(await page.locator('[data-open-modal]').count(), 4);
  record('Four quote entry points are present');

  const openers = page.locator('[data-open-modal]');
  for (let index = 0; index < 4; index++) {
    const opener = openers.nth(index);
    await opener.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({ scrollY, hash: location.hash }));
    await opener.click();
    assert.equal(await page.locator('#quote-dialog').evaluate(element => element.open), true);
    assert.deepEqual(await page.evaluate(() => ({ scrollY, hash: location.hash })), before);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#quote-dialog').evaluate(element => element.open), false);
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);
  }
  record('All entry points open one dialog in place; Escape restores the opener');

  await openers.nth(1).click();
  await page.locator('#quote-form button[type=submit]').click();
  assert.equal(await page.locator('#error-summary').isVisible(), true);
  assert.equal(await page.locator('#name').evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('#error-list li').count(), 4);
  await page.screenshot({ path: new URL('1440x900-validation.png', shots).pathname });
  record('Empty submission reveals four errors and focuses the first field');

  await page.locator('#name').fill('Local QA Example');
  assert.equal(await page.locator('#name-error').textContent(), '');
  assert.equal(await page.locator('#error-list li').count(), 3);
  await page.locator('#error-list a[href="#email"]').click();
  assert.equal(await page.locator('#email').evaluate(element => element === document.activeElement), true);
  record('Correcting one field updates both inline and summary errors; summary link focuses control');

  await page.locator('#email').fill('not-an-email');
  await page.locator('#phone').fill('abcdefghi');
  await page.locator('#support').fill('   ');
  await page.locator('#quote-form button[type=submit]').click();
  assert.match(await page.locator('#email-error').textContent(), /valid email/);
  assert.match(await page.locator('#phone-error').textContent(), /usable phone/);
  assert.match(await page.locator('#support-error').textContent(), /support/);
  record('Malformed email, alphabetic phone junk and whitespace-only support are rejected');

  await page.locator('#email').fill('local.qa@example.test');
  await page.locator('#phone').fill('+44 7700 900123');
  await page.locator('#business').selectOption({ label: 'Sole trader' });
  await page.locator('#support').fill('Bookkeeping and VAT return support for a new sole trader.');
  await page.locator('#quote-form button[type=submit]').click();
  assert.equal(await page.locator('#handoff').isVisible(), true);
  assert.equal(await page.locator('#quote-form').isVisible(), false);
  const href = await page.locator('#draft-link').getAttribute('href');
  assert.ok(href.startsWith('mailto:info@clarentis.co.uk?'));
  const parsed = new URL(href);
  assert.match(parsed.searchParams.get('body'), /Bookkeeping and VAT return support/);
  assert.match(parsed.searchParams.get('body'), /local.qa@example.test/);
  assert.match(await page.locator('#handoff').innerText(), /has not sent your enquiry/);
  assert.deepEqual(writes, []);
  await page.screenshot({ path: new URL('1440x900-handoff.png', shots).pathname });
  record('Valid details create an addressed email draft; page makes no write request or delivery claim');

  await page.locator('#edit-details').click();
  assert.equal(await page.locator('#name').inputValue(), 'Local QA Example');
  await page.locator('#support').fill('Corporation Tax support.');
  await page.locator('#quote-form button[type=submit]').click();
  const revised = new URL(await page.locator('#draft-link').getAttribute('href'));
  assert.match(revised.searchParams.get('body'), /Corporation Tax support/);
  assert.doesNotMatch(revised.searchParams.get('body'), /Bookkeeping and VAT return support/);
  await page.keyboard.press('Escape');
  await openers.nth(1).click();
  assert.equal(await page.locator('#handoff').isVisible(), true);
  record('Editing regenerates the draft; reopening retains the handoff and entered state');

  assert.equal(await page.locator('a[href="tel:+447467474356"]').count() > 0, true);
  const privacy = await context.newPage();
  const response = await privacy.goto(`${url}privacy.html`);
  assert.equal(response.status(), 200);
  assert.equal(await privacy.getByRole('heading', { name: 'Privacy on this page' }).isVisible(), true);
  await privacy.screenshot({ path: new URL('privacy-1440.png', shots).pathname });
  record('Phone destination and local privacy page resolve');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(url);
  await mobilePage.locator('.hero [data-open-modal]').click();
  await mobilePage.locator('#name').fill('Local QA Example');
  await mobilePage.locator('#email').fill('local.qa@example.test');
  await mobilePage.locator('#business').selectOption({ label: 'Startup' });
  await mobilePage.locator('#support').fill('Company registration support.');
  await mobilePage.locator('#quote-form button[type=submit]').click();
  assert.equal(await mobilePage.locator('#handoff').isVisible(), true);
  await mobilePage.screenshot({ path: new URL('390x844-handoff.png', shots).pathname });
  record('Mobile quote journey reaches the compact handoff state');

  const narrow = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const narrowPage = await narrow.newPage();
  await narrowPage.goto(url);
  await narrowPage.screenshot({ path: new URL('320x700-first.png', shots).pathname });
  assert.equal(await narrowPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  record('320px first screen has no horizontal overflow');

  await writeFile(new URL('journey-review.json', import.meta.url), JSON.stringify({ status: 'pass', url, checks, syntheticOnly: true, liveEmailSent: false, writes }, null, 2));
  await context.close();
  await mobile.close();
  await narrow.close();
  console.log(JSON.stringify({ status: 'pass', checks: checks.length, writes }, null, 2));
} finally {
  await browser.close();
}
