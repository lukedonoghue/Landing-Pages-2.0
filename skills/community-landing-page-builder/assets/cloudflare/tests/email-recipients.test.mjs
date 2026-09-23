import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';

const root = fileURLToPath(new URL('../', import.meta.url));
const accountId = '1'.repeat(32);
const providerId = '2'.repeat(32);
const recipientEmail = 'existing-recipient@example.invalid';
const password = 'synthetic-owner-password-for-recipient-tests';
const salt = '112233445566778899aabbccddeeff00';
const hash = `pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')}`;
let mf, db, cookie, managerCookie, viewerCookie, verified = null, mismatch = false, manyPages = false, failCreate = false, providerCalls = [], sequence = 0;

function providerAddress() {
  return { id:providerId, email:mismatch ? 'different@example.invalid' : recipientEmail, created:'2026-09-22T00:00:00Z', modified:'2026-09-22T00:00:00Z', verified };
}

function providerResponse(result, resultInfo) {
  return Response.json({ success:true, errors:[], messages:[], result, ...(resultInfo ? {result_info:resultInfo} : {}) });
}

async function call(path, { method='GET', body, auth=true, session, origin='https://site.test', ip } = {}) {
  const selectedCookie = session === undefined ? (auth ? cookie : null) : session;
  const headers = { 'CF-Connecting-IP':ip || `198.51.100.${++sequence % 240 + 1}`, ...(selectedCookie ? {Cookie:selectedCookie,'X-CRM-Confirm-Password':password} : {}) };
  if (method !== 'GET') Object.assign(headers, { Origin:origin, 'Content-Type':'application/json' });
  return mf.dispatchFetch(`https://site.test${path}`, { method, headers, body:body === undefined ? undefined : JSON.stringify(body), redirect:'manual' });
}

before(async () => {
  const bundle = await build({ stdin:{ contents:`import worker from './src/worker.js'; export default {fetch(request,env,ctx){return worker.fetch(request,{...env,EMAIL:{send:message=>env.DB.prepare('INSERT INTO test_mail(recipient,payload) VALUES(?,?)').bind(message.to,JSON.stringify(message)).run()}},ctx)}}`, resolveDir:root }, bundle:true, write:false, format:'esm', platform:'browser', target:'es2022' });
  mf = new Miniflare({
    modules:true,
    script:bundle.outputFiles[0].text,
    compatibilityDate:'2026-07-22',
    d1Databases:{DB:'recipient-tests'},
    bindings:{
      ADMIN_USERNAME:'owner', ADMIN_PASSWORD_HASH:hash, SESSION_SECRET:'synthetic-session-secret-at-least-32-characters',
      CRM_EMAIL_FROM:'crm@example.invalid', CRM_PUBLIC_ORIGIN:'https://site.test',
      CF_EMAIL_ROUTING_ACCOUNT_ID:accountId, CF_EMAIL_ROUTING_TOKEN:'narrow-synthetic-token-never-used-live'
    },
    serviceBindings:{ASSETS:()=>new Response('asset')},
    outboundService:async request => {
      providerCalls.push({ method:request.method, url:request.url, authorization:request.headers.get('Authorization'), body:request.method === 'POST' ? await request.clone().json() : null });
      const url = new URL(request.url);
      assert.equal(url.origin, 'https://api.cloudflare.com');
      assert.equal(request.headers.get('Authorization'), 'Bearer narrow-synthetic-token-never-used-live');
      if (request.method === 'GET' && url.pathname.endsWith('/email/routing/addresses')) {
        if (manyPages) return providerResponse(Array.from({length:50}, (_, index) => ({id:String(index).padStart(32, '0'),email:`page-${url.searchParams.get('page')}-${index}@example.invalid`,verified:null})), {page:Number(url.searchParams.get('page')),per_page:50,count:50,total_count:250,total_pages:5});
        return providerResponse([providerAddress()], {page:1,per_page:50,count:1,total_count:1,total_pages:1});
      }
      if (request.method === 'GET' && url.pathname.endsWith(`/email/routing/addresses/${providerId}`)) return providerResponse(providerAddress());
      if (request.method === 'POST' && url.pathname.endsWith('/email/routing/addresses')) {
        if (failCreate) return Response.json({success:false,errors:[{message:'synthetic failure'}]}, {status:503});
        return providerResponse({id:'a'.repeat(32),email:(await request.clone().json()).email,verified:null});
      }
      return Response.json({success:false,errors:[{message:'unexpected synthetic request'}]}, {status:404});
    }
  });
  db = await mf.getD1Database('DB');
  for (const name of (await readdir(`${root}migrations`)).filter(name => name.endsWith('.sql')).sort()) {
    const statements = unstable_splitSqlQuery(await readFile(`${root}migrations/${name}`, 'utf8')).map(sql => db.prepare(sql));
    await db.batch(statements);
  }
  await db.prepare('CREATE TABLE test_mail(sequence INTEGER PRIMARY KEY AUTOINCREMENT,recipient TEXT,payload TEXT)').run();
  const login = await call('/api/auth/login', {method:'POST',body:{username:'owner',password},auth:false});
  assert.equal(login.status, 200);
  cookie = login.headers.get('Set-Cookie').split(';')[0];
  const stamp='2026-09-22T00:00:00Z';
  await db.batch([
    db.prepare("INSERT INTO crm_users(id,username,email,role,status,password_hash,email_verified_at,created_at,updated_at) VALUES('manager-fixture','manager-fixture','manager@example.invalid','manager','active',?,?,?,?)").bind(hash,stamp,stamp,stamp),
    db.prepare("INSERT INTO crm_users(id,username,email,role,status,password_hash,email_verified_at,created_at,updated_at) VALUES('viewer-fixture','viewer-fixture','viewer@example.invalid','viewer','active',?,?,?,?)").bind(hash,stamp,stamp,stamp)
  ]);
  const managerLogin=await call('/api/auth/login',{method:'POST',body:{username:'manager-fixture',password},auth:false});
  const viewerLogin=await call('/api/auth/login',{method:'POST',body:{username:'viewer-fixture',password},auth:false});
  managerCookie=managerLogin.headers.get('Set-Cookie').split(';')[0];
  viewerCookie=viewerLogin.headers.get('Set-Cookie').split(';')[0];
});

