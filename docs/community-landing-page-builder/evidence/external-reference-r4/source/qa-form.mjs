import assert from 'node:assert/strict';
import { chromium } from '../qa-tools/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME });
const url = 'http://127.0.0.1:43871/';
const out = 'project/build/screenshots';
const notes = [];

async function openPage(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  const posts = [];
  page.on('request', request => { if (request.method() !== 'GET') posts.push(request.url()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, posts };
}

async function fillValid(page) {
  await page.locator('#enquiry-name').fill('Local QA Example');
  await page.locator('#enquiry-email').fill('qa@example.test');
  await page.locator('#enquiry-phone').fill('+44 7700 900123');
  await page.locator('#enquiry-message').fill('A small garden office with a desk and storage.');
}

async function visibleFocus(page, selector) {
  const state = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { focused: document.activeElement === element, visible: box.top >= 0 && box.bottom <= innerHeight, top: box.top, bottom: box.bottom };
  });
  assert(state.focused && state.visible, `${selector} focus is not visible: ${JSON.stringify(state)}`);
}

try {
  const { page, posts } = await openPage({ width: 390, height: 844 });
  const openers = page.locator('[data-open-modal]');
  assert.equal(await openers.count(), 4);
  for (let index = 0; index < 4; index++) {
    const opener = openers.nth(index);
    await opener.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
    await opener.click();
    assert(await page.locator('#enquiry-dialog').evaluate(element => element.open));
    const after = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
    assert.deepEqual(after, before, `opener ${index} moved the page`);
    await page.locator('#close-dialog').click();
    assert(await opener.evaluate(element => document.activeElement === element), `opener ${index} did not regain focus`);
  }
  notes.push('Four consultation CTAs open the same dialog without a page jump and restore focus on close.');

  await openers.first().click();
  await page.locator('#submit-enquiry').click();
  await visibleFocus(page, '#enquiry-name');
  assert(await page.locator('#name-error').isVisible());
  assert.equal(await page.locator('#error-summary li').count(), 3);
  await page.screenshot({ path: `${out}/390x844-validation.png`, animations: 'disabled' });
  await page.locator('#enquiry-name').fill('Local QA Example');
  assert.equal(await page.locator('#error-summary li').count(), 2);
  await page.locator('#enquiry-email').fill('bad-address');
  await page.locator('#enquiry-phone').fill('alphabetic junk');
  await page.locator('#enquiry-message').fill('   ');
  await page.locator('#submit-enquiry').click();
  assert.equal(await page.locator('#error-summary li').count(), 3);
  assert.match(await page.locator('#phone-error').textContent(), /usable phone/);
  await page.locator('#error-summary a').filter({ hasText: 'Phone number' }).focus();
  await page.keyboard.press('Enter');
  await visibleFocus(page, '#enquiry-phone');
  notes.push('Whitespace, malformed email and alphabetic phone input are rejected; summary links focus their fields and update as errors are corrected.');

  await fillValid(page);
  await page.locator('#submit-enquiry').click();
  await visibleFocus(page, '#form-status');
  assert.match(await page.locator('#form-status').textContent(), /does not send details/);
  assert.equal(await page.locator('#enquiry-name').inputValue(), 'Local QA Example');
  assert.equal(posts.length, 0);
  notes.push('The default local-preview action keeps values and makes no POST request.');

  await page.evaluate(() => { window.GRC_LEAD_ADAPTER = async () => ({ status: 'failed' }); });
  await page.locator('#submit-enquiry').click();
  await visibleFocus(page, '#form-status');
  assert.match(await page.locator('#form-status').textContent(), /couldn't complete/);
  await page.screenshot({ path: `${out}/390x844-failure.png`, animations: 'disabled' });

  await page.evaluate(() => { window.GRC_LEAD_ADAPTER = async () => ({ ok: true }); });
  await page.locator('#submit-enquiry').click();
  assert(await page.locator('#result-panel').isVisible());
  assert.match(await page.locator('#result-panel').textContent(), /Nothing was sent/);
  await page.screenshot({ path: `${out}/390x844-success.png`, animations: 'disabled' });
  await page.locator('#close-dialog').click();
  await openers.first().click();
  assert(await page.locator('#result-panel').isVisible());
  await page.locator('#new-enquiry').click();
  assert.equal(await page.locator('#enquiry-name').inputValue(), '');
  notes.push('Synthetic failure stays visible for retry; synthetic confirmation shows an explicit preview result that persists on reopen.');

  await fillValid(page);
  await page.evaluate(() => {
    window.__calls = 0;
    window.GRC_LEAD_ADAPTER = () => { window.__calls++; return new Promise(resolve => { window.__finish = resolve; }); };
  });
  await page.locator('#submit-enquiry').click();
  await page.locator('#enquiry-form').evaluate(element => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(await page.evaluate(() => window.__calls), 1);
  await page.locator('#close-dialog').click();
  await openers.first().click();
  assert(await page.locator('#form-fields').evaluate(element => element.disabled));
  await page.evaluate(() => { document.querySelector('#enquiry-name').value = 'Changed without submission'; window.__finish({ ok: true }); });
  await page.locator('#form-status').waitFor({ state: 'visible' });
  assert.match(await page.locator('#form-status').textContent(), /couldn't confirm/);
  assert(!(await page.locator('#result-panel').isVisible()));
  notes.push('A held request accepts one dispatch; closing and reopening preserves pending state, and a changed snapshot cannot be confirmed by the old response.');
  await page.close();

  const { page: timeoutPage } = await openPage({ width: 1280, height: 600 });
  await timeoutPage.locator('[data-open-modal]').first().click();
  await fillValid(timeoutPage);
  await timeoutPage.evaluate(() => { window.GRC_PREVIEW_TIMEOUT_MS = 100; window.GRC_LEAD_ADAPTER = () => new Promise(() => {}); });
  await timeoutPage.locator('#submit-enquiry').click();
  await timeoutPage.locator('#form-status').waitFor({ state: 'visible' });
  await visibleFocus(timeoutPage, '#form-status');
  assert.match(await timeoutPage.locator('#form-status').textContent(), /couldn't confirm/);
  assert(!(await timeoutPage.locator('#form-fields').evaluate(element => element.disabled)));
  notes.push('The short-height dialog keeps its action visible and a timed-out preview becomes recoverable.');
  await timeoutPage.close();

  const { page: desktop } = await openPage({ width: 1440, height: 900 });
  await desktop.locator('[data-open-modal]').first().click();
  await desktop.locator('#enquiry-message').focus();
  await desktop.locator('#submit-enquiry').click();
  await visibleFocus(desktop, '#enquiry-name');
  const context = await desktop.locator('[data-field="name"]').evaluate(element => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: innerHeight };
  });
  assert(context.top >= 0 && context.bottom <= context.height, `Validation context off-screen: ${JSON.stringify(context)}`);
  await desktop.close();
  notes.push('Empty submission from the scrolled action reveals the focused label, control and error at desktop size.');

  const normal = await browser.newPage({ viewport: { width: 390, height: 700 }, reducedMotion: 'no-preference' });
  await normal.goto(url, { waitUntil: 'networkidle' });
  await normal.locator('[data-open-modal]').first().click();
  const escaped = await normal.evaluate(() => {
    document.querySelector('.brand').focus();
    return document.activeElement?.classList.contains('brand');
  });
  assert(!escaped, 'Programmatic focus escaped the modal');
  await normal.locator('#enquiry-name').focus();
  for (let index = 0; index < 9; index++) {
    await normal.keyboard.press('Tab');
    const focus = await normal.evaluate(() => {
      const element = document.activeElement;
      const box = element.getBoundingClientRect();
      return { inDialog: !!element.closest('#enquiry-dialog'), top: box.top, bottom: box.bottom, height: innerHeight };
    });
    assert(focus.inDialog && focus.top >= 0 && focus.bottom <= focus.height, `Tab ${index} focus hidden: ${JSON.stringify(focus)}`);
  }
  await normal.locator('#submit-enquiry').click();
  await normal.waitForTimeout(350);
  await visibleFocus(normal, '#enquiry-name');
  await normal.close();
  notes.push('Native dialog contains programmatic and keyboard focus; focused controls and ordinary-motion validation remain visible on a short mobile viewport.');

  console.log(JSON.stringify({ status: 'pass', notes }, null, 2));
} finally {
  await browser.close();
}
