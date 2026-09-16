/** Browser -> accepted receipt -> authenticated CRM read -> reporting proof.
 * Live writes require --allow-remote --allow-test-lead and a reviewed synthetic fixture.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomic, runtimeIdentity } from './release-tools.mjs';
import { parseArgs, checkedTarget, sameOriginUrl, loadFixture, makeReport, check, finish, writeReport, artifact, fillSteps } from './browser-compat.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUERY_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid']);
export function credentials(args, env = process.env) {
  let values = {};
  if (args['credentials-file']) values = JSON.parse(readFileSync(args['credentials-file'], 'utf8'));
  const username = values.username || env.ADMIN_USERNAME;
  const password = values.password || (args['password-file'] ? readFileSync(args['password-file'], 'utf8').trim() : env.ADMIN_PASSWORD);
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) throw new Error('Supply administrator credentials through environment variables or a private credential file.');
  return { username, password };
}
export function testRunOptions(args, fixture) {
  if (args['read-only'] && args['allow-test-lead']) throw new Error('Read-only and test-lead modes cannot be combined.');
  if (args['cleanup-test-lead'] && !args['allow-test-lead']) throw new Error('Cleanup requires an explicitly authorized test lead.');
  if (!args['allow-test-lead']) return { readOnly: true };
  if (fixture.synthetic !== true) throw new Error('The form fixture must explicitly identify its fields as synthetic.');
  if (!fixture.query || !fixture.expected_dimensions || !['google', 'facebook', 'instagram', 'microsoft', 'direct', 'other', 'unknown'].includes(fixture.expected_dimensions.source)) throw new Error('Full verification requires a reviewed traffic query and expected dimensions.');
  if (Object.keys(fixture.query).some(key => !QUERY_KEYS.has(key))) throw new Error('Only attribution query parameters are permitted in a test fixture.');
  if (!['paid', 'organic', 'other', 'unknown'].includes(fixture.expected_dimensions.traffic) || !['desktop', 'mobile'].includes(fixture.expected_dimensions.device)) throw new Error('Supply known traffic and device dimensions for the synthetic journey.');
  return { readOnly: false };
}
export async function publicChecks(target, fixture, report, fetcher = fetch) {
  const trace = [];
  async function get(resource, follow = false) {
    let url = sameOriginUrl(resource, target.url);
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      trace.push({ path: url.pathname, method: 'GET', status: response.status });
      if (!follow || ![301, 302, 303, 307, 308].includes(response.status)) return response;
      url = sameOriginUrl(response.headers.get('location'), url);
    }
    throw new Error('A public resource has a redirect loop.');
  }
  const health = await get('/api/health');
  let healthBody; try { healthBody = await health.json(); } catch {}
  check(report, 'Worker health reports a connected database', health.ok && healthBody?.ok === true && healthBody.database === 'connected');
  for (const resource of ['/api/admin/leads', '/api/admin/metrics', '/api/auth/session']) check(report, `${resource} rejects anonymous requests`, (await get(resource)).status === 401);
  for (const resource of ['/admin/', '/admin/index.html', '/%61dmin/']) {
    const response = await get(resource);
    let safeLoginRedirect = false;
    try { const redirect = sameOriginUrl(response.headers.get('location'), target.url); safeLoginRedirect = /^\/login(?:\.html)?\/?$/.test(redirect.pathname); } catch {}
    check(report, `${resource} is protected`, response.status === 401 || ([302, 303, 307].includes(response.status) && safeLoginRedirect));
  }
  for (const resource of [...new Set([fixture.path, fixture.thank_you_path, '/login.html', ...(fixture.required_resources || [])])]) {
    const response = await get(resource, true);
    check(report, `Public resource loads: ${new URL(resource, target.url).pathname}`, response.ok);
  }
  const pdf = await get(fixture.pdf_path, true);
  check(report, 'Brochure is a real downloadable PDF', pdf.ok && Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString() === '%PDF-');
  return trace;
}
export function verifyCorrelation(receipt, stored, submitted, visit, expected) {
  return {
    accepted_receipt: receipt?.ok === true && UUID.test(receipt.lead_id || '') && UUID.test(receipt.receipt_id || ''),
    persisted_receipt: stored?.lead?.id === receipt?.lead_id && stored?.lead?.receipt_id === receipt?.receipt_id,
    measured_visit: visit?.measured === true && UUID.test(visit.event_id || '') && submitted?.analytics_consent === true && UUID.test(submitted?.visitor_id || '') && submitted?.visit_event_id === visit.event_id,
    linked_conversion: stored?.lead?.visit_event_id === visit?.event_id && !!visit?.event_id,
    traffic_dimensions: stored?.lead?.traffic_source === expected.source && stored?.lead?.traffic_type === expected.traffic && stored?.lead?.device === expected.device
  };
}
export async function runLiveVerify(args, runtime = {}) {
  const target = checkedTarget(args.url, args['allow-remote'] === true);
  const fixture = loadFixture(args.fixture), options = testRunOptions(args, fixture);
  const report = makeReport('deployment', target, args);
  report.fully_verified = false; report.mode = options.readOnly ? 'read-only' : 'synthetic-browser-journey';
  report.journey_assertions = { named_login: false, redirect: false, brochure: false, receipt_correlation: false, crm_update: false, metrics: false, logout: false };
  report.limits = ['A static/health check alone does not prove contact storage or analytics.', 'Browser screenshots are limited to public pages; admin customer data and credentials are never captured.', 'The synthetic journey creates one measured visit and lead. Removing the contact does not erase historical conversion totals.', 'Authenticated CRM reads are D1-backed API evidence, not an independent direct SQL query.'];
  const out = path.resolve(args.out || 'build/live-verification'); mkdirSync(out, { recursive: true });
  // A read-only or failed attempt must not leave successful derived reports from
  // an earlier attempt under the same output path. Use distinct --out paths for history.
  for (const name of ['local-journey.json', 'crm.json', 'tracking.json', 'deployment.json']) rmSync(path.join(out, name), { force: true });
  const attempt = { schema_version: 1, started_at: new Date().toISOString(), form_attempted: false, request_key: null, receipt: null };
  const saveAttempt = () => atomic(path.join(out, 'attempt.json'), attempt); saveAttempt();
  const runtimeProof = {}; let identity;
  const trace = [], eventTrace = []; let browser, anonymous, admin, createdId, phase = 'public-checks';
  let deployment;
  try {
    trace.push(...await publicChecks(target, fixture, report, runtime.fetch || fetch));
    if (report.failures.length) return writeReport(finish(report), out);
    if (options.readOnly) {
      report.warnings.push('Read-only verification is partial. No form, administrator login, stored receipt, or analytics correlation was tested.');
      report.readiness = 'public-checks-only';
      return writeReport(finish(report), out);
    }
    phase = 'release-identity';
    if (!target.local) {
      if (!args.identity) throw new Error('A guarded release identity is required before sending administrator credentials.');
      identity = JSON.parse(readFileSync(args.identity, 'utf8'));
      if (identity.evidence_source !== 'cloudflare-wrangler-deployments-and-version-api' || identity.source_fingerprint !== report.source_fingerprint || identity.url !== target.url.origin || !UUID.test(identity.release_id || '') || !UUID.test(identity.database_id || '')) throw new Error('The identity evidence does not match this release snapshot.');
      runtimeProof.before = await runtimeIdentity(target.url.origin, identity, runtime.fetch || fetch);
      report.deployment_identity = identity;
      report.artifacts.push(artifact(args.identity, 'deployment_identity', args['project-root']));
    }
    phase = 'administrator-login';
    const auth = credentials(args, runtime.env || process.env);
    if (!target.local && args['deployment-record']) {
      deployment = JSON.parse(readFileSync(args['deployment-record'], 'utf8'));
      if (new URL(deployment.url).origin !== target.url.origin || !UUID.test(deployment.database_id || '')) throw new Error('Deployment identity must match the verified URL and database.');
      const deploymentFile = path.join(out, 'deployment-record.json');
      writeFileSync(deploymentFile, JSON.stringify({ url: target.url.origin, database_id: deployment.database_id, worker: deployment.worker || null, version_id: deployment.version_id || null }, null, 2) + '\n');
      report.artifacts.push(artifact(deploymentFile, 'deployment_record', args['project-root']));
    } else if (!target.local) report.warnings.push('No matching deployment record supplied. Live gates cannot be attached without deployment identity.');
    const playwright = runtime.playwright || await import('playwright-core');
    browser = await playwright.chromium.launch({ headless: true, ...(args['browser-executable'] ? { executablePath: args['browser-executable'] } : {}) });
    admin = await browser.newContext();
    await admin.route('**/*', route => !['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) && new URL(route.request().url()).origin !== target.url.origin ? route.abort('blockedbyclient') : route.continue());
    const adminPage = await admin.newPage(); adminPage.setDefaultTimeout(15000);
    await adminPage.goto(new URL('/login.html', target.url).href);
    if (new URL(adminPage.url()).origin !== target.url.origin) throw new Error('Administrator login left the verified origin.');
    await adminPage.locator('#username').fill(auth.username); await adminPage.locator('#password').fill(auth.password);
    await adminPage.locator('#login-form').evaluate(form => form.requestSubmit());
    await adminPage.waitForURL(url => url.pathname === '/admin/');
    const adminRequest = async (resource, method = 'GET', data) => {
      const url = sameOriginUrl(resource, target.url);
      const response = await admin.request.fetch(url.href, { method, maxRedirects: 0, headers: { Origin: target.url.origin }, ...(data ? { data } : {}) });
      trace.push({ path: url.pathname, method, status: response.status() });
      if (!response.ok()) throw new Error('An authenticated verification operation failed.');
      return response.json();
    };
    report.journey_assertions.named_login = check(report, 'Named administrator can sign in', (await adminRequest('/api/auth/session')).authenticated === true);
    const dimensions = fixture.expected_dimensions;
    const filters = new URLSearchParams({ source: dimensions.source, traffic: dimensions.traffic, device: dimensions.device, visitor_mode: 'all' });
    const metricsPath = '/api/admin/metrics?' + filters;
    const baseline = await adminRequest(metricsPath);
    phase = 'public-form';
    anonymous = await browser.newContext({ viewport: dimensions.device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, ...(dimensions.device === 'mobile' ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' } : { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }) });
    await anonymous.route('**/*', route => !['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) && new URL(route.request().url()).origin !== target.url.origin ? route.abort('blockedbyclient') : route.continue());
    const page = await anonymous.newPage(); page.setDefaultTimeout(15000);
    const runtimeErrors = []; page.on('pageerror', () => runtimeErrors.push(true));
    let capturedReceipt, submitted;
    // Read the real Worker acknowledgement before the page navigates away.
    // A response-body read after navigation can race Chromium's request disposal.
    await page.route('**/api/leads*', async route => {
      if (new URL(route.request().url()).pathname !== '/api/leads' || route.request().method() !== 'POST') { await route.continue(); return; }
      if (new URL(route.request().url()).origin !== target.url.origin) { await route.abort('blockedbyclient'); return; }
      submitted = route.request().postDataJSON();
      attempt.form_attempted = true;
      attempt.request_key = typeof submitted.idempotency_key === 'string' ? submitted.idempotency_key : null;
      saveAttempt(); // Durable before the first actual request; no contact fields are retained.
      const accepted = await route.fetch({ maxRedirects: 0 });
      const body = await accepted.body();
      try { capturedReceipt = JSON.parse(body.toString()); } catch {}
      if (capturedReceipt?.ok && UUID.test(capturedReceipt.lead_id || '') && UUID.test(capturedReceipt.receipt_id || '')) { attempt.receipt = { lead_id: capturedReceipt.lead_id, receipt_id: capturedReceipt.receipt_id }; saveAttempt(); }
      await route.fulfill({ response: accepted, body });
    });
    const capturedVisits = [];
    await page.route('**/api/visits', async route => {
      if (new URL(route.request().url()).origin !== target.url.origin) { await route.abort('blockedbyclient'); return; }
      const measured = await route.fetch({ maxRedirects: 0 });
      const body = await measured.body();
      try { capturedVisits.push(JSON.parse(body.toString())); } catch {}
      await route.fulfill({ response: measured, body });
    });
    const start = sameOriginUrl(fixture.path, target.url);
    for (const [key, value] of Object.entries(fixture.query)) start.searchParams.set(key, String(value));
    await page.goto(start.href, { waitUntil: 'networkidle' });
    const consentSelector = fixture.selectors.consentAccept;
    if (consentSelector) { const consent = page.locator(consentSelector); if (await consent.isVisible()) await consent.click(); }
    await page.locator(fixture.selectors.openModal).first().click();
    await fillSteps(page, fixture);
    const acceptedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/leads' && response.request().method() === 'POST', { timeout: 25000 });
    await page.locator(fixture.selectors.submit).first().click();
    const response = await acceptedResponse;
    trace.push({ path: '/api/leads', method: 'POST', status: response.status() });
    phase = 'accepted-receipt';
    const receipt = capturedReceipt;
    if (!response.ok() || receipt?.ok !== true || !UUID.test(receipt?.lead_id || '') || !UUID.test(receipt?.receipt_id || '')) throw new Error('The form did not receive an accepted lead receipt.');
    createdId = receipt.lead_id;
    // Receipts/IDs are safe correlation evidence; never retain submitted contact fields.
    report.receipt_id = receipt.receipt_id; report.lead_id = createdId;
    phase = 'thank-you-and-brochure';
    await page.waitForURL(url => url.pathname === fixture.thank_you_path || url.pathname === fixture.thank_you_path.replace(/\.html$/, ''));
    report.journey_assertions.redirect = check(report, 'Public form redirects to its intended thank-you page', true);
    const thankyouFile = path.join(out, 'public-thank-you.png');
    await page.screenshot({ path: thankyouFile, fullPage: true }); report.artifacts.push(artifact(thankyouFile, 'screenshot', args['project-root']));
    const link = page.locator('a[href]').filter({ visible: true }); let foundPdf = false;
    for (const candidate of await link.all()) { if (new URL(await candidate.getAttribute('href'), page.url()).pathname === fixture.pdf_path) { foundPdf = true; break; } }
    check(report, 'Thank-you page exposes the configured brochure', foundPdf);
    const pdfResponse = await anonymous.request.get(sameOriginUrl(fixture.pdf_path, target.url).href);
    report.journey_assertions.brochure = check(report, 'Brochure download works after submission', pdfResponse.ok() && new URL(pdfResponse.url()).origin === target.url.origin && (await pdfResponse.body()).subarray(0, 5).toString() === '%PDF-');
    phase = 'stored-receipt-and-tracking';
    const stored = await adminRequest('/api/admin/leads/' + createdId);
    let visit;
    for (const body of capturedVisits) if (body.event_id === submitted.visit_event_id) visit = body;
    const correlation = verifyCorrelation(receipt, stored, submitted, visit, dimensions);
    for (const [name, passed] of Object.entries(correlation)) check(report, name, passed);
    report.journey_assertions.receipt_correlation = Object.values(correlation).every(Boolean);
    eventTrace.push({ analytics_consent: submitted.analytics_consent === true, valid_visitor_id: UUID.test(submitted.visitor_id || ''), event_id: visit?.event_id || null, measured: visit?.measured === true, linked_lead_id: createdId, dimensions });
    const receiptProof = { evidence_source: 'authenticated-worker-api-backed-by-D1', database_id: deployment?.database_id || 'local-D1', lead_id: createdId, receipt_id: receipt.receipt_id, stored_receipt_id: stored.lead?.receipt_id || null, visit_event_id: stored.lead?.visit_event_id || null };
    const receiptFile = path.join(out, 'stored-receipt.json'); writeFileSync(receiptFile, JSON.stringify(receiptProof, null, 2) + '\n'); report.artifacts.push(artifact(receiptFile, 'db_receipt', args['project-root']));
    phase = 'CRM-status-and-note';
    await adminRequest('/api/admin/leads/' + createdId, 'PATCH', { status: 'qualified', version: stored.lead.version });
    const note = `Synthetic launch verification ${receipt.receipt_id}. Not a real customer enquiry.`;
    await adminRequest('/api/admin/leads/' + createdId + '/notes', 'POST', { body: note });
    const updated = await adminRequest('/api/admin/leads/' + createdId);
    report.journey_assertions.crm_update = check(report, 'CRM stage and verification note persist', updated.lead.status === 'qualified' && updated.notes.some(item => item.body === note));
    phase = 'dashboard-metrics';
    const measured = await adminRequest(metricsPath);
    const totals = measured.totals;
    const cohortMatches = check(report, 'Filtered dashboard records the measured visit and conversion', totals.visitors >= baseline.totals.visitors + 1 && totals.conversions >= baseline.totals.conversions + 1 && totals.leads >= baseline.totals.leads + 1);
    const rateMatches = check(report, 'Conversion calculation agrees with its filtered cohort', totals.conversions <= totals.visitors && Math.abs(totals.conversion_rate - (totals.visitors ? totals.conversions / totals.visitors * 100 : 0)) <= 0.011);
    report.journey_assertions.metrics = cohortMatches && rateMatches;
    check(report, 'Public journey has no JavaScript exceptions', runtimeErrors.length === 0);
    const metricsFile = path.join(out, 'dashboard-result.json'); writeFileSync(metricsFile, JSON.stringify({ filters: dimensions, before: baseline.totals, after: totals, synthetic_impact: 'One measured test visit and lead; historical totals retain this test after contact removal.' }, null, 2) + '\n'); report.artifacts.push(artifact(metricsFile, 'dashboard_result', args['project-root']));
    if (args['cleanup-test-lead'] && !report.failures.length) {
      await adminRequest('/api/admin/leads/' + createdId, 'DELETE');
      const removed = await admin.request.get(new URL('/api/admin/leads/' + createdId, target.url).href);
      check(report, 'Only this run’s synthetic contact was removed', removed.status() === 404);
      report.cleanup = 'synthetic-contact-soft-removed';
    } else report.cleanup = 'retained-synthetic-contact';
    report.synthetic_impact = { visits: 1, leads: 1, historical_metrics_retain_test: true, lead_id: createdId };
    await adminRequest('/api/auth/logout', 'POST', {});
    report.journey_assertions.logout = check(report, 'Administrator logout revokes the session', (await admin.request.get(new URL('/api/admin/leads', target.url).href)).status() === 401);
    if (identity) {
      runtimeProof.after = await runtimeIdentity(target.url.origin, identity, runtime.fetch || fetch);
      check(report, 'Running release identity is unchanged after the journey', true);
    }
    report.observations = receiptProof;
    report.fully_verified = report.failures.length === 0 && (target.local || !!deployment);
    report.readiness = report.fully_verified ? (target.local ? 'local-journey-verified' : 'live-journey-verified') : 'incomplete';
    report.warnings.push('The controlled test contributes to historical metrics. It is identified in this report and the CRM verification note.');
  } catch {
    check(report, 'Complete browser-to-database verification journey', false, `Stage: ${phase}. Inspect the public screenshots, fixture, running server, and credential setup. Submitted fields and credentials are intentionally omitted.`);
    if (createdId) { report.lead_id = createdId; report.cleanup = 'incomplete-test-contact-may-remain'; report.warnings.push('The accepted synthetic contact may remain in the CRM; inspect it using the saved lead ID.'); }
  } finally {
    // Best-effort logout also runs on failed journeys; never leave a verification session active.
    if (admin) { try { await admin.request.post(new URL('/api/auth/logout', target.url).href, { headers: { Origin: target.url.origin }, data: {} }); } catch {} }
    await browser?.close();
    attempt.finished_at = new Date().toISOString(); attempt.stage = phase; saveAttempt();
    if (identity) { const identityFile = path.join(out, 'runtime-identity.json'); atomic(identityFile, runtimeProof); report.artifacts.push(artifact(identityFile, 'runtime_identity', args['project-root'])); }
    for (const [file, type, data] of [['http-trace.json', 'http_trace', trace], ['event-trace.json', 'event_trace', eventTrace]]) {
      const destination = path.join(out, file); writeFileSync(destination, JSON.stringify(data, null, 2) + '\n'); report.artifacts.push(artifact(destination, type, args['project-root']));
    }
    finish(report); writeReport(report, out);
    if (report.fully_verified && !target.local && !report.failures.length) {
      for (const gate of ['crm', 'tracking', 'deployment']) writeReport({ ...report, gate }, out, gate + '.json');
    }
    if (report.fully_verified && target.local && !report.failures.length) writeReport({ ...report, gate: 'local_journey' }, out, 'local-journey.json');
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await runLiveVerify(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: report.status, fully_verified: report.fully_verified, readiness: report.readiness, lead_id: report.lead_id, failures: report.failures, warnings: report.warnings })); process.exitCode = report.execution.exit_code; }
  catch { console.error('Live verification blocked: check target, reviewed fixture, credentials, snapshot, and authorization flags.'); process.exitCode = 1; }
}
