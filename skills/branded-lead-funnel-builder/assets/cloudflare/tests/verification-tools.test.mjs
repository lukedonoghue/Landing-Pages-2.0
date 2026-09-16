import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { checkedTarget, sameOriginUrl, loadFixture, makeReport, parseArgs, runBrowserCompat } from '../scripts/browser-compat.mjs';
import { DEFAULT_BUDGETS, extractMetrics, budgetChecks, runPerformance, readBudgets } from '../scripts/performance-audit.mjs';
import { credentials, testRunOptions, verifyCorrelation, publicChecks, runLiveVerify } from '../scripts/live-verify.mjs';
const fixture = { synthetic: true, path: '/', thank_you_path: '/thank-you.html', pdf_path: '/guide.pdf', fields: { email: 'synthetic@example.invalid' }, selectors: { openModal: '[data-open-modal]', modal: '#lead-modal', step: '.wizard__step', next: '[data-next]', submit: '[data-submit]', closeModal: '[data-close-modal]', error: '[data-form-error]' }, query: { utm_source: 'google', utm_medium: 'cpc' }, expected_dimensions: { source: 'google', traffic: 'paid', device: 'desktop' } };
const temporary = t => { const dir = mkdtempSync(path.join(tmpdir(), 'funnel-verifier-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
const lhr = (values = {}) => ({ lighthouseVersion: '13-test', categories: { performance: { score: 0.95 } }, audits: { 'largest-contentful-paint': { numericValue: 1500 }, 'cumulative-layout-shift': { numericValue: 0.02 }, 'total-blocking-time': { numericValue: 100 } }, ...values });

test('verification is local-only unless HTTPS remote access is explicit', () => {
  assert.equal(checkedTarget('http://127.0.0.1:8787').local, true);
  for (const url of ['https://example.com', 'http://example.com', 'https://user:password@example.com', 'https://example.com/?token=secret', 'file:///tmp/page']) assert.throws(() => checkedTarget(url));
  assert.equal(checkedTarget('https://example.com', true).local, false);
  assert.throws(() => checkedTarget('http://example.com', true));
  assert.throws(() => sameOriginUrl('//evil.example/data', new URL('https://example.com')));
});
test('fixtures require explicit paths, actual field values, and selectors', () => {
  assert.equal(loadFixture(fixture), fixture);
  assert.throws(() => loadFixture({ fields: {} }));
  assert.throws(() => loadFixture({ ...fixture, pdf_path: '//elsewhere.com/file.pdf' }));
  assert.throws(() => loadFixture({ ...fixture, selectors: {} }));
});
test('named options and current source snapshot bind evidence', t => {
  const root = temporary(t); mkdirSync(path.join(root, 'build'));
  writeFileSync(path.join(root, 'build/gate-snapshot.json'), JSON.stringify({ source_fingerprint: 'samplehash', mode: 'handoff' }));
  const args = parseArgs(['--url', 'http://localhost:8787', '--project-root', root, '--read-only']);
  const report = makeReport('performance', checkedTarget(args.url), args);
  assert.equal(args['read-only'], true); assert.equal(report.source_fingerprint, 'samplehash'); assert.equal(report.target.mode, 'handoff'); assert.ok(report.executed_at);
});
test('mobile budgets reject nonnumbers and use measured LCP CLS and TBT', () => {
  assert.deepEqual(readBudgets({}), DEFAULT_BUDGETS);
  assert.throws(() => readBudgets({ 'lcp-max': 'fast' }));
  const metrics = extractMetrics(lhr());
  assert.equal(metrics.performance, 95); assert.equal(metrics.lcp_ms, 1500);
  assert.equal(budgetChecks(metrics, DEFAULT_BUDGETS).every(row => row.passed), true);
  assert.equal(budgetChecks({ ...metrics, tbt_ms: 201 }, DEFAULT_BUDGETS).find(row => row.name === 'tbt_ms').passed, false);
  assert.throws(() => extractMetrics(lhr({ audits: {} })));
  assert.throws(() => extractMetrics(lhr({ runtimeError: { code: 'PAGE_HUNG' } })));
});
test('Lighthouse saves raw measurements, uses three mobile runs, and blocks API writes', async t => {
  const out = temporary(t), calls = []; let killed = false;
  const report = await runPerformance({ url: 'http://localhost:8787', out }, { launch: async () => ({ port: 9999, kill: async () => { killed = true; } }), lighthouse: async (url, options) => { calls.push(options); return { lhr: lhr() }; } });
  assert.equal(report.status, 'pass'); assert.equal(calls.length, 3); assert.equal(calls[0].throttling.cpuSlowdownMultiplier, 4); assert.equal(calls[0].formFactor, 'mobile'); assert.deepEqual(calls[0].blockedUrlPatterns, ['*/api/*']);
  assert.equal(report.artifacts.length, 3); assert.equal(report.metrics.lcp_ms, 1500); assert.equal(killed, true); assert.equal(JSON.parse(readFileSync(path.join(out, 'lighthouse-mobile-1.json'))).lighthouseVersion, '13-test');
});
test('failed or missing lab measurements cannot pass and errors do not leak secrets', async t => {
  const out = temporary(t);
  const report = await runPerformance({ url: 'http://localhost:8787', out }, { launch: async () => { throw new Error('secret-password-do-not-print'); }, lighthouse: async () => ({ lhr: lhr() }) });
  assert.equal(report.status, 'blocked'); assert.equal(JSON.stringify(report).includes('secret-password'), false);
  const slow = await runPerformance({ url: 'http://localhost:8787', out, runs: '1' }, { launch: async () => ({ port: 1, kill: async () => {} }), lighthouse: async () => ({ lhr: lhr({ categories: { performance: { score: 0.7 } } }) }) });
  assert.equal(slow.status, 'blocked');
});
test('missing Chromium and WebKit binaries are blocked, never skipped green', async t => {
  const out = temporary(t); const missing = { launch: async () => { throw new Error('executable missing'); } };
  const report = await runBrowserCompat({ url: 'http://localhost:8787', fixture, out }, { chromium: missing, webkit: missing });
  assert.equal(report.status, 'blocked'); assert.equal(report.engines.length, 2); assert.equal(report.engines.every(row => row.status === 'blocked'), true);
});
test('live test writes require explicit authorization and a synthetic fixture', () => {
  assert.deepEqual(testRunOptions({}, fixture), { readOnly: true });
  assert.throws(() => testRunOptions({ 'allow-test-lead': true, 'read-only': true }, fixture));
  assert.throws(() => testRunOptions({ 'cleanup-test-lead': true }, fixture));
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, synthetic: false }));
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, query: { email: 'real@example.com' } }));
  assert.deepEqual(testRunOptions({ 'allow-test-lead': true }, fixture), { readOnly: false });
});
test('credential helpers use environment/private files, never credential CLI arguments', t => {
  const out = temporary(t), filename = path.join(out, 'private.json');
  writeFileSync(filename, JSON.stringify({ username: 'admin@example.invalid', password: 'not-a-real-password' }));
  assert.equal(credentials({ 'credentials-file': filename }, {}).username, 'admin@example.invalid');
  assert.equal(credentials({}, { ADMIN_USERNAME: 'name', ADMIN_PASSWORD: 'secret' }).password, 'secret');
  assert.throws(() => credentials({ username: 'name', password: 'secret' }, {}));
});
test('receipt proof rejects mismatched CRM receipt, missing consent, and wrong source', () => {
  const id = '01234567-89ab-4def-8123-456789abcdef', event = 'f1234567-89ab-4def-8123-456789abcdef';
  const receipt = { ok: true, lead_id: id, receipt_id: id }, stored = { lead: { id, receipt_id: id, visit_event_id: event, traffic_source: 'google', traffic_type: 'paid', device: 'desktop' } };
  const submitted = { analytics_consent: true, visitor_id: id, visit_event_id: event }, visit = { measured: true, event_id: event };
  assert.equal(Object.values(verifyCorrelation(receipt, stored, submitted, visit, fixture.expected_dimensions)).every(Boolean), true);
  assert.equal(verifyCorrelation(receipt, { lead: { ...stored.lead, receipt_id: event } }, submitted, visit, fixture.expected_dimensions).persisted_receipt, false);
  assert.equal(verifyCorrelation(receipt, stored, { ...submitted, analytics_consent: false }, visit, fixture.expected_dimensions).measured_visit, false);
  assert.equal(verifyCorrelation(receipt, stored, submitted, visit, { ...fixture.expected_dimensions, source: 'facebook' }).traffic_dimensions, false);
});
async function serverFixture(t, options = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, method: req.method, cookie: req.headers.cookie, authorization: req.headers.authorization });
    const route = decodeURIComponent(req.url);
    if (route === '/api/health') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, database: 'connected' })); }
    else if (route.startsWith('/api/')) { res.statusCode = options.exposed ? 200 : 401; res.end('{}'); }
    else if (route.startsWith('/admin/')) { res.statusCode = 302; res.setHeader('Location', '/login.html'); res.end(); }
    else if (route === '/guide.pdf') res.end(options.brokenPdf ? 'not a pdf' : '%PDF-1.7\nFixture');
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Fixture</title>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { target: checkedTarget(`http://127.0.0.1:${server.address().port}`), requests };
}
test('read-only live checks use real HTTP but perform no login or form writes and remain partial', async t => {
  const { target, requests } = await serverFixture(t), out = temporary(t);
  const report = await runLiveVerify({ url: target.url.href, fixture, out, 'read-only': true }, { env: { ADMIN_USERNAME: 'not-to-send', ADMIN_PASSWORD: 'do-not-send' } });
  assert.equal(report.status, 'pass_with_warnings'); assert.equal(report.fully_verified, false); assert.equal(report.readiness, 'public-checks-only');
  assert.equal(requests.every(row => row.method === 'GET' && !row.cookie && !row.authorization), true);
  assert.equal(JSON.stringify(report).includes('do-not-send'), false);
  assert.equal(report.artifacts.some(row => row.type === 'http_trace'), true);
});
test('public access or a fake PDF blocks live verification', async t => {
  const { target } = await serverFixture(t, { exposed: true, brokenPdf: true });
  const report = makeReport('deployment', target); await publicChecks(target, fixture, report);
  assert.ok(report.failures.includes('/api/admin/leads rejects anonymous requests'));
  assert.ok(report.failures.includes('Brochure is a real downloadable PDF'));
});
test('cross-origin public resource redirects cannot leak a verification request', async () => {
  const target = checkedTarget('http://localhost:8787'), report = makeReport('deployment', target);
  let remoteRequested = false;
  const fetcher = async url => {
    if (url.hostname !== 'localhost') remoteRequested = true;
    if (url.pathname === '/api/health') return Response.json({ ok: true, database: 'connected' });
    if (url.pathname.startsWith('/api/')) return new Response('{}', { status: 401 });
    if (url.pathname.includes('admin')) return new Response('', { status: 302, headers: { Location: '/login.html' } });
    return new Response('', { status: 302, headers: { Location: 'https://unrelated.example/secret' } });
  };
  await assert.rejects(publicChecks(target, fixture, report, fetcher)); assert.equal(remoteRequested, false);
});
