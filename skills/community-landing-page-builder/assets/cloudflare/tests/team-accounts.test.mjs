import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pbkdf2Sync} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';

const root=fileURLToPath(new URL('../',import.meta.url));
const password='synthetic-test-password-for-team-accounts';
const newPassword='different-synthetic-test-password-for-team';
const salt='112233445566778899aabbccddeeff00';
const hash=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
let mf,db,ownerCookie,sequence=0,mailGateEntered,releaseMailGate,mailGateBlock=Promise.resolve(),updateGateEntered,releaseUpdateGate,updateGateBlock=Promise.resolve();
function armMailGate() {
  const entered=new Promise(resolve=>{mailGateEntered=resolve;});
  mailGateBlock=new Promise(resolve=>{releaseMailGate=resolve;});
  return {entered,release(){releaseMailGate();mailGateEntered=null;mailGateBlock=Promise.resolve();}};
}
function armUpdateGate() {
  const entered=new Promise(resolve=>{updateGateEntered=resolve;});
  updateGateBlock=new Promise(resolve=>{releaseUpdateGate=resolve;});
  return {entered,release(){releaseUpdateGate();updateGateEntered=null;updateGateBlock=Promise.resolve();}};
}
async function call(path,{method='GET',body,cookie=ownerCookie,headers={}}={}) {
  return mf.dispatchFetch(`https://site.test${path}`,{method,redirect:'manual',headers:{'CF-Connecting-IP':`198.51.${Math.floor(++sequence/200)}.${sequence%200+1}`,...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:'https://site.test','Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
}
async function login(username='owner',secret=password) {
  const r=await call('/api/auth/login',{method:'POST',cookie:null,body:{username,password:secret}});
  return {status:r.status,cookie:r.headers.get('Set-Cookie')?.split(';')[0]};
}
async function seed(role,status='active') {
  const id=crypto.randomUUID(),name=`${role}-${id.slice(0,8)}`,email=`${name}@example.invalid`;
  await db.prepare('INSERT INTO crm_users(id,username,email,role,status,password_hash,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,name,email,role,status,hash,status==='active'?new Date().toISOString():null,'2026-09-21','2026-09-21').run();
  await db.prepare('INSERT INTO test_verified_recipients(email) VALUES(?)').bind(email).run();
  return {id,name,email,cookie:(await login(name)).cookie};
}
async function lastToken(address) {
  const row=await db.prepare('SELECT payload FROM test_mail WHERE recipient=? ORDER BY sequence DESC LIMIT 1').bind(address).first();
  return tokenFromPayload(row.payload);
}
const tokenFromPayload=payload=>/#token=([a-f0-9]{64})/.exec(JSON.parse(payload).text)[1];
before(async()=>{
  // A test-only mail sink exercises the same send contract without contacting a provider.
  const bundle=await build({stdin:{contents:`import worker from './src/worker.js'; export default {async fetch(request,env,ctx){
    const verified=await env.DB.prepare('SELECT email FROM test_verified_recipients').all();
    const database=new Proxy(env.DB,{get(target,key){if(key==='prepare')return sql=>{const statement=target.prepare(sql);if(sql.startsWith('SELECT password_hash,version,updated_at,username FROM admin_credentials'))return new Proxy(statement,{get(inner,property){if(property==='first')return async(...args)=>{const row=await inner.first(...args);await env.UPDATE_GATE.fetch('https://update-gate.test/wait');return row;};const value=inner[property];return typeof value==='function'?value.bind(inner):value;}});return statement;};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
    return worker.fetch(request,{...env,DB:database,CRM_VERIFIED_RECIPIENTS:JSON.stringify(verified.results.map(row=>row.email)),EMAIL:{send:async message=>{
      const flag=await env.DB.prepare('SELECT enabled FROM test_mail_failure').first();
      if(flag.enabled)throw new Error('Synthetic provider failure');
      await env.MAIL_GATE.fetch('https://mail-gate.test/wait');
      await env.DB.prepare('INSERT INTO test_mail(recipient,payload) VALUES(?,?)').bind(message.to,JSON.stringify(message)).run();
      return {messageId:crypto.randomUUID()};
    }}},ctx);
  }}`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-22',d1Databases:{DB:'team-tests'},bindings:{ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:hash,SESSION_SECRET:'synthetic-session-secret-at-least-32-characters',CRM_EMAIL_FROM:'crm@example.invalid',CRM_PUBLIC_ORIGIN:'https://site.test'},serviceBindings:{ASSETS:()=>new Response('asset'),MAIL_GATE:async()=>{if(mailGateEntered){const entered=mailGateEntered;mailGateEntered=null;entered();await mailGateBlock;}return new Response('ok');},UPDATE_GATE:async()=>{if(updateGateEntered){const entered=updateGateEntered;updateGateEntered=null;entered();await updateGateBlock;}return new Response('ok');}}});
  db=await mf.getD1Database('DB');
  for(const n of (await readdir(`${root}migrations`)).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile(`${root}migrations/${n}`,'utf8')).map(sql=>db.prepare(sql)));
  await db.batch([db.prepare('CREATE TABLE test_mail(sequence INTEGER PRIMARY KEY AUTOINCREMENT,recipient TEXT,payload TEXT)'),db.prepare('CREATE TABLE test_mail_failure(enabled INTEGER)'),db.prepare('INSERT INTO test_mail_failure VALUES(0)'),db.prepare('CREATE TABLE test_verified_recipients(email TEXT)'),db.prepare("INSERT INTO test_verified_recipients VALUES('invited@example.invalid'),('failed@example.invalid'),('owner-mail@example.invalid')")]);
  ownerCookie=(await login()).cookie;
});
after(async()=>{await mf?.dispose()});

test('owner remains compatible and anonymous user-management is blocked',async()=>{
  assert.ok(ownerCookie);
  assert.equal((await call('/api/admin/users',{cookie:null})).status,401);
  const session=await (await call('/api/auth/session')).json();
  assert.equal(session.user.role,'admin');assert.equal(session.permissions.manage_users,true);
  assert.equal((await call('/api/admin/users/owner',{method:'PATCH',body:{role:'viewer'}})).status,403);
});
test('manager cannot administer identities; viewer API is read-only including export and settings',async()=>{
  const manager=await seed('manager'),viewer=await seed('viewer');
  for(const user of [manager,viewer])for(const method of ['GET','POST'])assert.equal((await call('/api/admin/users',{method,body:method==='POST'?{}:undefined,cookie:user.cookie})).status,403);
  assert.equal((await call('/api/admin/webhooks',{cookie:manager.cookie})).status,200);
  for(const path of ['/api/admin/data/retention','/api/admin/data/erasures','/api/admin/data/erasure-records'])assert.equal((await call(path,{cookie:manager.cookie})).status,200,path);
  for(const [path,body] of [['/api/admin/webhooks',{}],['/api/admin/data/retention/preview',{}],['/api/admin/data/erasures/preview',{}]])assert.equal((await call(path,{method:'POST',body,cookie:manager.cookie})).status,400,path);
  for(const path of ['/api/admin/config','/api/admin/leads','/api/admin/metrics','/api/admin/account'])assert.equal((await call(path,{cookie:viewer.cookie})).status,200,path);
  for(const path of ['/api/admin/leads/export.csv','/api/admin/webhooks','/api/admin/data/retention'])assert.equal((await call(path,{cookie:viewer.cookie})).status,403,path);
  for(const [method,path] of [['POST','/api/admin/notifications/acknowledge'],['POST','/api/admin/webhooks'],['PATCH',`/api/admin/leads/${crypto.randomUUID()}`],['POST',`/api/admin/leads/${crypto.randomUUID()}/notes`],['DELETE',`/api/admin/leads/${crypto.randomUUID()}`]])assert.equal((await call(path,{method,body:{},cookie:viewer.cookie})).status,403,path);
});
test('role and disable updates revoke existing sessions and cannot reactivate unverified accounts',async()=>{
  const user=await seed('manager');
  assert.equal((await call(`/api/admin/users/${user.id}`,{method:'PATCH',body:{role:'viewer'}})).status,200);
  assert.equal((await call('/api/auth/session',{cookie:user.cookie})).status,401);
  const fresh=await login(user.name);assert.equal(fresh.status,200);
  assert.equal((await (await call('/api/auth/session',{cookie:fresh.cookie})).json()).user.role,'viewer');
  assert.equal((await call(`/api/admin/users/${user.id}`,{method:'PATCH',body:{status:'disabled'}})).status,200);
  assert.equal((await login(user.name)).status,401);
  const pending=await seed('viewer','invited');
  assert.equal((await call(`/api/admin/users/${pending.id}`,{method:'PATCH',body:{status:'active'}})).status,409);
});
test('admin invitation requires email confirmation, stores only token hash, and is single-use',async()=>{
  const email='invited@example.invalid';
  const r=await call('/api/admin/users',{method:'POST',body:{email,username:'invited-user',role:'manager'}});
  assert.equal(r.status,201,await r.clone().text());
  assert.equal((await login(email)).status,401);
  const token=await lastToken(email),row=await db.prepare('SELECT * FROM crm_account_actions WHERE email=?').bind(email).first();
  assert.ok(!JSON.stringify(row).includes(token));
  const complete=()=>call('/api/auth/complete',{method:'POST',cookie:null,body:{token,password}});
  const responses=await Promise.all([complete(),complete()]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  assert.equal((await login(email)).status,200);
  const user=await db.prepare('SELECT * FROM crm_users WHERE email=?').bind(email).first();
  assert.equal(user.status,'active');assert.ok(user.email_verified_at);
});
test('verified recipient may use a different domain than the configured sender',async()=>{
  const email='consultant@agency.example';
  await db.prepare('INSERT INTO test_verified_recipients(email) VALUES(?)').bind(email).run();
  const response=await call('/api/admin/users',{method:'POST',body:{email,username:'outside-domain-consultant',role:'viewer'}});
  assert.equal(response.status,201,await response.clone().text());
  const message=JSON.parse((await db.prepare('SELECT payload FROM test_mail WHERE recipient=? ORDER BY sequence DESC LIMIT 1').bind(email).first()).payload);
  assert.equal(message.from,'crm@example.invalid');assert.equal(message.to,email);
  assert.notEqual(message.from.split('@')[1],message.to.split('@')[1]);
});
test('email failures and expired links never activate accounts',async()=>{
  await db.prepare('UPDATE test_mail_failure SET enabled=1').run();
  const failed=await call('/api/admin/users',{method:'POST',body:{email:'failed@example.invalid',username:'mail-failed',role:'viewer'}});
  assert.equal(failed.status,503);
  assert.equal((await db.prepare('SELECT status FROM crm_users WHERE username=?').bind('mail-failed').first()).status,'invited');
  await db.prepare('UPDATE test_mail_failure SET enabled=0').run();
  const user=await db.prepare('SELECT id FROM crm_users WHERE username=?').bind('mail-failed').first();
  await db.prepare("INSERT INTO test_verified_recipients(email) VALUES('corrected@example.invalid')").run();
  assert.equal((await call(`/api/admin/users/${user.id}`,{method:'PATCH',body:{email:'corrected@example.invalid',role:'viewer'}})).status,200);
  assert.equal((await call(`/api/admin/users/${user.id}/invite`,{method:'POST',body:{}})).status,200);
  const token=await lastToken('corrected@example.invalid');
  await db.prepare('UPDATE crm_account_actions SET expires_at=0 WHERE user_id=?').bind(user.id).run();
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token,password}})).status,400);
});
test('invitation correction cannot overwrite an account activated after its read',async()=>{
  const address='activation-race@example.invalid',corrected='activation-corrected@example.invalid',username='activation-race';
  await db.prepare('INSERT INTO test_verified_recipients(email) VALUES(?),(?)').bind(address,corrected).run();
  const created=await call('/api/admin/users',{method:'POST',body:{email:address,username,role:'manager'}});
  assert.equal(created.status,201);const id=(await created.json()).id,token=await lastToken(address);
  const gate=armUpdateGate();
  const correction=call(`/api/admin/users/${id}`,{method:'PATCH',body:{email:corrected,role:'viewer'}});
  await gate.entered;
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token,password}})).status,200);
  const active=await login(username);assert.equal(active.status,200);
  const audits=await db.prepare('SELECT COUNT(*) AS n FROM crm_access_audit WHERE target_id=?').bind(id).first('n');
  gate.release();
  assert.equal((await correction).status,409);
  const user=await db.prepare('SELECT email,role,status,email_verified_at FROM crm_users WHERE id=?').bind(id).first();
  assert.equal(user.email,address);assert.equal(user.role,'manager');assert.equal(user.status,'active');assert.ok(user.email_verified_at);
  assert.equal((await call('/api/auth/session',{cookie:active.cookie})).status,200);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM crm_access_audit WHERE target_id=?').bind(id).first('n'),audits);
});
test('free-only recipient guard blocks unverified mail without calling the provider',async()=>{
  const before=await db.prepare('SELECT COUNT(*) AS n FROM test_mail').first('n');
  const response=await call('/api/admin/users',{method:'POST',body:{email:'unverified@example.invalid',username:'unverified',role:'viewer'}});
  assert.equal(response.status,409);assert.match((await response.json()).error,/Cloudflare Free/);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM test_mail').first('n'),before);
  assert.equal(await db.prepare("SELECT status FROM crm_users WHERE username='unverified'").first(),null);
});
test('reset approval claims before mail, recovers failed delivery, and reconciles an accepted action',async()=>{
  const user=await seed('manager');
  const request=()=>call('/api/auth/reset-request',{method:'POST',cookie:null,body:{email:user.email}});
  await request();
  let pending=await db.prepare("SELECT id FROM crm_reset_requests WHERE user_id=? AND status='pending'").bind(user.id).first();
  const gate=armMailGate();
  const first=call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}});
  await gate.entered;
  const second=await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}});
  gate.release();
  const concurrent=[await first,second];
  assert.deepEqual(concurrent.map(response=>response.status).sort(),[200,409]);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?").bind(user.email).first('n'),1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM crm_account_actions WHERE reset_request_id=? AND state='ready'").bind(pending.id).first('n'),1);

  await request();pending=await db.prepare("SELECT id FROM crm_reset_requests WHERE user_id=? AND status='pending'").bind(user.id).first();
  const deliveredBefore=await db.prepare('SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?').bind(user.email).first('n');
  const staleGate=armMailGate();
  const staleSender=call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}});
  await staleGate.entered;
  await db.prepare('UPDATE crm_reset_requests SET claim_expires_at=0 WHERE id=?').bind(pending.id).run();
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}})).status,200);
  staleGate.release();
  assert.equal((await staleSender).status,409);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?').bind(user.email).first('n'),deliveredBefore+2);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM crm_account_actions WHERE reset_request_id=? AND state='ready'").bind(pending.id).first('n'),1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM crm_account_actions WHERE reset_request_id=? AND state='failed'").bind(pending.id).first('n'),1);
  const messages=(await db.prepare('SELECT payload FROM test_mail WHERE recipient=? ORDER BY sequence DESC LIMIT 2').bind(user.email).all()).results;
  const staleToken=tokenFromPayload(messages[0].payload),replacementToken=tokenFromPayload(messages[1].payload);
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token:staleToken,password}})).status,400);
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token:replacementToken,password}})).status,200);

  await request();pending=await db.prepare("SELECT id FROM crm_reset_requests WHERE user_id=? AND status='pending'").bind(user.id).first();
  await db.prepare('UPDATE test_mail_failure SET enabled=1').run();
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}})).status,503);
  const failed=await db.prepare('SELECT status,delivery_state,claim_token,claim_expires_at FROM crm_reset_requests WHERE id=?').bind(pending.id).first();
  assert.deepEqual(failed,{status:'pending',delivery_state:'failed',claim_token:null,claim_expires_at:null});
  await db.prepare('UPDATE test_mail_failure SET enabled=0').run();
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}})).status,200);
  const sent=await db.prepare("SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?").bind(user.email).first('n');
  await db.prepare("UPDATE crm_reset_requests SET status='pending',delivery_state='failed' WHERE id=?").bind(pending.id).run();
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}})).status,200);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?").bind(user.email).first('n'),sent);
  await db.batch([db.prepare("UPDATE crm_reset_requests SET status='pending',delivery_state='failed' WHERE id=?").bind(pending.id),db.prepare('UPDATE crm_account_actions SET expires_at=0 WHERE reset_request_id=?').bind(pending.id)]);
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{}})).status,200);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?").bind(user.email).first('n'),sent+1);
});
test('forgot-password response does not enumerate users and approval mails only registered address',async()=>{
  const user=await seed('manager');
  const request=email=>call('/api/auth/reset-request',{method:'POST',cookie:null,body:{email}});
  const known=await request(user.email),unknown=await request('not-registered@example.invalid');
  assert.equal(known.status,202);assert.equal(unknown.status,202);assert.deepEqual(await known.json(),await unknown.json());
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM test_mail WHERE recipient=?').bind(user.email).first('n'),0);
  const pending=await db.prepare("SELECT id FROM crm_reset_requests WHERE user_id=? AND status='pending'").bind(user.id).first();
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{},cookie:user.cookie})).status,403);
  assert.equal((await call(`/api/admin/users/reset-requests/${pending.id}/approve`,{method:'POST',body:{email:'attacker@example.invalid'}})).status,200);
  const token=await lastToken(user.email);
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token,password:newPassword}})).status,200);
  assert.equal((await call('/api/auth/session',{cookie:user.cookie})).status,401);
  assert.equal((await login(user.name)).status,401);assert.equal((await login(user.name,newPassword)).status,200);
});
test('owner email needs current password and confirmation; owner reset preserves identity',async()=>{
  assert.equal((await call('/api/admin/users/owner-email',{method:'POST',body:{email:'owner-mail@example.invalid',current_password:'wrong'}})).status,401);
  assert.equal((await call('/api/admin/users/owner-email',{method:'POST',body:{email:'owner-mail@example.invalid',current_password:password}})).status,200);
  assert.equal((await login('owner-mail@example.invalid')).status,401);
  const token=await lastToken('owner-mail@example.invalid');
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token}})).status,200);
  assert.equal((await login('owner-mail@example.invalid')).status,200);
  assert.equal((await call('/api/admin/users/owner/reset',{method:'POST',body:{}})).status,200);
  const reset=await lastToken('owner-mail@example.invalid');
  assert.equal((await call('/api/auth/complete',{method:'POST',cookie:null,body:{token:reset,password:newPassword}})).status,200);
  assert.equal((await call('/api/auth/session')).status,401);
  assert.equal((await login()).status,401);
  ownerCookie=(await login('owner',newPassword)).cookie;assert.ok(ownerCookie);
});
test('self-service password changes are isolated per user and CSRF remains blocked',async()=>{
  const manager=await seed('manager'),viewer=await seed('viewer');
  assert.equal((await call('/api/admin/account/password',{method:'POST',cookie:viewer.cookie,headers:{Origin:'https://attacker.test'},body:{current_password:password,new_password:newPassword}})).status,403);
  assert.equal((await call('/api/admin/account/password',{method:'POST',cookie:viewer.cookie,body:{current_password:password,new_password:newPassword}})).status,200);
  assert.equal((await call('/api/auth/session',{cookie:viewer.cookie})).status,401);
  assert.equal((await call('/api/auth/session',{cookie:manager.cookie})).status,200);
  assert.equal((await call('/api/auth/session')).status,200);
});
