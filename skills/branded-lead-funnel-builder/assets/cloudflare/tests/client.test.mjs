import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright-core';

const trackingCode = await readFile(new URL('../public/funnel.js', import.meta.url), 'utf8');
function tracker({ mode = 'consent', stored = {}, privacy = {}, blockedStorage = false, hangingVisit = false, sharedMemory, url = 'https://site.test/?utm_source=google&gclid=test-click&email=discard', referrer = 'https://example.com/article?private=discard', measure = true, visitOk = true, visitResult } = {}) {
  const memory = sharedMemory || new Map(Object.entries(stored).map(([key, value]) => [`funnel_v2_${key}`, JSON.stringify(value)]));
  const requests = [];
  const storage = { getItem(key) { if (blockedStorage) throw new Error('Storage blocked'); return memory.get(key) || null; }, setItem(key, value) { if (blockedStorage) throw new Error('Storage blocked'); memory.set(key, value); }, removeItem(key) { if (blockedStorage) throw new Error('Storage blocked'); memory.delete(key); } };
  const environment = { document: { currentScript: { dataset: { analyticsMode: mode, measure: String(measure) } }, referrer, querySelectorAll: () => [], querySelector: () => null }, location: new URL(url), navigator: privacy, crypto, URL, URLSearchParams, Map, Date, Promise, JSON, setTimeout, clearTimeout, localStorage: storage, sessionStorage: storage, fetch: async (url, options) => { const body = JSON.parse(options.body); requests.push({ url, body }); return hangingVisit ? new Promise(() => {}) : { ok: visitOk, json: async () => visitResult || { measured: true, event_id: body.event_id, duplicate: false } }; } };
  environment.window = environment;
  runInNewContext(trackingCode, environment);
  return { environment, requests, memory, funnel: environment.LeadFunnel };
}
test('declined, disabled, DNT and GPC sessions send no visit or conversion event', async () => {
  for (const options of [{ stored: { analytics_consent: false } }, { mode: 'disabled', stored: { analytics_consent: true } }, { mode: 'essential', privacy: { doNotTrack: '1' } }, { mode: 'essential', privacy: { globalPrivacyControl: true } }]) {
    const state = tracker(options); const context = await state.funnel.context();
    assert.equal(context.analytics_consent, false); assert.equal(context.visitor_id, ''); assert.equal(context.visit_event_id, undefined);
    state.funnel.accepted({ ok: true, lead_id: 'lead', receipt_id: 'receipt', duplicate: false });
    assert.equal(state.requests.length, 0); assert.equal(state.environment.dataLayer, undefined);
  }
});
test('consent acceptance measures a stable browser ID without passing contact data', async () => {
  const state = tracker(); assert.equal(state.requests.length, 0);
  state.funnel.setConsent(true);
  const first = await state.funnel.context(); const second = await state.funnel.context();
  assert.equal(first.visitor_id, second.visitor_id); assert.match(first.visitor_id, /^[a-f0-9-]{36}$/);
  assert.equal(state.requests.length, 1); assert.deepEqual(Object.keys(state.requests[0].body).sort(), ['analytics_consent', 'attribution', 'event_id', 'path', 'referrer', 'visitor_id']);
  assert.equal(first.visit_event_id, state.requests[0].body.event_id); assert.equal(second.visit_event_id, first.visit_event_id);
  assert.deepEqual(state.requests[0].body.attribution, { utm_source: 'google', gclid: 'test-click' });
  assert.equal(state.requests[0].body.referrer, 'https://example.com/article'); assert.equal(state.requests[0].body.path, '/');
  assert.ok(!JSON.stringify(state.requests[0].body).includes('discard'));
  assert.equal(first.landing_page, 'https://site.test/'); assert.equal(first.referrer, 'https://example.com/article');
  assert.equal(first.attribution.first_touch.utm_source, 'google'); assert.ok(!('email' in first.attribution.first_touch));
  state.funnel.accepted({ ok: true, lead_id: 'lead', receipt_id: 'receipt', duplicate: false });
  state.funnel.accepted({ ok: true, lead_id: 'lead', receipt_id: 'receipt', duplicate: true });
  assert.equal(state.environment.dataLayer.length, 1);
  state.funnel.setConsent(false); assert.equal((await state.funnel.context()).visitor_id, '');
  assert.equal(state.memory.has('funnel_v2_visitor_id'), false);
});
test('repeat consent actions preserve this navigation event and visitor without exposing either while declined', async () => {
  const state = tracker({ mode: 'consent' }); state.funnel.setConsent(true);
  const initial = await state.funnel.context();
  state.funnel.setConsent(true); await state.funnel.context();
  state.funnel.setConsent(false);
  const declined = await state.funnel.context();
  assert.equal(declined.visitor_id, ''); assert.equal(declined.visit_event_id, undefined);
  assert.equal(state.memory.has('funnel_v2_visitor_id'), false);
  state.funnel.setConsent(true); const resumed = await state.funnel.context();
  assert.equal(state.requests.length, 3);
  assert.equal(new Set(state.requests.map(request => request.body.event_id)).size, 1);
  assert.equal(new Set(state.requests.map(request => request.body.visitor_id)).size, 1);
  assert.equal(resumed.visit_event_id, initial.visit_event_id); assert.equal(resumed.visitor_id, initial.visitor_id);
});
test('accepted receipts emit once even when the first response is an idempotent retry', () => {
  const state = tracker({ mode: 'essential' });
  const receipt = { ok: true, lead_id: 'lead', receipt_id: 'retry-receipt', duplicate: true };
  state.funnel.accepted(receipt);
  assert.equal(state.environment.dataLayer?.length, 1, 'The first confirmed retry receipt must emit');
  state.funnel.accepted({ ...receipt, duplicate: false });
  state.funnel.accepted(receipt);
  assert.equal(state.environment.dataLayer?.length, 1);
  assert.equal(state.environment.dataLayer[0].receipt_id, receipt.receipt_id);
  const resumed = tracker({ mode: 'essential', sharedMemory: state.memory, measure: false });
  assert.equal(resumed.environment.dataLayer, undefined, 'Loading a thank-you page emits nothing');
  resumed.funnel.accepted(receipt);
  assert.equal(resumed.environment.dataLayer, undefined, 'The session remembers an emitted receipt');
});
test('repeated ordinary receipts deduplicate and distinct committed leads remain measurable', () => {
  const state = tracker({ mode: 'essential' });
  for (const id of ['one', 'one', 'two', 'two']) state.funnel.accepted({ ok: true, lead_id: id, receipt_id: id, duplicate: false });
  assert.deepEqual(Array.from(state.environment.dataLayer, event => event.receipt_id), ['one', 'two']);
});
test('receipt deduplication works without browser storage and rejects uncommitted responses', () => {
  const state = tracker({ mode: 'essential', blockedStorage: true });
  for (const result of [null, {}, { ok: false, lead_id: 'a', receipt_id: 'a' }, { ok: true, receipt_id: 'a' }]) state.funnel.accepted(result);
  assert.equal(state.environment.dataLayer, undefined);
  const receipt = { ok: true, lead_id: 'lead', receipt_id: 'stored-receipt', duplicate: true };
  state.funnel.accepted(receipt); state.funnel.accepted(receipt);
  assert.equal(state.environment.dataLayer.length, 1);
});
test('a direct navigation records current source independently from retained paid lead attribution', async () => {
  const paid = tracker({ mode: 'essential', referrer: '' }); const first = await paid.funnel.context();
  const direct = tracker({ mode: 'essential', url: 'https://site.test/?email=discard#secret', referrer: '', sharedMemory: paid.memory });
  const next = await direct.funnel.context();
  assert.deepEqual(direct.requests[0].body.attribution, {}); assert.equal(direct.requests[0].body.referrer, '');
  assert.equal(next.attribution.first_touch.utm_source, 'google'); assert.equal(next.attribution.latest_touch.gclid, 'test-click');
  assert.equal(next.visitor_id, first.visitor_id); assert.notEqual(next.visit_event_id, first.visit_event_id);
  assert.equal(next.landing_page, 'https://site.test/');
});
test('new campaign visits use current source while retaining the original CRM first touch', async () => {
  const first = tracker({ mode: 'essential', referrer: '' }); await first.funnel.context();
  const second = tracker({ mode: 'essential', url: 'https://site.test/offer?utm_source=facebook&utm_medium=paid_social&fbclid=facebook-click&name=discard', referrer: 'https://facebook.com/ad?contact=discard#private', sharedMemory: first.memory });
  const context = await second.funnel.context(); const visit = second.requests[0].body;
  assert.deepEqual(visit.attribution, { utm_source: 'facebook', utm_medium: 'paid_social', fbclid: 'facebook-click' });
  assert.equal(visit.path, '/offer'); assert.equal(visit.referrer, 'https://facebook.com/ad');
  assert.equal(context.attribution.first_touch.utm_source, 'google'); assert.equal(context.attribution.latest_touch.utm_source, 'facebook');
  assert.ok(!JSON.stringify(visit).includes('discard'));
});
test('internal navigation referrers do not classify as an external traffic source', async () => {
  const state = tracker({ mode: 'essential', url: 'https://site.test/offer', referrer: 'https://site.test/other?email=discard' });
  await state.funnel.context(); assert.equal(state.requests[0].body.referrer, '');
});
test('unmeasured pages and unsuccessful analytics responses do not claim a measured visit', async () => {
  for (const options of [{ measure: false }, { visitOk: false }, { visitResult: { measured: false } }, { visitResult: { measured: true, event_id: 'different-event' } }]) {
    const state = tracker({ mode: 'essential', ...options }); const context = await state.funnel.context();
    assert.equal(context.visit_event_id, undefined);
    if (options.measure === false) assert.equal(state.requests.length, 0);
  }
});
test('blocked browser storage still preserves attribution and submission context for this page', async () => {
  const state = tracker({ blockedStorage: true }); state.funnel.setConsent(true);
  const a = await state.funnel.context(); const b = await state.funnel.context();
  assert.equal(a.visitor_id, b.visitor_id); assert.equal(a.attribution.first_touch.gclid, 'test-click');
  assert.equal(a.visit_event_id, state.requests[0].body.event_id); assert.equal(a.visit_event_id, b.visit_event_id);
  state.funnel.accepted({ ok: true, lead_id: 'lead', receipt_id: 'receipt', duplicate: false });
  assert.equal(state.funnel.receipt().receipt_id, 'receipt');
});
test('an analytics request that hangs cannot indefinitely block lead submission', async () => {
  const state = tracker({ mode: 'essential', hangingVisit: true });
  const start = Date.now(); const context = await state.funnel.context();
  assert.equal(context.analytics_consent, true); assert.equal(context.visit_event_id, undefined); assert.ok(Date.now() - start < 2200);
});

