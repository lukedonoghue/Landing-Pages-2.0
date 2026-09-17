import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { reportingDay, visitorHash } from '../src/security.js';
import { earliestReportingDate } from '../src/repository.js';
import { isPublicAddress, validateWebhookUrl } from '../src/webhooks.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const password = 'test-only-very-long-random-password-98pq3';
const salt = '00112233445566778899aabbccddeeff';
const hash = `pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')}`;
let mf, db, cookie; let requestSequence = 0; const outbound = [];
const today = () => new Date().toISOString().slice(0, 10);
function leadPayload(overrides = {}) {
  return { idempotency_key: crypto.randomUUID(), form_name: 'enquiry', website: '', form_data: { first_name: 'Alex', last_name: 'Example', email: 'alex@example.invalid', phone: '+44 7700 900123', service: 'Service one', contact_method: 'Email' }, attribution: { first_touch: { utm_source: 'google', gclid: 'test-click' }, latest_touch: { utm_source: 'email' } }, landing_page: '/', ...overrides };
}
async function call(path, { method = 'GET', body, auth = true, headers = {}, ip } = {}) {
  const requestHeaders = { 'CF-Connecting-IP': ip || `203.0.${Math.floor(++requestSequence / 200)}.${requestSequence % 200 + 1}`, ...headers };
  if (auth && cookie) requestHeaders.Cookie = cookie;
  if (method !== 'GET' && method !== 'HEAD') {
    if (!('Origin' in requestHeaders)) requestHeaders.Origin = 'https://site.test';
    if (body !== undefined && !('Content-Type' in requestHeaders)) requestHeaders['Content-Type'] = 'application/json';
  }
  return mf.dispatchFetch(`https://site.test${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
}
async function jsonCall(path, options) {
  const response = await call(path, options); return { status: response.status, body: await response.json(), headers: response.headers };
}
before(async () => {
  const bundle = await build({ entryPoints: [`${root}src/worker.js`], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', plugins: [{name:'isolated-test-schema',setup(builder){builder.onLoad({filter:/site-config\.json$/},async()=>({contents:await readFile(`${root}tests/fixtures/site-config.json`,'utf8'),loader:'json'}));}}] });
  mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-22', d1Databases: { DB: 'crm-tests', MIGRATION_TEST: 'migration-tests' },
    bindings: { ADMIN_USERNAME: 'owner', ADMIN_PASSWORD_HASH: hash, SESSION_SECRET: 'test-only-session-secret-with-at-least-32-bytes', CF_VERSION_METADATA: { id: '11111111-1111-4111-8111-111111111111' }, FUNNEL_RELEASE_ID: '22222222-2222-4222-8222-222222222222', FUNNEL_SOURCE_FINGERPRINT: 'a'.repeat(64) },
    serviceBindings: { ASSETS: () => new Response('<html>Private admin asset</html>', { headers: { 'Content-Type': 'text/html' } }) },
    outboundService: async request => {
      const url = new URL(request.url);
      if (url.hostname === 'cloudflare-dns.com') {
        const host = url.searchParams.get('name'); const type = url.searchParams.get('type');
        return Response.json({ Status: 0, Answer: type === 'A' ? [{ type: 1, data: host === 'private.example.com' ? '127.0.0.1' : '93.184.216.34' }] : [] });
      }
      if (url.hostname === 'hooks.example.com') { outbound.push({ url: request.url, body: await request.json(), headers: Object.fromEntries(request.headers) }); return new Response('ok'); }
      if (url.hostname === 'fail.example.com') return new Response('unavailable', { status: 503 });
      if (url.hostname === 'redirect.example.com') return Response.redirect('http://127.0.0.1', 302);
      return new Response('unexpected outbound request', { status: 500 });
    }
  });
  db = await mf.getD1Database('DB');
  for (const file of (await readdir(`${root}migrations`)).filter(file => file.endsWith('.sql')).sort()) {
    const migration = await readFile(`${root}migrations/${file}`, 'utf8');
    await db.batch(unstable_splitSqlQuery(migration).map(sql => db.prepare(sql)));
  }
});
after(async () => { await mf?.dispose(); });

test('health reports only public release markers from the actual runtime binding', async () => {
  const response = await jsonCall('/api/health', { auth: false });
  assert.deepEqual(response.body, {ok:true,database:'connected',release:{version_id:'11111111-1111-4111-8111-111111111111',release_id:'22222222-2222-4222-8222-222222222222',source_fingerprint:'a'.repeat(64)}});
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('public privacy configuration shares server policy without exposing private settings',async()=>{
  const result=await jsonCall('/api/privacy-config',{auth:false,headers:{'Sec-GPC':'1'}});
  assert.equal(result.status,200);assert.deepEqual(result.body,{analytics_mode:'consent',attribution_mode:'lead',browser_opt_out:true});assert.equal(result.headers.get('Cache-Control'),'no-store');
});

test('all CRM routes and encoded admin assets require a real session', async () => {
  for (const path of ['/api/admin/leads', '/api/admin/config', '/api/admin/webhooks', '/api/admin/metrics', '/api/admin/unknown']) assert.equal((await call(path, { auth: false })).status, 401, path);
  for (const path of ['/admin', '/admin/', '/admin/index.html', '/admin/index', '/%61dmin/index.html', '/admin%2findex.html']) {
    const result = await call(path, { auth: false }); assert.equal(result.status, 302, path); assert.equal(result.headers.get('Location'), 'https://site.test/login.html');
  }
  assert.equal((await call('/login.html', { auth: false })).status, 200);
  assert.equal((await call('/api/health', { auth: false })).status, 200);
});
test('login derives PBKDF2 in the actual Workers runtime and stores only a token hash', async () => {
  const wrong = await jsonCall('/api/auth/login', { method: 'POST', auth: false, body: { username:'owner', password: 'wrong' } }); assert.equal(wrong.status, 401);
  const result = await jsonCall('/api/auth/login', { method: 'POST', auth: false, body: { username:'owner', password } });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.authenticated, true);
  const setCookie = result.headers.get('Set-Cookie'); cookie = setCookie.split(';')[0];
  for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Max-Age=43200']) assert.ok(setCookie.includes(flag));
  const stored = await db.prepare('SELECT token_hash FROM sessions').first(); assert.notEqual(stored.token_hash, cookie.split('=')[1]);
  assert.equal((await call('/admin/index.html')).status, 200);
  assert.equal((await call('/api/auth/session')).status, 200);
  assert.equal((await call('/api/admin/config')).headers.get('Cache-Control'), 'no-store');
});
test('empty reporting history starts today in the configured timezone', async () => {
  const config = await jsonCall('/api/admin/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.earliest_date, reportingDay(new Date(), config.body.timezone));
  for (const timezone of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    assert.equal(await earliestReportingDate({ DB: db }, { timezone }), reportingDay(new Date(), timezone));
  }
});
test('cross-origin mutations, invalid body type, oversized requests and honeypots fail closed', async () => {
  assert.equal((await call('/api/leads', { method: 'POST', body: leadPayload(), headers: { Origin: 'https://attacker.test' } })).status, 403);
  assert.equal((await call('/api/leads', { method: 'POST', body: leadPayload(), headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call('/api/leads', { method: 'POST', body: { extra: 'a'.repeat(33000) } })).status, 413);
  assert.equal((await call('/api/leads', { method: 'POST', body: leadPayload({ website: 'spam' }) })).status, 400);
  const nested = leadPayload(); nested.form_data.website = 'spam';
  assert.equal((await call('/api/leads', { method: 'POST', body: nested })).status, 400);
  const invalid = leadPayload(); invalid.form_data.email = 'invalid';
  assert.equal((await call('/api/leads', { method: 'POST', body: invalid })).status, 400);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n, 0);
});
let firstLead;
test('accepted lead persists, repeated submission deduplicates, changed payload conflicts', async () => {
  const body = leadPayload();
  const result = await jsonCall('/api/leads', { method: 'POST', body });
  assert.equal(result.status, 201, JSON.stringify(result.body)); firstLead = result.body.lead_id;
  assert.equal(result.body.ok, true); assert.equal(result.body.duplicate, false); assert.match(result.body.receipt_id, /^[a-f0-9-]{36}$/);
  const duplicate = await jsonCall('/api/leads', { method: 'POST', body });
  assert.equal(duplicate.status, 200); assert.equal(duplicate.body.duplicate, true); assert.equal(duplicate.body.lead_id, firstLead);
  body.form_data.first_name = 'Different'; assert.equal((await call('/api/leads', { method: 'POST', body })).status, 409);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n, 1);
  const detail = await jsonCall(`/api/admin/leads/${firstLead}`);
  assert.equal(detail.body.lead.source, 'email'); assert.equal(detail.body.lead.gclid, 'test-click'); assert.equal(detail.body.lead.name, 'Alex Example');
  assert.equal(detail.body.activity.length, 1); assert.equal(detail.body.lead.version, 1);
  assert.ok(!('visitor_hash' in detail.body.lead)); assert.ok(!('payload_hash' in detail.body.lead));
});
test('concurrent identical submissions commit exactly one CRM record and creation event', async () => {
  const body = leadPayload({ form_name: 'race' });
  const results = await Promise.all(Array.from({ length: 5 }, () => jsonCall('/api/leads', { method: 'POST', body })));
  assert.equal(results.filter(r => r.status === 201).length, 1, JSON.stringify(results));
  assert.equal(new Set(results.map(r => r.body.lead_id)).size, 1);
  const detail = await jsonCall(`/api/admin/leads/${results[0].body.lead_id}`); assert.equal(detail.body.activity.length, 1);
});
test('stage version prevents lost updates, notes persist, list search is literal and bounded', async () => {
  const moved = await jsonCall(`/api/admin/leads/${firstLead}`, { method: 'PATCH', body: { status: 'qualified', version: 1 } });
  assert.equal(moved.status, 200); assert.equal(moved.body.lead.version, 2);
  assert.equal((await call(`/api/admin/leads/${firstLead}`, { method: 'PATCH', body: { status: 'won', version: 1 } })).status, 409);
  assert.equal((await call(`/api/admin/leads/${firstLead}`, { method: 'PATCH', body: { status: 'made_up', version: 2 } })).status, 400);
  assert.equal((await call(`/api/admin/leads/${firstLead}/notes`, { method: 'POST', body: { body: 'Called to discuss the quote.' } })).status, 201);
  const detail = await jsonCall(`/api/admin/leads/${firstLead}`); assert.equal(detail.body.notes.length, 1); assert.equal(detail.body.activity.length, 3);
  const search = await jsonCall('/api/admin/leads?status=qualified&q=Alex&limit=1'); assert.equal(search.body.total, 1); assert.equal(search.body.leads.length, 1);
  assert.equal((await jsonCall('/api/admin/leads?q=%25')).body.total, 0);
  assert.equal((await call('/api/admin/leads?limit=999999')).status, 400);
});
test('note request identifiers make lost-response and concurrent retries idempotent', async () => {
  const request_id=crypto.randomUUID();const route='/api/admin/leads/'+firstLead+'/notes';
  const body={body:'Synthetic recoverable note',request_id};
  const replies=await Promise.all([jsonCall(route,{method:'POST',body}),jsonCall(route,{method:'POST',body})]);
  assert.ok(replies.every(reply=>reply.status===201));assert.ok(replies.every(reply=>reply.body.note.id===request_id));
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM notes WHERE id=?').bind(request_id).first()).count,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM activity WHERE id=?').bind('note:'+request_id).first()).count,1);
  assert.equal((await jsonCall(route,{method:'POST',body:{...body,body:'Changed note'}})).status,409);
  const other=await db.prepare('SELECT id FROM leads WHERE id<>? LIMIT 1').bind(firstLead).first();assert.ok(other);
  assert.equal((await jsonCall('/api/admin/leads/'+other.id+'/notes',{method:'POST',body})).status,409);
  assert.equal((await jsonCall(route,{method:'POST',body:{...body,request_id:'invalid'}})).status,400);
});

test('analytics respects consent, DNT/GPC, deduplicates visits and counts converted visitors', async () => {
  const visitor1 = crypto.randomUUID(); const visitor2 = crypto.randomUUID();
  const visit = { event_id: crypto.randomUUID(), visitor_id: visitor1, path: '/', analytics_consent: true };
  assert.equal((await jsonCall('/api/visits', { method: 'POST', body: { ...visit, analytics_consent: false } })).body.measured, false);
  for (const headers of [{ DNT: '1' }, { 'Sec-GPC': '1' }]) assert.equal((await jsonCall('/api/visits', { method: 'POST', body: visit, headers })).body.measured, false);
  for (let i = 0; i < 3; i++) assert.equal((await jsonCall('/api/visits', { method: 'POST', body: visit })).body.measured, true);
  await call('/api/visits', { method: 'POST', body: { ...visit, event_id: crypto.randomUUID(), visitor_id: visitor2, path: '/index.html' } });
  assert.equal((await call('/api/visits', { method: 'POST', body: { ...visit, path: '/admin/' } })).status, 400);
  for (let i = 0; i < 2; i++) await call('/api/leads', { method: 'POST', body: leadPayload({ visitor_id: visitor1, analytics_consent: true, visit_event_id: visit.event_id }) });
  await call('/api/leads', { method: 'POST', body: leadPayload({ visitor_id: visitor2, analytics_consent: true }), headers: { 'Sec-GPC': '1' } });
  const result = await jsonCall(`/api/admin/metrics?from=${today()}&to=${today()}`);
  assert.equal(result.status, 200); assert.deepEqual(result.body.totals, { visitors: 2, conversions: 1, leads: 5, conversion_rate: 50 });
  assert.equal(result.body.days.length, 1);
  const stored = await db.prepare('SELECT * FROM visit_events LIMIT 1').first(); assert.ok(!JSON.stringify(stored).includes(visitor1)); assert.ok(!JSON.stringify(stored).includes('203.0.'));
  assert.equal((await call('/api/admin/metrics?from=2026-02-30&to=2026-03-01')).status, 400);
  assert.equal(reportingDay(new Date('2026-09-16T00:30:00Z'), 'America/Los_Angeles'), '2026-09-15');
});
test('all-time history includes its earliest visits and removed leads, with complete multi-year leap-day metrics', async () => {
  const visitId = 'historic-visitor-for-date-range-test';
  const leadIds = [crypto.randomUUID(), crypto.randomUUID()];
  const insertLead = (id, day, deletedAt = null) => db.prepare('INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,form_name,form_data,attribution,landing_page,visitor_hash,deleted_at,visit_event_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, crypto.randomUUID(), crypto.randomUUID(), 'historical-test-hash', `${day}T12:00:00Z`, `${day}T12:00:00Z`, day, 'historical-test', '{}', '{}', '/', visitId, deletedAt, day === '2024-02-29' ? `legacy-test:${day}` : null);
  try {
    await db.batch(['2019-01-01', '2024-02-29'].map(day => db.prepare('INSERT INTO visit_events(event_id,reporting_day,path,visitor_hash,created_at,payload_hash,legacy) VALUES(?,?,?,?,?,?,1)').bind(`legacy-test:${day}`, day, '/', visitId, `${day}T12:00:00Z`, 'legacy')));
    assert.equal((await jsonCall('/api/admin/config')).body.earliest_date, '2019-01-01');
    await db.batch([insertLead(leadIds[0], '2018-12-31', '2020-01-01T12:00:00Z'), insertLead(leadIds[1], '2024-02-29')]);
    assert.equal((await jsonCall('/api/admin/config')).body.earliest_date, '2018-12-31');
    const result = await jsonCall('/api/admin/metrics?from=2018-12-31&to=2025-01-01');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.days.length, (Date.parse('2025-01-01') - Date.parse('2018-12-31')) / 86400000 + 1);
    assert.equal(result.body.days[0].date, '2018-12-31');
    assert.equal(result.body.days.at(-1).date, '2025-01-01');
    assert.deepEqual(result.body.days.find(day => day.date === '2020-02-29'), { date: '2020-02-29', visitors: 0, conversions: 0, leads: 0, conversion_rate: 0 });
    assert.deepEqual(result.body.days.find(day => day.date === '2024-02-29'), { date: '2024-02-29', visitors: 1, conversions: 1, leads: 1, conversion_rate: 100 });
    assert.deepEqual(result.body.totals, { visitors: 2, conversions: 1, leads: 2, conversion_rate: 50 });
    const filtered = await jsonCall('/api/admin/metrics?from=2018-12-31&to=2025-01-01&path=%2Findex.html');
    assert.deepEqual(filtered.body.totals, result.body.totals);
  } finally {
    await db.batch([...leadIds.map(id => db.prepare('DELETE FROM leads WHERE id=?').bind(id)), db.prepare('DELETE FROM visit_events WHERE visitor_hash=?').bind(visitId)]);
  }
});
test('metrics date requests reject invalid or reversed ranges and explicitly bound daily output at 100 calendar years', async () => {
  for (const [from, to] of [['2023-02-29', '2024-01-01'], ['2025-01-02', '2025-01-01'], ['2000-01-01', '2100-01-01'], ['0000-01-01', '9999-12-31']]) {
    assert.equal((await call(`/api/admin/metrics?from=${from}&to=${to}`)).status, 400, `${from} to ${to}`);
  }
  const century = await jsonCall('/api/admin/metrics?from=1900-01-01&to=1999-12-31');
  assert.equal(century.status, 200);
  assert.equal(century.body.days.length, 36524);
  assert.equal(century.body.days[0].date, '1900-01-01');
  assert.equal(century.body.days.at(-1).date, '1999-12-31');
});
test('measured visits, unique browsers and conversions share the exact source/device cohort', async () => {
  const visitor = crypto.randomUUID();
  const desktop = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
  const mobile = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' };
  const events = [
    { event_id: crypto.randomUUID(), attribution: { gclid: 'synthetic-google-click' }, headers: desktop },
    { event_id: crypto.randomUUID(), attribution: { utm_source: 'fb', utm_medium: 'paid_social', fbclid: 'synthetic-meta-click' }, headers: mobile },
    { event_id: crypto.randomUUID(), attribution: { utm_source: 'facebook', utm_medium: 'cpc' }, headers: mobile }
  ];
  const leadIds = [];
  try {
    for (const { headers, ...event } of events) {
      const body = { ...event, visitor_id: visitor, path: '/', analytics_consent: true };
      const accepted = await jsonCall('/api/visits', { method: 'POST', body, headers });
      assert.equal(accepted.status, 200, JSON.stringify(accepted.body)); assert.equal(accepted.body.duplicate, false);
      const repeat = await jsonCall('/api/visits', { method: 'POST', body, headers }); assert.equal(repeat.body.duplicate, true);
    }
    const conflict = await jsonCall('/api/visits', { method: 'POST', headers: desktop, body: { event_id: events[0].event_id, visitor_id: visitor, path: '/', analytics_consent: true, attribution: { utm_source: 'facebook' } } });
    assert.equal(conflict.status, 409);
    assert.equal((await db.prepare('SELECT traffic_source FROM visit_events WHERE event_id=?').bind(events[0].event_id).first()).traffic_source, 'google');
    const payload = leadPayload({ visitor_id: visitor, analytics_consent: true, visit_event_id: events[1].event_id, attribution: { latest_touch: { gclid: 'stale-google-should-not-win' } } });
    const first = await jsonCall('/api/leads', { method: 'POST', headers: desktop, body: payload });
    assert.equal(first.status, 201); leadIds.push(first.body.lead_id);
    const duplicate = await jsonCall('/api/leads', { method: 'POST', headers: desktop, body: payload }); assert.equal(duplicate.body.duplicate, true);
    const second = await jsonCall('/api/leads', { method: 'POST', body: { ...payload, idempotency_key: crypto.randomUUID() } }); leadIds.push(second.body.lead_id);
    assert.equal(second.status, 201);
    const detail = (await jsonCall(`/api/admin/leads/${first.body.lead_id}`)).body.lead;
    assert.equal(detail.traffic_source, 'facebook'); assert.equal(detail.traffic_type, 'paid'); assert.equal(detail.device, 'mobile');
    const url = `/api/admin/metrics?from=${today()}&to=${today()}`;
    const all = await jsonCall(`${url}&visitor_mode=all&source=facebook&traffic=paid&device=mobile`);
    assert.deepEqual(all.body.totals, { visitors: 2, conversions: 1, leads: 2, conversion_rate: 50 });
    assert.deepEqual(all.body.lifetime_totals, all.body.totals);
    const unique = await jsonCall(`${url}&visitor_mode=unique&source=facebook&traffic=paid&device=mobile`);
    assert.deepEqual(unique.body.totals, { visitors: 1, conversions: 1, leads: 2, conversion_rate: 100 });
    const combinedAll = await jsonCall(`${url}&visitor_mode=all&traffic=paid`);
    const combinedUnique = await jsonCall(`${url}&visitor_mode=unique&traffic=paid`);
    assert.equal(combinedAll.body.totals.visitors, 3); assert.equal(combinedUnique.body.totals.visitors, 1);
    assert.equal((await jsonCall(`${url}&source=google&device=desktop&traffic=paid`)).body.totals.conversions, 0);
    assert.equal((await jsonCall(`${url}&source=facebook&device=desktop&traffic=paid`)).body.totals.visitors, 0);
    const listed = await jsonCall('/api/admin/leads?source=facebook&device=mobile&traffic=paid');
    assert.equal(listed.body.total, 2); assert.ok(listed.body.leads.every(lead => lead.traffic_source === 'facebook'));
    const google = await jsonCall('/api/admin/leads?source=google'); assert.equal(google.body.total, 0);
    for (const override of [{ visit_event_id: null }, { visit_event_id: events[0].event_id, visitor_id: crypto.randomUUID() }]) {
      const result = await jsonCall('/api/leads', { method: 'POST', headers: desktop, body: leadPayload({ visitor_id: visitor, analytics_consent: true, attribution: { latest_touch: { gclid: 'synthetic-google-click' } }, ...override }) });
      assert.equal(result.status, 201); leadIds.push(result.body.lead_id);
      assert.equal((await db.prepare('SELECT visit_event_id FROM leads WHERE id=?').bind(result.body.lead_id).first()).visit_event_id, null);
    }
    const unmeasured = await jsonCall(`${url}&source=google&traffic=paid&device=desktop&visitor_mode=all`);
    assert.deepEqual(unmeasured.body.totals, { visitors: 1, conversions: 0, leads: 2, conversion_rate: 0 });
    for (const source of ['all', 'google', 'facebook', 'unknown']) for (const device of ['all', 'desktop', 'mobile', 'unknown']) for (const mode of ['all', 'unique']) {
      const result = await jsonCall(`${url}&source=${source}&device=${device}&visitor_mode=${mode}`);
      assert.equal(result.status, 200); assert.ok(result.body.totals.conversions <= result.body.totals.visitors, JSON.stringify({ source, device, mode }));
    }
    const stored = JSON.stringify((await db.prepare('SELECT * FROM visit_events WHERE event_id=?').bind(events[0].event_id).first()));
    for (const forbidden of [visitor, 'synthetic-google-click', 'stale-google-should-not-win', 'alex@example.invalid', 'User-Agent']) assert.ok(!stored.includes(forbidden));
  } finally {
    await db.batch([...leadIds.map(id => db.prepare('DELETE FROM activity WHERE lead_id=?').bind(id)), ...leadIds.map(id => db.prepare('DELETE FROM leads WHERE id=?').bind(id)), ...events.map(event => db.prepare('DELETE FROM visit_events WHERE event_id=?').bind(event.event_id))]);
  }
});
test('an event from a different reporting day or landing page cannot create a conversion', async () => {
  const visitor = crypto.randomUUID(); const id = crypto.randomUUID(); const leadIds = [];
  await call('/api/visits', { method: 'POST', body: { event_id: id, visitor_id: visitor, path: '/', analytics_consent: true, attribution: { gclid: 'synthetic-click' } } });
  const { createLead } = await import('../src/repository.js');
  const config = JSON.parse(await readFile(`${root}tests/fixtures/site-config.json`, 'utf8'));
  config.allowedPaths.push('/another-page');
  const env = { DB: db, SESSION_SECRET: 'test-only-session-secret-with-at-least-32-bytes' };
  try {
    for (const mismatch of ['day', 'path']) {
      await db.prepare('UPDATE visit_events SET reporting_day=?,path=? WHERE event_id=?').bind(mismatch === 'day' ? '2000-01-01' : today(), mismatch === 'path' ? '/another-page' : '/', id).run();
      const result = await createLead(env, new Request('https://site.test/api/leads'), leadPayload({ visitor_id: visitor, analytics_consent: true, visit_event_id: id }), config);
      leadIds.push(result.lead_id);
      assert.equal((await db.prepare('SELECT visit_event_id FROM leads WHERE id=?').bind(result.lead_id).first()).visit_event_id, null, mismatch);
    }
  } finally {
    await db.batch([...leadIds.map(leadId => db.prepare('DELETE FROM activity WHERE lead_id=?').bind(leadId)), ...leadIds.map(leadId => db.prepare('DELETE FROM leads WHERE id=?').bind(leadId)), db.prepare('DELETE FROM visit_events WHERE event_id=?').bind(id)]);
  }
});
test('traffic filters reject invalid values and measured visits require a UUID event ID', async () => {
  for (const filter of ['source=untrusted', 'traffic=cpc', 'device=phone', 'visitor_mode=person', 'source=google&source=facebook']) {
    for (const endpoint of ['metrics', 'leads']) assert.equal((await call(`/api/admin/${endpoint}?${filter}`)).status, 400);
  }
  for (const event_id of [undefined, 'raw-email@example.invalid']) assert.equal((await call('/api/visits', { method: 'POST', body: { visitor_id: crypto.randomUUID(), event_id, path: '/', analytics_consent: true } })).status, 400);
});
test('additive migration preserves historical daily uniques and verified lead attribution without inventing visits or devices', async () => {
  const history = await mf.getD1Database('MIGRATION_TEST');
  const apply = async name => history.batch(unstable_splitSqlQuery(await readFile(`${root}migrations/${name}`, 'utf8')).map(sql => history.prepare(sql)));
  await apply('0001_crm.sql');
  await history.prepare('INSERT INTO visits(reporting_day,path,visitor_hash,created_at) VALUES(?,?,?,?)').bind('2020-02-29', '/', 'historic-hash', '2020-02-29T12:00:00Z').run();
  const id = crypto.randomUUID();
  await history.prepare('INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,form_name,form_data,attribution,landing_page,visitor_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, crypto.randomUUID(), crypto.randomUUID(), 'historic', '2020-02-29T12:00:01Z', '2020-02-29T12:00:01Z', '2020-02-29', 'enquiry', '{}', JSON.stringify({ first_touch: { gclid: 'earlier-google' }, latest_touch: { utm_source: 'instagram', fbclid: 'meta-click' } }), '/', 'historic-hash').run();
  const organicId = crypto.randomUUID();
  await history.prepare('INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,form_name,form_data,attribution,landing_page,visitor_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(organicId, crypto.randomUUID(), crypto.randomUUID(), 'historic-organic', '2020-02-29T12:00:02Z', '2020-02-29T12:00:02Z', '2020-02-29', 'enquiry', '{}', JSON.stringify({ latest_touch: { utm_source: 'fb', utm_medium: 'organic_social', fbclid: 'meta-click' } }), '/', 'historic-hash').run();
  await apply('0002_traffic_dimensions.sql');
  const organicLead = await history.prepare('SELECT traffic_source,traffic_type FROM leads WHERE id=?').bind(organicId).first();
  assert.deepEqual(organicLead, { traffic_source: 'facebook', traffic_type: 'organic' });
  const old = await history.prepare('SELECT * FROM visits').all(); assert.equal(old.results.length, 1);
  const event = await history.prepare('SELECT * FROM visit_events').first();
  assert.equal(event.legacy, 1); assert.equal(event.traffic_source, 'unknown'); assert.equal(event.traffic_type, 'unknown'); assert.equal(event.device, 'unknown');
  const lead = await history.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
  assert.equal(lead.visit_event_id, event.event_id); assert.equal(lead.traffic_source, 'instagram'); assert.equal(lead.traffic_type, 'unknown'); assert.equal(lead.device, 'unknown');
  for(const file of ['0003_admin_operations.sql','0004_owner_identity.sql','0005_data_lifecycle.sql'])await apply(file);
  const { metrics } = await import('../src/repository.js');
  const base = 'https://site.test/api/admin/metrics?from=2020-02-29&to=2020-02-29';
  const result = await metrics({ DB: history }, new URL(base), { timezone: 'UTC', analyticsMode: 'consent' });
  assert.deepEqual(result.totals, { visitors: 1, conversions: 1, leads: 2, conversion_rate: 100 });
  assert.equal(result.coverage.all_visits_complete, false); assert.equal(result.coverage.legacy_visits, 1); assert.ok(result.warnings[0].includes('cannot be recovered'));
  const google = await metrics({ DB: history }, new URL(`${base}&source=google`), { timezone: 'UTC', analyticsMode: 'consent' });
  assert.equal(google.totals.visitors, 0); assert.equal(google.totals.conversions, 0);
  const unknown = await metrics({ DB: history }, new URL(`${base}&source=unknown&device=unknown`), { timezone: 'UTC', analyticsMode: 'consent' });
  assert.equal(unknown.totals.visitors, 1); assert.equal(unknown.totals.conversions, 1);
});
test('webhooks reject private destinations, enqueue once, deliver independently with stable event ID', async () => {
  for (const url of ['http://hooks.example.com', 'https://127.0.0.1/path', 'https://user:password@hooks.example.com', 'https://hooks.local', 'https://private.example.com']) assert.equal((await call('/api/admin/webhooks', { method: 'POST', body: { name: 'Bad', url } })).status, 400, url);
  const hook = await jsonCall('/api/admin/webhooks', { method: 'POST', body: { name: 'CRM destination', url: 'https://hooks.example.com/lead', enabled: true } }); assert.equal(hook.status, 201, JSON.stringify(hook.body));
  const body = leadPayload(); const result = await jsonCall('/api/leads', { method: 'POST', body }); assert.equal(result.status, 201);
  await mf.getWorker(); // dispatchFetch waits for waitUntil when its response is consumed in Miniflare.
  // Read through D1 until the independently scheduled delivery finishes, bounded to one second.
  let rows;
  for (let i = 0; i < 50; i++) { rows = await db.prepare('SELECT * FROM webhook_outbox WHERE lead_id=?').bind(result.body.lead_id).all(); if (rows.results[0]?.status === 'delivered') break; await new Promise(r => setTimeout(r, 20)); }
  assert.equal(rows.results.length, 1); assert.equal(rows.results[0].status, 'delivered'); assert.equal(outbound.length, 1);
  assert.equal(outbound[0].body.event_id, rows.results[0].id); assert.equal(outbound[0].body.lead.id, result.body.lead_id);
  await call('/api/leads', { method: 'POST', body }); assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM webhook_outbox WHERE lead_id=?').bind(result.body.lead_id).first()).n, 1);
  const list = await jsonCall('/api/admin/webhooks'); assert.equal(list.body.webhooks[0].enabled, true); assert.ok(list.body.webhooks[0].last_delivered_at);
  assert.equal((await call(`/api/admin/webhooks/${hook.body.webhook.id}`, { method: 'DELETE' })).status, 200);
});
test('webhook failure preserves accepted CRM receipt and schedules bounded retries', async () => {
  const hook = await jsonCall('/api/admin/webhooks', { method: 'POST', body: { name: 'Failing receiver', url: 'https://fail.example.com/lead' } }); assert.equal(hook.status, 201);
  const saved = await jsonCall('/api/leads', { method: 'POST', body: leadPayload() }); assert.equal(saved.status, 201); assert.equal(saved.body.ok, true);
  let row;
  for (let i = 0; i < 50; i++) { row = await db.prepare('SELECT * FROM webhook_outbox WHERE lead_id=?').bind(saved.body.lead_id).first(); if (row?.attempts && row.status === 'pending') break; await new Promise(r => setTimeout(r, 20)); }
  assert.equal(row.status, 'pending'); assert.equal(row.attempts, 1); assert.equal(row.last_error, 'HTTP 503'); assert.ok(row.next_attempt_at > Date.now() / 1000);
  assert.equal((await call(`/api/admin/leads/${saved.body.lead_id}`)).status, 200);
  const worker = await mf.getWorker();
  for (let attempt = 2; attempt <= 5; attempt++) {
    await db.prepare('UPDATE webhook_outbox SET next_attempt_at=0 WHERE id=?').bind(row.id).run();
    await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() });
    row = await db.prepare('SELECT * FROM webhook_outbox WHERE id=?').bind(row.id).first();
    assert.equal(row.attempts, attempt); assert.equal(row.status, attempt === 5 ? 'failed' : 'pending');
  }
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() });
  assert.equal((await db.prepare('SELECT attempts FROM webhook_outbox WHERE id=?').bind(row.id).first()).attempts, 5);
  await call(`/api/admin/webhooks/${hook.body.webhook.id}`, { method: 'DELETE' });
});
test('webhook redirects never forward PII to an unvalidated destination', async () => {
  const hook = await jsonCall('/api/admin/webhooks', { method: 'POST', body: { name: 'Redirecting receiver', url: 'https://redirect.example.com/lead' } }); assert.equal(hook.status, 201);
  const saved = await jsonCall('/api/leads', { method: 'POST', body: leadPayload() }); assert.equal(saved.status, 201);
  let row;
  for (let i = 0; i < 50; i++) { row = await db.prepare('SELECT * FROM webhook_outbox WHERE lead_id=?').bind(saved.body.lead_id).first(); if (row?.attempts && row.status === 'pending') break; await new Promise(r => setTimeout(r, 20)); }
  assert.equal(row.last_error, 'HTTP 302'); assert.equal(row.status, 'pending');
  await call(`/api/admin/webhooks/${hook.body.webhook.id}`, { method: 'DELETE' });
});
test('disabled analytics and invalid browser identifiers are never measured', async () => {
  const request = new Request('https://site.test/api/visits');
  const body = { visitor_id: crypto.randomUUID(), analytics_consent: true };
  assert.equal(await visitorHash({}, request, body, today(), { analyticsMode: 'disabled' }), null);
  assert.equal(await visitorHash({}, request, { ...body, visitor_id: 'email@example.com' }, today(), { analyticsMode: 'consent' }), null);
});
test('public destination validation rejects private and reserved addresses', () => {
  for (const address of ['127.0.0.1', '10.1.1.1', '192.168.1.1', '169.254.169.254', '172.16.0.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('93.184.216.34'), true); assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  assert.throws(() => validateWebhookUrl('https://2130706433'), /HTTPS hostname/);
});
test('soft deletion removes contact from CRM and blocks reuse of its old receipt', async () => {
  assert.equal((await call(`/api/admin/leads/${firstLead}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call(`/api/admin/leads/${firstLead}`)).status, 404);
  const row = await db.prepare('SELECT deleted_at FROM leads WHERE id=?').bind(firstLead).first(); assert.ok(row.deleted_at);
});
test('login rate limiting persists in D1 and logout revokes the server session', async () => {
  let limited;
  for (let i = 0; i < 9; i++) limited = await call('/api/auth/login', { method: 'POST', auth: false, ip: '203.0.113.77', body: { username:'owner', password: 'wrong' } });
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal((await call('/api/auth/logout', { method: 'POST' })).status, 200);
  assert.equal((await call('/api/auth/session')).status, 401);
  assert.equal((await call('/api/admin/leads')).status, 401);
});
test('a database failure cannot return an accepted receipt', async () => {
  await db.prepare('ALTER TABLE leads RENAME TO unavailable_leads').run();
  try {
    const result = await jsonCall('/api/leads', { method: 'POST', body: leadPayload() });
    assert.equal(result.status, 503); assert.ok(!result.body.ok); assert.ok(!result.body.lead_id);
    assert.ok(!JSON.stringify(result.body).includes('SQLITE'));
  } finally { await db.prepare('ALTER TABLE unavailable_leads RENAME TO leads').run(); }
});
