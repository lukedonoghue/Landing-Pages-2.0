import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { checkedTarget, sameOriginUrl, loadFixture, makeReport, parseArgs, runBrowserCompat, waitForPageImages } from '../scripts/browser-compat.mjs';
import { DEFAULT_BUDGETS, extractMetrics, budgetChecks, runPerformance, readBudgets, browserLaunchFlags } from '../scripts/performance-audit.mjs';
import { ATTRIBUTION_KEYS, credentials, testRunOptions, verifyAttribution, verifyCorrelation, expectedStoredDimensions, publicChecks, runLiveVerify } from '../scripts/live-verify.mjs';
const campaignQuery = Object.fromEntries(ATTRIBUTION_KEYS.map((key,index)=>[key,`synthetic-${index + 1}`]));
campaignQuery.utm_source='google';campaignQuery.utm_medium='cpc';
const latestQuery = Object.fromEntries(ATTRIBUTION_KEYS.map((key,index)=>[key,`synthetic-latest-${index + 1}`]));
latestQuery.utm_source='google';latestQuery.utm_medium='cpc';
const expectedPolicy={analytics_mode:'disabled',attribution_mode:'lead',advertising_user_data_mode:'disabled',browser_opt_out:false};
const fixture = { synthetic: true, path: '/', thank_you_path: '/thank-you.html', pdf_path: '/guide.pdf', fields: { email: 'synthetic@example.invalid' }, selectors: { openModal: '[data-open-modal]', modal: '#lead-modal', step: '.wizard__step', next: '[data-next]', submit: '[data-submit]', closeModal: '[data-close-modal]', error: '[data-form-error]' }, query: campaignQuery, latest_query:latestQuery, excluded_query:{email:'excluded@example.invalid',token:'synthetic-secret-not-captured',unknown_campaign:'ignored-value'}, expected_policy:expectedPolicy, expected_features:{first_party_attribution:true,measured_visit:false}, expected_dimensions: { source: 'google', traffic: 'paid', device: 'desktop' } };
const temporary = t => { const dir = mkdtempSync(path.join(tmpdir(), 'funnel-verifier-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
test('container browser flags apply only to an explicit synthetic loopback CI audit', t => {
  const root = temporary(t), local = checkedTarget('http://127.0.0.1:8787');
  const args = { 'project-root': root, 'isolated-ci-fixture': true };
  writeFileSync(path.join(root, 'funnel.json'), JSON.stringify({ development_fixture: true }));
  writeFileSync(path.join(root, '.landing-pages-demo.json'), JSON.stringify({ kind: 'synthetic-local-demo' }));
  assert.ok(browserLaunchFlags(args, local, { CI: 'true' }).includes('--no-sandbox'));
  assert.ok(!browserLaunchFlags({}, local, { CI: 'true' }).includes('--no-sandbox'));
  assert.throws(() => browserLaunchFlags(args, local, {}));
  assert.throws(() => browserLaunchFlags({ ...args, 'isolated-ci-fixture': 'false' }, local, { CI: 'true' }));
  assert.throws(() => browserLaunchFlags(args, checkedTarget('https://client.example', true), { CI: 'true' }));
  writeFileSync(path.join(root, 'funnel.json'), JSON.stringify({ development_fixture: false }));
  assert.throws(() => browserLaunchFlags(args, local, { CI: 'true' }));
});
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
  assert.equal(report.status, 'pass'); assert.equal(calls.length, 3); assert.equal(calls[0].throttling.cpuSlowdownMultiplier, 4); assert.equal(calls[0].formFactor, 'mobile'); assert.deepEqual(calls[0].blockedUrlPatterns, ['*/api/leads*', '*/api/visits*', '*/api/admin/*']);
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
test('WebKit waits for a delayed image even when decode rejects, and still rejects a broken image', async () => {
  const { webkit } = await import('playwright-core');
  let release; const imageReady = new Promise(resolve => { release = resolve; });
  const server = http.createServer(async (request, response) => {
    if (request.url === '/slow.svg') { await imageReady; response.setHeader('Content-Type', 'image/svg+xml'); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>'); }
    else if (request.url === '/missing.svg') { response.statusCode = 404; response.end('missing'); }
    else { response.setHeader('Content-Type', 'text/html'); response.end(`<img width="16" height="16" src="${request.url === '/broken' ? '/missing.svg' : '/slow.svg'}">`); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch({ headless: true }); const page = await browser.newPage();
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.images[0].decode = async () => { throw new Error('Early decode rejection fixture'); }; });
    assert.equal(await page.evaluate(() => document.images[0].complete), false);
    setTimeout(release, 150);
    assert.equal(await waitForPageImages(page), true);
    await page.setContent(`<div style="height:16000px"></div><img loading="lazy" width="16" height="16" src="${url}/slow.svg?lazy">`);
    await page.route('**/slow.svg?lazy', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>' }));
    assert.equal(await waitForPageImages(page), true);
    await page.goto(url + '/broken', { waitUntil: 'domcontentloaded' });
    assert.equal(await waitForPageImages(page), false);
  } finally { release(); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
test('live test writes require explicit authorization and a synthetic fixture', () => {
  const incompleteQuery={...campaignQuery};delete incompleteQuery.dclid;
  for(const key of ['read-only','allow-test-lead','cleanup-test-lead','resume-journey'])assert.throws(()=>testRunOptions({[key]:'false'},fixture),/booleans/);
  assert.deepEqual(testRunOptions({}, fixture), { readOnly: true });
  assert.throws(() => testRunOptions({ 'allow-test-lead': true, 'read-only': true }, fixture));
  assert.throws(() => testRunOptions({ 'cleanup-test-lead': true }, fixture));
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, synthetic: false }));
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, query: { email: 'real@example.com' } }));
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, expected_policy:undefined }),/expected privacy policy/);
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, expected_policy:{...expectedPolicy,attribution_mode:'disabled'} }),/agree/);
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, query:incompleteQuery }),/all supported/);
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, latest_query:campaignQuery }),/distinct/);
  assert.throws(() => testRunOptions({ 'allow-test-lead': true }, { ...fixture, excluded_query:{gclid:'not-excluded'} }),/outside the attribution allowlist/);
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
  const disabledSubmitted={analytics_consent:false,visitor_id:''},disabledStored={lead:{...stored.lead,visit_event_id:null}};
  const unmeasured=verifyCorrelation(receipt,disabledStored,disabledSubmitted,undefined,fixture.expected_dimensions,false);
  assert.equal(Object.values(unmeasured).every(Boolean),true);
  assert.equal(unmeasured.unmeasured_visit_policy,true);assert.equal('measured_visit' in unmeasured,false);
});
test('all 16 attribution fields must survive submitted and stored first/latest touch while excluded query stays absent',()=>{
  const first={...campaignQuery,landing_page:'/',referrer:'',captured_at:'2026-09-21T00:00:00.000Z'},latest={...latestQuery,landing_page:'/',referrer:'',captured_at:'2026-09-21T00:01:00.000Z'};
  const submitted={attribution:{first_touch:{...first},latest_touch:{...latest}},landing_page:'/',referrer:''};
  const stored={lead:{attribution:{first_touch:{...first},latest_touch:{...latest}},landing_page:'/',referrer:''}};
  const expected={first_touch:campaignQuery,latest_touch:latestQuery};
  const checks=verifyAttribution(submitted,stored,expected,fixture.excluded_query);
  assert.equal(Object.keys(checks).length,ATTRIBUTION_KEYS.length*4+2);
  assert.equal(Object.values(checks).every(Boolean),true);
  delete stored.lead.attribution.latest_touch.dclid;
  assert.equal(verifyAttribution(submitted,stored,expected,fixture.excluded_query).stored_latest_touch_dclid,false);
  stored.lead.attribution.latest_touch.dclid=latestQuery.dclid;submitted.attribution.first_touch.token=fixture.excluded_query.token;
  assert.equal(verifyAttribution(submitted,stored,expected,fixture.excluded_query).excluded_query_absent_from_submitted_context,false);
});
test('sync config enforces requested attribution and supports unified or distinct host routing',t=>{
  const root=temporary(t);mkdirSync(path.join(root,'scripts'),{recursive:true});mkdirSync(path.join(root,'src'),{recursive:true});
  copyFileSync(new URL('../scripts/sync-config.mjs',import.meta.url),path.join(root,'scripts/sync-config.mjs'));
  copyFileSync(new URL('../wrangler.jsonc',import.meta.url),path.join(root,'wrangler.jsonc'));
  writeFileSync(path.join(root,'package.json'),JSON.stringify({type:'module'}));writeFileSync(path.join(root,'src/site-config.json'),'{}');
  const base={client:{name:'Synthetic'},form_fields:[{name:'email',type:'email',required:true}],analytics:{mode:'disabled',attribution_mode:'lead',required_attribution_mode:'lead'},privacy:{consent_ui:'disabled'},tracking:{customer_data_mode:'disabled',gtm:{container_id:''}}};
  const run=value=>{writeFileSync(path.join(root,'funnel.json'),JSON.stringify(value));return spawnSync(process.execPath,['scripts/sync-config.mjs'],{cwd:root,encoding:'utf8'});};
  let result=run({...base,requested_hosts:{public:'',crm:''}});assert.equal(result.status,0,result.stderr);let site=JSON.parse(readFileSync(path.join(root,'src/site-config.json')));assert.equal(site.attributionMode,'lead');assert.equal(site.publicHost,'');assert.equal(site.crmHost,'');
  result=run({...base,requested_hosts:{public:'public.example',crm:''}});assert.notEqual(result.status,0);assert.match(result.stderr,/distinct public and CRM hostnames, or neither/);
  result=run({...base,requested_hosts:{public:'same.example',crm:'same.example'}});assert.notEqual(result.status,0);assert.match(result.stderr,/distinct public and CRM hostnames, or neither/);
  result=run({...base,requested_hosts:{public:'public.example',crm:'crm.example',pages_gateway:'synthetic-gateway.pages.dev'}});assert.equal(result.status,0,result.stderr);site=JSON.parse(readFileSync(path.join(root,'src/site-config.json')));assert.equal(site.publicHost,'public.example');assert.equal(site.crmHost,'crm.example');assert.equal(site.pagesGatewayHost,'synthetic-gateway.pages.dev');
  result=run({...base,requested_hosts:{public:'public.example',crm:'crm.example',pages_gateway:'preview.example.com'}});assert.notEqual(result.status,0);assert.match(result.stderr,/exact production pages.dev hostname/);
  result=run({...base,requested_hosts:{public:'',crm:'',pages_gateway:'synthetic-gateway.pages.dev'}});assert.notEqual(result.status,0);assert.match(result.stderr,/requires both public and CRM hostnames/);
  result=run({...base,analytics:{...base.analytics,attribution_mode:'disabled'}});assert.notEqual(result.status,0);assert.match(result.stderr,/Required attribution mode lead/);
  result=run({...base,analytics:{mode:'disabled',attribution_mode:'disabled'}});assert.notEqual(result.status,0);assert.match(result.stderr,/required_attribution_mode explicitly/);
  result=run({...base,analytics:{mode:'disabled',attribution_mode:'disabled',required_attribution_mode:'disabled'}});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(readFileSync(path.join(root,'src/site-config.json'))).attributionMode,'disabled');
});
test('preflight blocks attribution drift without selecting a global policy',t=>{
  const root=temporary(t);for(const dir of ['scripts','src','public'])mkdirSync(path.join(root,dir),{recursive:true});
  for(const name of ['preflight','free-plan'])copyFileSync(new URL(`../scripts/${name}.mjs`,import.meta.url),path.join(root,`scripts/${name}.mjs`));
  writeFileSync(path.join(root,'scripts/check_gates.py'),'raise SystemExit(0)\n');writeFileSync(path.join(root,'package.json'),JSON.stringify({type:'module'}));
  writeFileSync(path.join(root,'wrangler.jsonc'),JSON.stringify({name:'config-fixture',assets:{run_worker_first:true},d1_databases:[{database_id:'11111111-1111-4111-8111-111111111111'}]}));
  const html='<script src="funnel.js"></script><a class="brand">Synthetic client</a>';for(const name of ['index.html','thank-you.html','privacy.html'])writeFileSync(path.join(root,'public',name),html);for(const name of ['funnel.js','privacy-controls.js','privacy-controls.css'])writeFileSync(path.join(root,'public',name),'fixture');
  writeFileSync(path.join(root,'funnel.json'),JSON.stringify({analytics:{attribution_mode:'lead',required_attribution_mode:'lead'}}));
  writeFileSync(path.join(root,'src/site-config.json'),JSON.stringify({name:'Synthetic client',attributionMode:'disabled'}));
  const run=()=>spawnSync(process.execPath,['scripts/preflight.mjs'],{cwd:root,encoding:'utf8'});let result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Attribution policy drift/);
  writeFileSync(path.join(root,'src/site-config.json'),JSON.stringify({name:'Synthetic client',attributionMode:'lead'}));result=run();assert.equal(result.status,0,result.stderr);
  writeFileSync(path.join(root,'funnel.json'),JSON.stringify({analytics:{attribution_mode:'lead'}}));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/omission cannot bypass attribution protection/);
  writeFileSync(path.join(root,'funnel.json'),JSON.stringify({}));writeFileSync(path.join(root,'src/site-config.json'),JSON.stringify({name:'Synthetic client'}));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/omission cannot bypass attribution protection/);
});
test('disabled attribution verifies the dimensions the Worker actually stores', () => {
  const browserDimensions={source:'google',traffic:'paid',device:'desktop'};
  assert.deepEqual(expectedStoredDimensions({ attribution_mode: 'disabled' }, browserDimensions), { source: 'unknown', traffic: 'unknown', device: 'unknown' });
  assert.equal(expectedStoredDimensions({ attribution_mode: 'consent' }, browserDimensions), browserDimensions);
});
async function serverFixture(t, options = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, method: req.method, cookie: req.headers.cookie, authorization: req.headers.authorization });
    const route = decodeURIComponent(req.url);
    if (route === '/api/health') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, database: 'connected' })); }
    else if (route === '/api/privacy-config') { res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(options.policy||expectedPolicy)); }
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
  for (const name of ['local-journey.json', 'crm.json', 'tracking.json', 'deployment.json']) writeFileSync(path.join(out, name), 'old synthetic report');
  const report = await runLiveVerify({ url: target.url.href, fixture, out, 'read-only': true }, { env: { ADMIN_USERNAME: 'not-to-send', ADMIN_PASSWORD: 'do-not-send' } });
  assert.equal(report.status, 'pass_with_warnings'); assert.equal(report.fully_verified, false); assert.equal(report.readiness, 'public-checks-only');
  assert.equal(requests.every(row => row.method === 'GET' && !row.cookie && !row.authorization), true);
  assert.equal(JSON.stringify(report).includes('do-not-send'), false);
  assert.equal(report.artifacts.some(row => row.type === 'http_trace'), true);
  for (const name of ['local-journey.json', 'crm.json', 'tracking.json', 'deployment.json']) assert.throws(() => readFileSync(path.join(out, name)), /ENOENT/);
});
test('public access or a fake PDF blocks live verification', async t => {
  const { target } = await serverFixture(t, { exposed: true, brokenPdf: true });
  const report = makeReport('deployment', target); await publicChecks(target, fixture, report);
  assert.ok(report.failures.includes('/api/admin/leads rejects anonymous requests'));
  assert.ok(report.failures.includes('Brochure is a real downloadable PDF'));
});
test('requested attribution cannot pass public checks when runtime capture is disabled',async t=>{
  const target=checkedTarget('http://localhost:8787'),report=makeReport('deployment',target);
  const fetcher=async url=>{
    if(url.pathname==='/api/health')return Response.json({ok:true,database:'connected'});
    if(url.pathname==='/api/privacy-config')return Response.json({...expectedPolicy,attribution_mode:'disabled'},{headers:{'Cache-Control':'no-store'}});
    if(url.pathname.startsWith('/api/'))return new Response('{}',{status:401});
    if(url.pathname.startsWith('/admin/'))return new Response('',{status:302,headers:{Location:'/login.html'}});
    if(url.pathname===fixture.pdf_path)return new Response('%PDF-1.7 fixture');
    return new Response('<!doctype html>',{headers:{'Content-Type':'text/html'}});
  };
  await publicChecks(target,fixture,report,fetcher);
  assert.ok(report.failures.includes('Runtime privacy policy matches the fixture expectation'));
  assert.ok(report.failures.includes('Requested first-party attribution feature is available'));
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