const chromePath = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(path => path && existsSync(path));
let browser, server, base; let scenario = 'ok'; let submissions = [];
before(async () => {
  if (!chromePath) return;
  server = createServer(async (request, response) => {
    if (request.url === '/lightbox.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile([new URL('../public/script.js', import.meta.url),new URL('../../multistep-lightbox.js', import.meta.url)].find(existsSync), 'utf8')); return; }
    if (request.url === '/api/leads') {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      submissions.push(JSON.parse(Buffer.concat(chunks).toString()));
      if (scenario === 'timeout-once' && submissions.length === 1) { response.setHeader('Content-Type', 'application/json'); response.writeHead(200); response.flushHeaders(); return; }
      response.setHeader('Content-Type', 'application/json');
      if (scenario === 'stall-body') { response.writeHead(200); response.flushHeaders(); return; }
      if (scenario === 'missing-id') { response.end(JSON.stringify({ ok: true, receipt_id: 'receipt' })); return; }
      if (scenario === 'pending') { await new Promise(resolve => setTimeout(resolve, 250)); }
      response.end(JSON.stringify({ ok: true, lead_id: 'lead', receipt_id: 'receipt', duplicate: scenario === 'timeout-once' })); return;
    }
    if (request.url?.startsWith('/thank-you.html')) { response.setHeader('Content-Type', 'text/html'); response.end('<h1>Thank you</h1>'); return; }
    const fragment = await readFile(new URL('./fixtures/lightbox.html', import.meta.url), 'utf8');
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html><html><head><style>[aria-hidden=true]{display:none}label{display:block}</style></head><body>${fragment}<script src="/lightbox.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
});
after(async () => { await browser?.close(); server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); });
async function preparedPage(timeout = 1000) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.addInitScript(() => {
    window.__lightboxTrace = [];
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'focusin', 'invalid']) {
      document.addEventListener(type, event => {
        const target = event.target;
        window.__lightboxTrace.push({ event: type, at: Math.round(performance.now()), target: target.name || target.tagName, tag: target.tagName, text: target.tagName === 'BUTTON' ? target.textContent : undefined, step: document.querySelector('[data-step-current]')?.textContent });
        if (window.__lightboxTrace.length > 40) window.__lightboxTrace.shift();
      }, true);
    }
  });
  try {
    await page.goto(base); await page.locator('[data-open-modal]').click();
    await page.locator('[name=first_name]').fill('Alex'); await page.locator('[name=last_name]').fill('Example');
    await page.locator('[name=email]').fill('alex@example.invalid'); await page.locator('[name=phone]').fill('+44 7700 900123');
    await page.locator('[data-next]').click(); await page.locator('[name=service]').selectOption({ label: 'Service one' });
    await page.locator('[data-next]').click(); await page.locator('[name=contact_method][value=Email]').check();
    await page.locator('form').evaluate((form, value) => { form.dataset.webhookTimeout = String(value); }, timeout);
    return page;
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({ step: document.querySelector('[data-step-current]')?.textContent, modal: document.querySelector('#lead-modal')?.getAttribute('aria-hidden'), active: document.activeElement?.getAttribute('name'), fields: [...document.querySelectorAll('input,select')].map(field => ({ name: field.name, populated: Boolean(field.value), valid: field.checkValidity(), disabled: field.disabled, visible: Boolean(field.getClientRects().length) })), trace: window.__lightboxTrace })).catch(() => ({ url: page.url() }));
    await page.close();
    throw new Error(`Form setup failed: ${error.message}\nState: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
}
const browserOptions = { skip: !chromePath ? 'Set CHROME_BIN to run isolated real-browser regression tests.' : false };
test('modal opening skips the hidden honeypot, traps keyboard focus and restores its trigger', browserOptions, async () => {
  scenario = 'ok'; submissions = []; const page = await browser.newPage();
  try {
    await page.goto(base);
    await page.evaluate(() => { const outside = document.createElement('a'); outside.href = '#outside'; outside.textContent = 'Outside the modal'; document.body.append(outside); });
    await page.locator('[data-open-modal]').click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'first_name', null, { timeout: 2000 });
    assert.equal(await page.locator('[name=website]').isVisible(), false);
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press(key);
        const focus = await page.evaluate(() => ({ inside: document.querySelector('#lead-modal').contains(document.activeElement), visible: document.activeElement.getClientRects().length > 0, name: document.activeElement.getAttribute('name') }));
        assert.equal(focus.inside, true, `${key} ${i + 1} escaped the modal`);
        assert.equal(focus.visible, true, `${key} ${i + 1} focused a hidden control`);
        assert.notEqual(focus.name, 'website');
      }
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lead-modal').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('[data-open-modal]').evaluate(trigger => trigger === document.activeElement), true);
    assert.equal(submissions.length, 0);
  } finally { await page.close(); }
});
test('form requires both lead and receipt IDs before showing thank-you', browserOptions, async () => {
  scenario = 'missing-id'; submissions = []; const page = await preparedPage();
  try {
    await page.locator('[data-submit]').click();
    await page.waitForFunction(() => { const error = document.querySelector('[data-form-error]'); return error && !error.hidden; }, null, { timeout: 2000 });
    assert.ok(!page.url().includes('thank-you')); assert.equal(await page.locator('[data-submit]').isDisabled(), false);
  } finally { await page.close(); }
});
test('response-body stalls time out and make retry available', browserOptions, async () => {
  scenario = 'stall-body'; submissions = []; const page = await preparedPage(120);
  try {
    await page.locator('[data-submit]').click();
    await page.waitForFunction(() => { const error = document.querySelector('[data-form-error]'); return error && !error.hidden; }, null, { timeout: 2000 });
    assert.equal(await page.locator('[data-submit]').isDisabled(), false); assert.ok(!page.url().includes('thank-you'));
  } finally { await page.close(); }
});
test('pending submission prevents navigation and duplicate submits', browserOptions, async () => {
  scenario = 'pending'; submissions = []; const page = await preparedPage();
  try {
    await page.locator('[data-submit]').click();
    assert.equal(await page.locator('[data-back]').isDisabled(), true);
    await page.locator('form').dispatchEvent('submit');
    await page.waitForURL('**/thank-you.html'); assert.equal(submissions.length, 1);
  } finally { await page.close(); }
});
test('Enter while reviewing an earlier completed step advances without submitting', browserOptions, async () => {
  scenario = 'ok'; submissions = []; const page = await preparedPage();
  try {
    await page.locator('[data-back]').click(); await page.locator('[data-back]').click();
    await page.locator('[name=email]').press('Enter');
    assert.equal(await page.locator('[data-step-current]').textContent(), '2'); assert.equal(submissions.length, 0);
  } finally { await page.close(); }
});
test('a lost response retries the same submission ID and form payload', browserOptions, async () => {
  scenario = 'timeout-once'; submissions = []; const page = await preparedPage();
  try {
    await page.locator('[data-submit]').click(); await page.waitForFunction(() => { const error = document.querySelector('[data-form-error]'); return error && !error.hidden; });
    await page.locator('[data-submit]').click(); await page.waitForURL('**/thank-you.html');
    assert.equal(submissions.length, 2); assert.equal(submissions[0].idempotency_key, submissions[1].idempotency_key);
    assert.deepEqual(submissions[0].form_data, submissions[1].form_data); assert.ok(!('website' in submissions[0].form_data));
  } finally { await page.close(); }
});
