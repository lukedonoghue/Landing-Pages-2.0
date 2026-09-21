/** Browser -> accepted receipt -> authenticated CRM read -> reporting proof.
 * Live writes require --allow-remote --allow-test-lead and a reviewed synthetic fixture.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomic, runtimeIdentity, hash, currentSourceFingerprint } from './release-tools.mjs';
import { openJourney, fingerprint, JourneyRecoveryError } from './journey-state.mjs';
import { parseArgs, checkedTarget, sameOriginUrl, loadFixture, makeReport, check, finish, writeReport, artifact, fillSteps } from './browser-compat.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUERY_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid']);
export function credentials(args, env = process.env) {
  let values = {};
  if (args['credentials-file']) values = JSON.parse(readFileSync(args['credentials-file'], 'utf8'));
  const username = values.username || env.ADMIN_USERNAME;
  const password = values.password || (args['password-file'] ? readFileSync(args['password-file'], 'utf8').trim() : env.ADMIN_PASSWORD);
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) throw new Error('Supply administrator credentials through environment variables or a private credential file.');
  return { username, password };
}
export function testRunOptions(args, fixture) {
  for(const key of ['read-only','allow-test-lead','cleanup-test-lead','resume-journey'])if(args[key]!==undefined && typeof args[key]!=='boolean')throw new Error('Verification scope flags must be booleans, not string values.');
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
  const privacy=await get('/api/privacy-config');
  let policy;try{policy=await privacy.json();}catch{}
  check(report,'Public privacy policy is valid and uncached',privacy.ok && privacy.headers.get('cache-control')==='no-store' && ['consent','essential','disabled'].includes(policy?.analytics_mode) && ['consent','lead','disabled'].includes(policy?.attribution_mode) && typeof policy?.browser_opt_out==='boolean');
  for (const resource of ['/api/admin/leads', '/api/admin/metrics', '/api/auth/session']) check(report, `${resource} rejects anonymous requests`, (await get(resource)).status === 401);
  for (const resource of ['/admin/', '/admin/index.html', '/%61dmin/']) {
    const response = await get(resource);
    let safeLoginRedirect = false;
    try { const redirect = sameOriginUrl(response.headers.get('location'), target.url); safeLoginRedirect = /^\/login(?:\.html)?\/?$/.test(redirect.pathname); } catch {}
    check(report, `${resource} is protected`, response.status === 401 || ([302, 303, 307].includes(response.status) && safeLoginRedirect));
  }
  for (const resource of [...new Set([fixture.path, fixture.thank_you_path, '/login.html', '/privacy.html', '/privacy-controls.js', '/privacy-controls.css', ...(fixture.required_resources || [])])]) {
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
  if(options.readOnly && args['resume-journey'])throw new Error('A submitted journey can only resume within its authorized synthetic testing scope. Use a separate output for read-only checks.');
  const report = makeReport('deployment', target, args);
  report.fully_verified = false; report.mode = options.readOnly ? 'read-only' : 'synthetic-browser-journey';
  report.journey_assertions = { named_login: false, redirect: false, brochure: false, receipt_correlation: false, crm_update: false, metrics: false, logout: false };
  report.limits = ['A static/health check alone does not prove contact storage or analytics.', 'Browser screenshots are limited to public pages; admin customer data and credentials are never captured.', 'The synthetic journey creates one measured visit and lead. Removing the contact does not erase historical conversion totals.', 'Authenticated CRM reads are D1-backed API evidence, not an independent direct SQL query.'];
  const output = path.resolve(args.out || 'build/live-verification'); mkdirSync(output, { recursive: true });
  if(options.readOnly && existsSync(path.join(output,'attempt.json'))) {
    const old=JSON.parse(readFileSync(path.join(output,'attempt.json'),'utf8'));
    if(old.schema_version===2 && (old.form_attempted || old.visit_attempted))throw new Error('Preserve the retained synthetic journey. Use a separate output for read-only checks.');
  }
  const root = path.resolve(args['project-root'] || process.cwd());
  const checkSource=()=>{if(!args['project-root'] || !report.source_fingerprint || currentSourceFingerprint(root)!==report.source_fingerprint)throw new JourneyRecoveryError('source_changed');};
  if(!options.readOnly)checkSource();
  const identityInput = args.identity ? JSON.parse(readFileSync(args.identity, 'utf8')) : null;
  const snapshotFile = args['project-root'] ? path.resolve(root, args.snapshot || 'build/gate-snapshot.json') : null;
  const binding = { origin: target.url.origin, source_fingerprint: report.source_fingerprint,
    fixture_sha256: fingerprint(fixture), snapshot_sha256: snapshotFile ? hash(readFileSync(snapshotFile)) : null, cleanup_test_lead:args['cleanup-test-lead']===true,
    identity: identityInput ? Object.fromEntries(['account_id','worker','database_id','version_id','release_id','source_fingerprint','url','script_etag'].map(key=>[key,identityInput[key]])) : null };
  const journey = options.readOnly ? null : openJourney({root,out:output,binding,resume:args['resume-journey']===true});
  const out = journey?.runOut || output;
  for (const name of ['local-journey.json', 'crm.json', 'tracking.json', 'deployment.json']) rmSync(path.join(output, name), { force: true });
  const attempt = journey?.state || { schema_version: 1, started_at: new Date().toISOString(), form_attempted: false };
  const saveAttempt = journey?.save || (()=>atomic(path.join(output,'attempt.json'),attempt));
  const checkpoint = async stage => { attempt.stage=stage;saveAttempt();await runtime.checkpoint?.(stage); };
  const runtimeProof = {}; let identity;
  const trace = attempt.trace || [], eventTrace = []; let browser, anonymous, admin, createdId, phase = 'public-checks';
  const saveTrace = () => { attempt.trace=trace;saveAttempt(); };
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
      identity = identityInput;
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
      trace.push({ path: url.pathname, method, status: response.status() });saveTrace();
      if (!response.ok()) throw new Error('An authenticated verification operation failed.');
      return response.json();
    };
    report.journey_assertions.named_login = check(report, 'Named administrator can sign in', (await adminRequest('/api/auth/session')).authenticated === true);
    const dimensions = fixture.expected_dimensions;
    const filters = new URLSearchParams({ source: dimensions.source, traffic: dimensions.traffic, device: dimensions.device, visitor_mode: 'all' });
    let metricsPath = attempt.metrics_path || '/api/admin/metrics?' + filters;
    if (!attempt.baseline) {
      const first = await adminRequest(metricsPath);
      filters.set('from', first.days[0].date);filters.set('to', first.days.at(-1).date);
      metricsPath='/api/admin/metrics?'+filters;attempt.metrics_path=metricsPath;
      attempt.baseline={totals:first.totals};saveAttempt();
    }
    const baseline = attempt.baseline;
    let receipt, submitted;
    let publicProof = journey.publicProof();
    if (!publicProof) {
      phase = 'public-form';
      anonymous = await browser.newContext({ viewport: dimensions.device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, ...(dimensions.device === 'mobile' ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' } : { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }) });
      await anonymous.route('**/*', route => !['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) && new URL(route.request().url()).origin !== target.url.origin ? route.abort('blockedbyclient') : route.continue());
      const page = await anonymous.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', () => {attempt.runtime_errors++;saveAttempt();});
      let capturedReceipt, rejectRoute, routeFailure;
      const routeError=new Promise((_,reject)=>{rejectRoute=reject;});routeError.catch(()=>{});
      await page.route('**/api/leads*', async route => {
        if (new URL(route.request().url()).pathname !== '/api/leads' || route.request().method() !== 'POST') { await route.continue(); return; }
        if (new URL(route.request().url()).origin !== target.url.origin) { await route.abort('blockedbyclient'); return; }
        try {
          if(routeFailure)throw routeFailure;
          const fresh=route.request().postDataJSON();
          if(attempt.form_attempted) {
            submitted=journey.payload('submission');
            if(fingerprint(fresh.form_data)!==fingerprint(submitted.form_data) || fresh.form_name!==submitted.form_name || fresh.website!==submitted.website)throw new Error('Rendered form details changed; the original synthetic request cannot be replaced.');
          } else {
            const measured=attempt.visits.find(value=>value.measured===true);
            const originalVisit=measured && attempt.runs>1?journey.payload('visit'):null;
            submitted=journey.retain('submission',originalVisit?{...fresh,visitor_id:originalVisit.visitor_id,visit_event_id:measured.event_id,analytics_consent:originalVisit.analytics_consent}:fresh);
            attempt.request_key=typeof submitted.idempotency_key==='string'?submitted.idempotency_key:null;
            if(!/^[A-Za-z0-9_-]{16,128}$/.test(attempt.request_key||''))throw new Error('The form has no supported idempotency key.');
            attempt.form_attempted=true;saveAttempt();
          }
          const accepted=await route.fetch({maxRedirects:0,postData:JSON.stringify(submitted)});
          const body=await accepted.body();
          trace.push({path:'/api/leads',method:'POST',status:accepted.status(),same_request_retry:attempt.runs>1});saveTrace();
          await runtime.checkpoint?.('before-acknowledgement');
          try{capturedReceipt=JSON.parse(body.toString());}catch{}
          if(capturedReceipt?.ok && UUID.test(capturedReceipt.lead_id||'') && UUID.test(capturedReceipt.receipt_id||'')) {
            if(attempt.receipt && (attempt.receipt.lead_id!==capturedReceipt.lead_id || attempt.receipt.receipt_id!==capturedReceipt.receipt_id))throw new Error('The idempotent request returned a different receipt.');
            attempt.receipt={lead_id:capturedReceipt.lead_id,receipt_id:capturedReceipt.receipt_id};saveAttempt();
          }
          await route.fulfill({response:accepted,body});
        } catch(error) {routeFailure=error;rejectRoute(error);await route.abort('failed').catch(()=>{});}
      });
      await page.route('**/api/visits', async route => {
        if(new URL(route.request().url()).origin!==target.url.origin){await route.abort('blockedbyclient');return;}
        try {
          // Once the original measured acknowledgement is retained, page replay
          // must not create a second measured visit under a newly generated ID.
          if(attempt.visits.some(value=>value.measured===true)) {await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,measured:false})});return;}
          const body=attempt.visit_attempted?journey.payload('visit'):journey.retain('visit',route.request().postDataJSON());
          attempt.visit_attempted=true;saveAttempt();
          const measured=await route.fetch({maxRedirects:0,postData:JSON.stringify(body)});
          const raw=await measured.body();let value;try{value=JSON.parse(raw.toString());}catch{}
          await runtime.checkpoint?.('before-visit-acknowledgement');
          if(value?.measured===true && UUID.test(value.event_id||'')){attempt.visits.push({ok:true,measured:true,event_id:value.event_id});saveAttempt();}
          await route.fulfill({response:measured,body:raw});
        }catch(error){routeFailure=error;rejectRoute(error);await route.abort('failed').catch(()=>{});}
      });
      const start=sameOriginUrl(fixture.path,target.url);
      for(const [key,value] of Object.entries(fixture.query))start.searchParams.set(key,String(value));
      await page.goto(start.href,{waitUntil:'networkidle'});
      const consentSelector=fixture.selectors.consentAccept;
      if(consentSelector){const consent=page.locator(consentSelector);if(await consent.isVisible())await consent.click();}
      await page.locator(fixture.selectors.openModal).first().click();
      await fillSteps(page,fixture);
      if(routeFailure)throw routeFailure;
      const acceptedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/leads' && response.request().method()==='POST',{timeout:25000});
      acceptedResponse.catch(()=>{});
      await page.locator(fixture.selectors.submit).first().click();
      const response=await Promise.race([acceptedResponse,routeError]);
      receipt=capturedReceipt;
      if(!response.ok() || receipt?.ok!==true || !UUID.test(receipt.lead_id||'') || !UUID.test(receipt.receipt_id||''))throw new Error('The form did not receive an accepted lead receipt.');
      createdId=receipt.lead_id;await checkpoint('accepted-receipt');
      phase='thank-you-and-brochure';
      await page.waitForURL(url=>url.pathname===fixture.thank_you_path || url.pathname===fixture.thank_you_path.replace(/\.html$/,''));
      const thankyouFile=path.join(out,'public-thank-you.png');await page.screenshot({path:thankyouFile,fullPage:true});
      const link=page.locator('a[href]').filter({visible:true});let foundPdf=false;
      for(const candidate of await link.all()){if(new URL(await candidate.getAttribute('href'),page.url()).pathname===fixture.pdf_path){foundPdf=true;break;}}
      const pdfResponse=await anonymous.request.get(sameOriginUrl(fixture.pdf_path,target.url).href);
      const brochure=foundPdf && pdfResponse.ok() && new URL(pdfResponse.url()).origin===target.url.origin && (await pdfResponse.body()).subarray(0,5).toString()==='%PDF-';
      if(!brochure)throw new Error('The thank-you brochure is not usable.');
      journey.retainPublic({binding,receipt:{ok:true,lead_id:receipt.lead_id,receipt_id:receipt.receipt_id},redirect:true,brochure:true,observed_at:new Date().toISOString(),artifacts:[artifact(thankyouFile,'screenshot',root)]});
      publicProof=journey.publicProof();await checkpoint('public-complete');
    }
    receipt=publicProof.receipt;submitted=journey.payload('submission');createdId=receipt.lead_id;
    report.receipt_id=receipt.receipt_id;report.lead_id=createdId;
    report.journey_assertions.redirect=check(report,'Public form redirects to its intended thank-you page',publicProof.redirect);
    report.journey_assertions.brochure=check(report,'Brochure download works after submission',publicProof.brochure);
    report.artifacts.push(...publicProof.artifacts,artifact(path.join(root,attempt.public_complete.path),'browser_journey_checkpoint',root));
    if(attempt.runs>1)report.warnings.push('This run continues the same synthetic journey. Completed browser proof is retained; any acknowledgement retry uses the original private request and idempotency key, without another measured visit.');
    let receiptProof;
    const retainedCore=attempt.cleanup_started?journey.coreProof():null;
    if(attempt.cleanup_started && !retainedCore)throw new JourneyRecoveryError('cleanup_proof');
    if(retainedCore) {
      receiptProof=retainedCore.observations;eventTrace.push(...retainedCore.events);
      report.artifacts.push(...retainedCore.artifacts,artifact(path.join(root,attempt.core_complete.path),'core_journey_checkpoint',root));
      for(const key of ['receipt_correlation','crm_update','metrics'])report.journey_assertions[key]=retainedCore.assertions[key];
      report.checks.push(...retainedCore.checks);
      report.warnings.push('The authenticated receipt, CRM changes and metrics were verified before cleanup. Their hashed evidence is retained; cleanup recovery does not re-create a removed contact.');
    } else {
    phase = 'stored-receipt-and-tracking';
    const stored = await adminRequest('/api/admin/leads/' + createdId);
    let visit;
    for (const body of attempt.visits) if (body.event_id === submitted.visit_event_id) visit = body;
    const correlation = verifyCorrelation(receipt, stored, submitted, visit, dimensions);
    for (const [name, passed] of Object.entries(correlation)) check(report, name, passed);
    report.journey_assertions.receipt_correlation = Object.values(correlation).every(Boolean);
    eventTrace.push({ analytics_consent: submitted.analytics_consent === true, valid_visitor_id: UUID.test(submitted.visitor_id || ''), event_id: visit?.event_id || null, measured: visit?.measured === true, linked_lead_id: createdId, dimensions });
    receiptProof = { evidence_source: 'authenticated-worker-api-backed-by-D1', database_id: deployment?.database_id || 'local-D1', lead_id: createdId, receipt_id: receipt.receipt_id, stored_receipt_id: stored.lead?.receipt_id || null, visit_event_id: stored.lead?.visit_event_id || null };
    const receiptFile = path.join(out, 'stored-receipt.json'); writeFileSync(receiptFile, JSON.stringify(receiptProof, null, 2) + '\n'); report.artifacts.push(artifact(receiptFile, 'db_receipt', args['project-root']));
    phase = 'CRM-status-and-note';
    if(!attempt.status_intent){attempt.status_intent={lead_id:createdId,expected_version:stored.lead.version,target:'qualified'};saveAttempt();}
    const intent=attempt.status_intent;
    if(intent.lead_id!==createdId)throw new Error('CRM operation belongs to another receipt.');
    if(stored.lead.version===intent.expected_version) {
      await adminRequest('/api/admin/leads/'+createdId,'PATCH',{status:intent.target,version:intent.expected_version});
    } else if(stored.lead.version!==intent.expected_version+1 || stored.lead.status!==intent.target) {
      throw new JourneyRecoveryError('contact_changed');
    }
    await checkpoint('CRM-status-complete');
    const note=`Synthetic launch verification ${receipt.receipt_id}. Not a real customer enquiry.`;
    await adminRequest('/api/admin/leads/'+createdId+'/notes','POST',{body:note,request_id:attempt.id});
    await checkpoint('CRM-note-complete');
    const updated=await adminRequest('/api/admin/leads/'+createdId);
    report.journey_assertions.crm_update=check(report,'CRM stage and verification note persist',updated.lead.status==='qualified' && updated.notes.filter(item=>item.id===attempt.id && item.body===note).length===1);
    const recoveryFile=path.join(out,'crm-recovery.json');
    atomic(recoveryFile,{evidence_source:'authenticated-worker-api-backed-by-D1',lead_id:createdId,status_intent:intent,observed_version:updated.lead.version,observed_status:updated.lead.status,note_request_id:attempt.id});
    report.artifacts.push(artifact(recoveryFile,'crm_recovery',root));
    phase = 'dashboard-metrics';
    const measured = await adminRequest(metricsPath);
    const totals = measured.totals;
    const cohortMatches = check(report, 'Filtered dashboard records the measured visit and conversion', totals.visitors >= baseline.totals.visitors + 1 && totals.conversions >= baseline.totals.conversions + 1 && totals.leads >= baseline.totals.leads + 1);
    const rateMatches = check(report, 'Conversion calculation agrees with its filtered cohort', totals.conversions <= totals.visitors && Math.abs(totals.conversion_rate - (totals.visitors ? totals.conversions / totals.visitors * 100 : 0)) <= 0.011);
    report.journey_assertions.metrics = cohortMatches && rateMatches;
    check(report, 'Public journey has no JavaScript exceptions', attempt.runtime_errors === 0);
    const metricsFile = path.join(out, 'dashboard-result.json'); writeFileSync(metricsFile, JSON.stringify({ filters: dimensions, before: baseline.totals, after: totals, synthetic_impact: 'One measured test visit and lead; historical totals retain this test after contact removal.' }, null, 2) + '\n'); report.artifacts.push(artifact(metricsFile, 'dashboard_result', args['project-root']));
    if(!report.failures.length)journey.retainCore({binding,observations:receiptProof,events:eventTrace,assertions:{...report.journey_assertions},checks:[...report.checks],artifacts:report.artifacts.filter(item=>['db_receipt','crm_recovery','dashboard_result'].includes(item.type))});
    }
    if (args['cleanup-test-lead'] && !report.failures.length) {
      phase='test-contact-cleanup';attempt.cleanup_started=true;saveAttempt();
      const existing=await admin.request.get(new URL('/api/admin/leads/'+createdId,target.url).href,{maxRedirects:0});
      if(existing.status()===200) {
        const row=await existing.json();
        if(row.lead?.receipt_id!==receipt.receipt_id || row.lead.version!==attempt.status_intent.expected_version+1 || row.lead.status!=='qualified')throw new JourneyRecoveryError('contact_changed');
        await adminRequest('/api/admin/leads/' + createdId, 'DELETE');
      } else if(existing.status()!==404)throw new Error('The test-contact cleanup outcome cannot be confirmed.');
      const removed = await admin.request.get(new URL('/api/admin/leads/' + createdId, target.url).href);
      check(report, 'Only this run’s synthetic contact was removed', removed.status() === 404);
      report.cleanup = 'synthetic-contact-soft-removed';
    } else report.cleanup = 'retained-synthetic-contact';
    report.synthetic_impact = { visits: 1, leads: 1, historical_metrics_retain_test: true, lead_id: createdId, journey_id: attempt.id, recovery_runs: attempt.runs };
    await checkpoint('dashboard-complete');
    await adminRequest('/api/auth/logout', 'POST', {});
    report.journey_assertions.logout = check(report, 'Administrator logout revokes the session', (await admin.request.get(new URL('/api/admin/leads', target.url).href)).status() === 401);
    if (identity) {
      runtimeProof.after = await runtimeIdentity(target.url.origin, identity, runtime.fetch || fetch);
      check(report, 'Running release identity is unchanged after the journey', true);
    }
    report.observations = receiptProof;
    checkSource();
    report.fully_verified = report.failures.length === 0 && (target.local || !!deployment);
    report.readiness = report.fully_verified ? (target.local ? 'local-journey-verified' : 'live-journey-verified') : 'incomplete';
    report.warnings.push('The controlled test contributes to historical metrics. It is identified in this report and the CRM verification note.');
  } catch(error) {
    if(error instanceof JourneyRecoveryError)report.recovery={code:error.code,instruction:error.message};
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
    finish(report); writeReport(report, out); if(out!==output)writeReport(report,output);
    if (report.fully_verified && !target.local && !report.failures.length) {
      for (const gate of ['crm', 'tracking', 'deployment']) writeReport({ ...report, gate }, output, gate + '.json');
    }
    if (report.fully_verified && target.local && !report.failures.length) writeReport({ ...report, gate: 'local_journey' }, output, 'local-journey.json');
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await runLiveVerify(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: report.status, fully_verified: report.fully_verified, readiness: report.readiness, lead_id: report.lead_id, failures: report.failures, warnings: report.warnings })); process.exitCode = report.execution.exit_code; }
  catch(error) { console.error(error instanceof JourneyRecoveryError?error.message:'Live verification blocked: check target, reviewed fixture, credentials, snapshot, and authorization flags.'); process.exitCode = 1; }
}