after(async () => { await mf?.dispose(); });

test('recipient onboarding is authenticated, admin-only and CSRF protected', async () => {
  assert.equal((await call('/api/admin/users/email-recipients', {method:'POST',body:{email:recipientEmail},auth:false})).status, 401);
  assert.equal((await call('/api/admin/users/email-recipients', {method:'POST',body:{email:recipientEmail},origin:'https://attacker.test'})).status, 403);
  assert.equal((await call('/api/admin/users/email-recipients', {method:'POST',body:{email:recipientEmail},session:managerCookie})).status, 403);
  assert.equal((await call(`/api/admin/users/email-recipients/${crypto.randomUUID()}/check`, {method:'POST',body:{},session:managerCookie})).status, 403);
  assert.equal((await call('/api/admin/users/email-recipients', {method:'POST',body:{email:recipientEmail},session:viewerCookie})).status, 403);
  assert.equal((await call(`/api/admin/users/email-recipients/${crypto.randomUUID()}/check`, {method:'POST',body:{},session:viewerCookie})).status, 403);
  assert.equal(providerCalls.length, 0);
});

test('existing Cloudflare recipient is adopted without a duplicate create', async () => {
  const response = await call('/api/admin/users/email-recipients', {method:'POST',body:{email:recipientEmail}});
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal((await response.json()).status, 'pending');
  assert.deepEqual(providerCalls.map(call => call.method), ['GET']);
  const row = await db.prepare('SELECT email,provider_id,status,provider_verified_at FROM crm_email_recipients WHERE email=?').bind(recipientEmail).first();
  assert.deepEqual(row, {email:recipientEmail,provider_id:providerId,status:'pending',provider_verified_at:null});
  const again = await call('/api/admin/users/email-recipients', {method:'POST',body:{email:recipientEmail}});
  assert.equal(again.status, 201);
  assert.deepEqual(providerCalls.map(call => call.method), ['GET']);
});

