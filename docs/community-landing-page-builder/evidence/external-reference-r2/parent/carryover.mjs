import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const checks = [];
const report = { status: 'running', mode: 'intercepted synthetic local requests only', checks };
const check = (id, name, value) => { assert.ok(value, name); checks.push({ id, name, pass: true }); };
let calls = 0;
let mode = 'held';
let held;
let sent;
try {
  await page.route('**/api/enquiry', async route => {
    calls++;
    sent = route.request().postDataJSON();
    if (mode === 'held') { held = route; return; }
    if (mode === 'failure') return route.fulfill({ status: 503, body: '{}' });
    if (mode === 'success') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, receipt: 'parent-synthetic' }) });
    if (mode === 'timeout') { held = route; return; }
  });
  await page.goto('http://127.0.0.1:4199/', { waitUntil: 'networkidle' });
  await page.locator('#name').fill('  Synthetic Parent  ');
  await page.locator('#email').fill('parent@example.test');
  await page.locator('#message').fill('Synthetic local garden office request.');
  await page.locator('#phone').fill('garbage1234567');
  await page.locator('#enquiry-form [type=submit]').click();
  check('C06', 'Mixed alphabetic phone junk rejected without a request', calls === 0 && await page.locator('#phone').getAttribute('aria-invalid') === 'true');
  await page.locator('#error-summary a').focus();
  await page.keyboard.press('Enter');
  check('C05', 'Actual error link focuses the phone input', await page.evaluate(() => document.activeElement.id === 'phone'));
  await page.locator('#phone').fill('+44 7700 900123 ext. 4');
  await page.evaluate(() => { const f = document.querySelector('#enquiry-form'); f.requestSubmit(); f.requestSubmit(); });
  await page.waitForTimeout(200);
  check('C01', 'One pending request; actual international phone representation and trimmed name submitted', calls === 1 && sent.name === 'Synthetic Parent' && sent.phone === '+44 7700 900123 ext. 4');
  check('C01', 'Pending fields cannot be edited', await page.locator('#name').isDisabled());
  await page.evaluate(() => document.querySelector('#projects').scrollIntoView());
  await page.locator('.hero [data-primary-action]').click();
  check('C01', 'Returning by primary CTA preserves pending state and original fields', await page.locator('#name').isDisabled() && await page.locator('#name').inputValue() === '  Synthetic Parent  ' && calls === 1);
  await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, receipt: 'held-synthetic' }) });
  await page.locator('#success-panel').waitFor({ state: 'visible' });
  await page.locator('.hero [data-primary-action]').click();
  check('C02', 'Returning after confirmation preserves success instead of resubmitting old fields', await page.locator('#enquiry-form').isHidden() && await page.locator('#success-panel').isVisible() && calls === 1);
  const result = await page.locator('#success-panel').boundingBox();
  check('C07', 'Success is plain preview text in a content-sized panel', result.height < 350 && (await page.locator('#success-panel').innerText()).includes('No enquiry was sent to the business.'));
  await page.locator('#success-panel').screenshot({ path: new URL('success-panel.png', import.meta.url).pathname });
  await page.locator('#new-enquiry').click();
  check('C02', 'Only deliberate New enquiry resets confirmed state', await page.locator('#name').inputValue() === '' && await page.locator('#enquiry-form').isVisible());
  await page.locator('#name').fill('Synthetic Retry');
  await page.locator('#email').fill('retry@example.test');
  await page.locator('#message').fill('Synthetic retry request.');
  mode = 'failure';
  await page.locator('#enquiry-form [type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#form-result').textContent.includes('could not confirm'));
  check('C03', 'Rejected response leaves recoverable state and original values', await page.locator('#name').inputValue() === 'Synthetic Retry' && await page.locator('#enquiry-form [type=submit]').isEnabled());
  mode = 'timeout';
  await page.locator('#enquiry-form [type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#form-result').textContent.includes('could not confirm'), null, { timeout: 10000 });
  check('C03', 'Unresolved request reaches bounded uncertain state without auto retry', calls === 3 && await page.locator('#name').inputValue() === 'Synthetic Retry' && (await page.locator('#form-result').innerText()).includes('could not confirm'));
  const late = held;
  await late.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, receipt: 'too-late' }) }).catch(() => {});
  await page.waitForTimeout(100);
  check('C01', 'Late response after timeout cannot confirm the abandoned request', await page.locator('#success-panel').isHidden());
  mode = 'success';
  await page.locator('#enquiry-form [type=submit]').click();
  await page.locator('#success-panel').waitFor({ state: 'visible' });
  check('C03', 'Deliberate same-filled retry confirms one new local request', calls === 4 && sent.name === 'Synthetic Retry');
  const images = [];
  for (const width of [390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 1280 ? 600 : 900 });
    for (const item of await page.locator('img').all()) { await item.scrollIntoViewIfNeeded(); await item.evaluate(img => img.decode().catch(() => {})); }
    images.push({ width, images: await page.locator('img').evaluateAll(items => items.map(i => ({ src: i.currentSrc, naturalWidth: i.naturalWidth, renderedWidth: i.getBoundingClientRect().width, loaded: i.complete && i.naturalWidth > 0 }))) });
  }
  check('C08/C10', 'All image placements load at five widths', images.every(v => v.images.every(i => i.loaded)));
  report.images = images;
  report.limits = ['Inline form has no modal reopen or grouped required field: those exact Stayclean variants remain unproven.', 'Intercepted requests do not prove production delivery, persistence or server idempotency.'];
  report.status = 'pass';
} catch (error) { report.status = 'blocked'; report.error = error.stack; process.exitCode = 1; }
finally { await writeFile(new URL('carryover.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