test('concurrent create issues one provider request and ambiguous failure is never retried', async () => {
  const raceEmail='race-recipient@example.invalid', beforePosts=providerCalls.filter(call=>call.method==='POST').length;
  const responses=await Promise.all([
    call('/api/admin/users/email-recipients',{method:'POST',body:{email:raceEmail},ip:'198.51.100.190'}),
    call('/api/admin/users/email-recipients',{method:'POST',body:{email:raceEmail},ip:'198.51.100.191'})
  ]);
  assert.deepEqual(responses.map(response=>response.status),[201,201]);
  assert.equal(providerCalls.filter(call=>call.method==='POST').length,beforePosts+1);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM crm_email_recipients WHERE email=?').bind(raceEmail).first('n'),1);

  const failedEmail='uncertain-recipient@example.invalid'; failCreate=true;
  const failed=await call('/api/admin/users/email-recipients',{method:'POST',body:{email:failedEmail},ip:'198.51.100.192'});
  failCreate=false;
  assert.equal(failed.status,503);
  const afterFailure=providerCalls.filter(call=>call.method==='POST').length;
  const retry=await call('/api/admin/users/email-recipients',{method:'POST',body:{email:failedEmail},ip:'198.51.100.193'});
  assert.equal(retry.status,409);
  assert.match((await retry.json()).error,/will not resend it automatically/);
  assert.equal(providerCalls.filter(call=>call.method==='POST').length,afterFailure);
});

test('bounded provider discovery refuses to guess beyond four pages', async () => {
  manyPages = true;
  const beforePosts = providerCalls.filter(call => call.method === 'POST').length;
  const response = await call('/api/admin/users/email-recipients', {method:'POST',body:{email:'beyond-bound@example.invalid'},ip:'198.51.100.199'});
  manyPages = false;
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /bounded safety check/);
  assert.equal(providerCalls.filter(call => call.method === 'POST').length, beforePosts);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM crm_email_recipients WHERE email=?').bind('beyond-bound@example.invalid').first('n'), 0);
});

test('pending provider status holds one invitation and checks are rate limited', async () => {
  const invite = await call('/api/admin/users', {method:'POST',body:{email:recipientEmail,username:'pending-recipient',role:'viewer'}});
  assert.equal(invite.status, 202);
  assert.equal((await invite.json()).pending_verification,true);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM crm_users WHERE email=?").bind(recipientEmail).first('n'), 0);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM test_mail').first('n'), 0);

  const pending=await db.prepare('SELECT id,pending_username,pending_role FROM crm_email_recipients WHERE email=?').bind(recipientEmail).first();
  assert.deepEqual({pending_username:pending.pending_username,pending_role:pending.pending_role},{pending_username:'pending-recipient',pending_role:'viewer'});
  const id = pending.id;
  const statuses = [];
  for (let index = 0; index < 7; index += 1) statuses.push((await call(`/api/admin/users/email-recipients/${id}/check`, {method:'POST',body:{},ip:'198.51.100.200'})).status);
  assert.deepEqual(statuses, [200,200,200,200,200,200,429]);
  assert.equal((await db.prepare('SELECT provider_verified_at FROM crm_email_recipients WHERE id=?').bind(id).first()).provider_verified_at, null);
});

test('concurrent verified checks continue exactly one held invitation', async () => {
  verified = '2026-09-22T12:00:00Z';
  const id = await db.prepare('SELECT id FROM crm_email_recipients WHERE email=?').bind(recipientEmail).first('id');
  const checked = await Promise.all([
    call(`/api/admin/users/email-recipients/${id}/check`, {method:'POST',body:{},ip:'198.51.100.201'}),
    call(`/api/admin/users/email-recipients/${id}/check`, {method:'POST',body:{},ip:'198.51.100.202'})
  ]);
  assert.deepEqual(checked.map(response=>response.status).sort(),[200,409]);
  const result=await checked.find(response=>response.status===200).json(); assert.equal(result.verified_at, verified); assert.equal(result.invitation_sent,true);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM crm_users WHERE email=? AND username=?').bind(recipientEmail,'pending-recipient').first('n'),1);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?').bind(recipientEmail).first('n'), 1);
  assert.equal((await db.prepare('SELECT pending_username FROM crm_email_recipients WHERE id=?').bind(id).first()).pending_username,null);
});

test('provider identity mismatch fails closed and never calls email binding', async () => {
  mismatch = true;
  const before = await db.prepare('SELECT COUNT(*) AS n FROM test_mail').first('n');
  const user = await db.prepare('SELECT id FROM crm_users WHERE email=?').bind(recipientEmail).first();
  const resend = await call(`/api/admin/users/${user.id}/invite`, {method:'POST',body:{},ip:'198.51.100.203'});
  assert.equal(resend.status, 503);
  assert.match((await resend.json()).error, /unexpected recipient record/);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM test_mail').first('n'), before);
  const row = await db.prepare('SELECT status,provider_verified_at FROM crm_email_recipients WHERE email=?').bind(recipientEmail).first();
  assert.deepEqual(row, {status:'unknown',provider_verified_at:null});
});
