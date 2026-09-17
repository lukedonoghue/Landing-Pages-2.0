import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, cp, symlink, writeFile, stat, rm } from 'node:fs/promises';
import { pbkdf2Sync, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { csvCell } from '../src/admin-operations.js';
import { accountPlan, recoverySql, runAccount } from '../scripts/admin-account.mjs';
import { validateErasureRecord, reconcileErasureRecord } from '../scripts/erasure-backup.mjs';
import { backupPlan, runBackup, normaliseD1Export } from '../scripts/backup.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const username = 'owner@example.invalid'; const password = 'test-only-owner-password-very-long';
const nextPassword = 'different-test-only-owner-password';
const salt = '112233445566778899aabbccddeeff00';
const encoded = `pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')}`;
let mf, db, cookie; let sequence = 0;
async function call(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  return mf.dispatchFetch(`https://site.test${path}`, { method, headers: { 'CF-Connecting-IP': `198.51.100.${++sequence % 240 + 1}`, ...(auth && cookie ? { Cookie: cookie } : {}), ...(method === 'POST' ? { Origin: 'https://site.test', 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
}
async function signIn(secret = password, name = username) {
  const response = await call('/api/auth/login', { method: 'POST', auth: false, body: { username: name, password: secret } });
  if (response.status === 200) return response.headers.get('Set-Cookie').split(';')[0];
  return response.status;
}
before(async () => {
  const bundle = await build({ entryPoints: [`${root}src/worker.js`], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-22', d1Databases: { DB: 'owner-operations-tests' }, bindings: { ADMIN_USERNAME: username, ADMIN_PASSWORD_HASH: encoded, SESSION_SECRET: 'test-only-session-secret-more-than-32-characters' }, serviceBindings: { ASSETS: () => new Response('asset') } });
  db = await mf.getD1Database('DB');
  for (const file of (await readdir(`${root}migrations`)).filter(name => name.endsWith('.sql')).sort()) await db.batch(unstable_splitSqlQuery(await readFile(`${root}migrations/${file}`, 'utf8')).map(sql => db.prepare(sql)));
});
after(async () => { await mf?.dispose(); });

test('named owner authentication rejects password-only and other usernames', async () => {
  assert.equal(await signIn(password, 'someone-else'), 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', auth: false, body: { password } })).status, 401);
  assert.equal(await signIn('wrong', username), 401);
  cookie = await signIn(password, `  ${username.toUpperCase()}  `); assert.ok(cookie.startsWith('crm_session='));
  const response = await call('/api/admin/account'); assert.deepEqual(await response.json(), { username, password_changed_at: null });
});
test('account, notifications, CSV and password changes all require session and same-origin writes', async () => {
  for (const path of ['/api/admin/account', '/api/admin/notifications', '/api/admin/leads/export.csv']) assert.equal((await call(path, { auth: false })).status, 401);
  for (const path of ['/api/admin/account/password', '/api/admin/account/revoke-sessions', '/api/admin/notifications/acknowledge']) {
    assert.equal((await call(path, { method: 'POST', body: {}, headers: { Origin: 'https://attacker.test' } })).status, 403);
    assert.equal((await call(path, { method: 'POST', body: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  }
});
test('password rotation verifies current password, persists salted hash, revokes both sessions and old secret', async () => {
  const secondCookie = await signIn();
  assert.equal((await call('/api/admin/account/password', { method: 'POST', body: { current_password: 'wrong', new_password: nextPassword } })).status, 401);
  assert.equal((await call('/api/admin/account/password', { method: 'POST', body: { current_password: password, new_password: 'short' } })).status, 400);
  const change = await call('/api/admin/account/password', { method: 'POST', body: { current_password: password, new_password: nextPassword } }); assert.equal(change.status, 200); assert.ok(change.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal((await call('/api/admin/account')).status, 401);
  assert.equal((await call('/api/admin/account', { headers: { Cookie: secondCookie } })).status, 401);
  assert.equal(await signIn(password), 401);
  cookie = await signIn(nextPassword); assert.ok(cookie.startsWith('crm_session='));
  const { hmac } = await import('../src/security.js');
  const oldHash = await hmac('test-only-session-secret-more-than-32-characters', `session:${secondCookie.split('=')[1]}`);
  await db.prepare('INSERT INTO sessions(token_hash,created_at,expires_at,credential_version,username) VALUES(?,?,?,?,?)').bind(oldHash,0,Math.floor(Date.now()/1000)+3600,0,username).run();
  assert.equal((await call('/api/admin/account', { headers: { Cookie: secondCookie } })).status, 401, 'An old session remains invalid even if an old record reappears');
  const stored = await db.prepare('SELECT * FROM admin_credentials').first(); assert.equal(stored.version, 1); assert.match(stored.password_hash, /^pbkdf2_sha256\$/); assert.ok(!JSON.stringify(stored).includes(nextPassword));
});
test('all-device signout advances credential version and new login still works', async () => {
  const response = await call('/api/admin/account/revoke-sessions', { method: 'POST', body: {} }); assert.equal(response.status, 200);
  assert.equal((await call('/api/auth/session')).status, 401); assert.equal((await db.prepare('SELECT version FROM admin_credentials').first()).version, 2);
  cookie = await signIn(nextPassword); assert.ok(cookie.startsWith('crm_session='));
});
const ids = [];
async function seedLead(source, name, deleted = false) {
  const id = crypto.randomUUID(); ids.push(id);
  await db.prepare('INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,name,email,status,form_name,form_data,attribution,landing_page,traffic_source,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,crypto.randomUUID(),crypto.randomUUID(),'test','2026-09-16T12:00:00.000Z','2026-09-16T12:00:00.000Z','2026-09-16',name,'synthetic@example.invalid','new','enquiry','{}','{}','/',source,deleted ? '2026-09-16T13:00:00.000Z' : null).run(); return id;
}
test('notification watermark leaves concurrent new leads unread and excludes removed contacts', async () => {
  await seedLead('google', 'One'); const first = await (await call('/api/admin/notifications')).json(); assert.equal(first.unread_count, 1);
  await seedLead('facebook', 'Two');
  const ack = await call('/api/admin/notifications/acknowledge', { method: 'POST', body: { through: first.through } }); assert.equal(ack.status, 200); assert.equal((await ack.json()).unread_count, 1);
  await seedLead('google', 'Removed', true); assert.equal((await (await call('/api/admin/notifications')).json()).unread_count, 1);
  assert.equal((await call('/api/admin/notifications/acknowledge', { method: 'POST', body: { through: 999999 } })).status, 400);
  assert.equal((await call('/api/admin/notifications/acknowledge', { method: 'POST', body: { through: 0 } })).status, 200);
  assert.equal((await (await call('/api/admin/notifications')).json()).unread_count, 1);
});
test('CSV exports all matching pages, excludes deleted contacts and prevents spreadsheet formulas', async () => {
  const formulaId = await seedLead('google', '=SUM(1,1)');
  const response = await call('/api/admin/leads/export.csv?source=google&status=new&page=999'); assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Export-Count'), '2'); assert.equal(response.headers.get('X-Export-Truncated'), 'false');
  const csv = await response.text(); assert.ok(csv.includes(formulaId)); assert.ok(csv.includes("'=SUM(1,1)")); assert.ok(!csv.includes('Removed')); assert.ok(!csv.includes('Two'));
  assert.equal((await call('/api/admin/leads/export.csv?source=untrusted')).status, 400);
  assert.equal((await call('/api/admin/leads/export.csv?q=One')).headers.get('X-Export-Count'), '1');
  for (const value of ['=CMD()', '+1', '-2', '@SUM()', ' \t=CMD()', '\tanything']) assert.ok(csvCell(value).startsWith('"\''), value);
  assert.equal(csvCell('say "hello"'), '"say ""hello"""');
});
test('missing or invalid named-owner configuration fails closed before credentials can be loaded', async () => {
  // Configuration behavior is also directly checked without depending on env injection.
  const { adminUsername } = await import('../src/security.js');
  assert.throws(() => adminUsername({}), error => error.status === 503);
  assert.throws(() => adminUsername({ ADMIN_USERNAME: 'a' }), error => error.status === 503);
  const { adminCredentials } = await import('../src/security.js');
  await assert.rejects(() => adminCredentials({ ADMIN_PASSWORD_HASH: encoded, DB: { prepare() { throw new Error('database must not be read'); } } }), error => error.status === 503);
});
test('recovery and backup tools require explicit destination, protect credentials and support dry-run', () => {
  assert.throws(() => accountPlan(['rotate-password']), /exactly one/);
  assert.throws(() => backupPlan(['export', '--out', '.secrets/test.sql']), /exactly one/);
  assert.throws(() => backupPlan(['export', '--local']), /Supply/);
  assert.throws(()=>backupPlan(['verify','--file','old.sql','--erasure-records','record.json','--clean-output','.secrets/clean.sql','--confirm-legacy-source','false']),/takes no value/);
  let calls = 0; const logs = []; const run = () => { calls++; throw new Error('must not run'); };
  runAccount(['rotate-password', '--remote', '--dry-run'], { run, log: x => logs.push(x) });
  runBackup(['export', '--remote', '--out', '.secrets/test.sql', '--dry-run'], { run, log: x => logs.push(x) });
  runBackup(['verify', '--file', '.secrets/test.sql', '--dry-run'], { run, log: x => logs.push(x) });
  assert.equal(calls, 0); assert.ok(logs.some(x => x.includes('LOCAL')));
  assert.throws(() => recoverySql({action:'rotate-password',password_hash:"malicious' SQL"}), /Invalid/);
  assert.ok(recoverySql({action:'rotate-password',password_hash:encoded,username:null,expected_version:0,id:crypto.randomUUID()}).includes('DELETE FROM sessions'));
});

test('CLI revocation prevents stale in-flight login for initial and rotated owners', async () => {
  const isolated = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("isolated");}}', compatibilityDate: '2026-07-22', d1Databases: { DB: 'revocation-race' } });
  try {
    const raceDb = await isolated.getD1Database('DB');
    for (const file of (await readdir(`${root}migrations`)).filter(name => name.endsWith('.sql')).sort()) await raceDb.batch(unstable_splitSqlQuery(await readFile(`${root}migrations/${file}`, 'utf8')).map(sql => raceDb.prepare(sql)));
    const bundle = await build({ entryPoints: [`${root}src/worker.js`], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
    const worker = (await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))).default;
    for (const rotated of [false, true]) {
      await raceDb.batch(['DELETE FROM sessions', 'DELETE FROM admin_credentials', 'DELETE FROM rate_limits'].map(sql => raceDb.prepare(sql)));
      if (rotated) await raceDb.prepare('INSERT INTO admin_credentials(id,password_hash,version,updated_at) VALUES(1,?,5,?)').bind(encoded, '2026-09-16T00:00:00Z').run();
      let captured; const capture = new Promise(resolve => { captured = resolve; });
      let release; const pause = new Promise(resolve => { release = resolve; });
      let intercept = true;
      const env = { ADMIN_USERNAME: username, ADMIN_PASSWORD_HASH: encoded, SESSION_SECRET: 'test-only-revocation-race-session-secret', DB: {
        batch: statements => raceDb.batch(statements),
        prepare(sql) {
          const statement = raceDb.prepare(sql);
          if (intercept && sql.startsWith('SELECT password_hash,version,updated_at')) return {
            async first() { const old = await statement.first(); intercept = false; captured(); await pause; return old; }
          };
          return statement;
        }
      } };
      const request = () => new Request('https://site.test/api/auth/login', { method: 'POST', headers: { Origin: 'https://site.test', 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.100' }, body: JSON.stringify({ username, password }) });
      const pending = worker.fetch(request(), env, { waitUntil() {} });
      await capture;
      await raceDb.batch(unstable_splitSqlQuery(recoverySql({action:'revoke-sessions',password_hash:rotated?encoded:'',username:null,expected_version:rotated?5:0,id:crypto.randomUUID()})).map(sql => raceDb.prepare(sql)));
      release();
      assert.equal((await pending).status, 401, 'A login using the pre-revocation version must fail');
      assert.equal((await raceDb.prepare('SELECT COUNT(*) AS count FROM sessions').first()).count, 0);
      assert.equal((await worker.fetch(request(), env, { waitUntil() {} })).status, 200, 'The password remains valid for a new login');
      const row = await raceDb.prepare('SELECT password_hash,version FROM admin_credentials WHERE id=1').first();
      assert.equal(row.version, rotated ? 6 : 1);
      if (rotated) assert.equal(row.password_hash, encoded, 'Revocation must not replace a rotated password');
    }
  } finally { await isolated.dispose(); }
});

test('portable D1 export creates referenced tables before inserting data and keeps triggers after data', () => {
  const sql = 'PRAGMA defer_foreign_keys=TRUE; CREATE TABLE child(id INTEGER,parent INTEGER REFERENCES parent(id)); INSERT INTO child VALUES(1,1); CREATE TABLE parent(id INTEGER PRIMARY KEY); INSERT INTO parent VALUES(1); CREATE TRIGGER observe AFTER INSERT ON parent BEGIN SELECT 1; END;';
  const output = normaliseD1Export(sql);
  assert.ok(output.indexOf('CREATE TABLE parent') < output.indexOf('INSERT INTO child'));
  assert.ok(output.indexOf('CREATE TRIGGER') > output.indexOf('INSERT INTO parent'));
  assert.throws(() => normaliseD1Export('INSERT INTO missing VALUES(1);'), /no table schema/);
});

test('real local D1 backup round-trip restores seeded records and recovery commands keep private permissions', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'funnel-backup-test-'));
  const execute = promisify(execFile);
  try {
    await mkdir(path.join(fixture, 'scripts'));
    for (const script of ['backup.mjs', 'erasure-backup.mjs', 'admin-account.mjs', 'release-tools.mjs']) await cp(path.join(root, 'scripts', script), path.join(fixture, 'scripts', script));
    await cp(path.join(root, 'migrations'), path.join(fixture, 'migrations'), { recursive: true });
    for (const name of ['release_state','workflow','workflow_storage','workflow_progress','copy_library','image_workflow','copy_parity','check_gates']) {
      const candidates=[path.join(root,'scripts',name+'.py'),path.resolve(root,'../../scripts',name+'.py')];
      let source;for(const item of candidates){try{await stat(item);source=item;break;}catch{}}
      assert.ok(source);await cp(source,path.join(fixture,'scripts',name+'.py'));
    }
    await mkdir(path.join(fixture,'.secrets'),{recursive:true});
    await writeFile(path.join(fixture,'.secrets/local.json'),JSON.stringify({ADMIN_USERNAME:username,ADMIN_PASSWORD_HASH:encoded}),{mode:0o600});

    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    await writeFile(path.join(fixture, 'wrangler.jsonc'), JSON.stringify({ name: 'isolated-backup-test', compatibility_date: '2026-07-22', d1_databases: [{ binding: 'DB', database_name: 'isolated-backup-test', database_id: '22222222-2222-2222-2222-222222222222', migrations_dir: 'migrations' }] }));
    // A publishing preflight may pass its own lock environment into tests. The
    // isolated client's account CLI must acquire its own lock, not use that FD.
    const invoke = args => execute(process.execPath, args, { cwd: fixture, env:{...process.env,FUNNEL_PUBLISH_LOCK_FD:'3'}, maxBuffer: 4 * 1024 * 1024 });
    const cli = path.join(fixture, 'node_modules/wrangler/bin/wrangler.js');
    // Restore a backup from before data-lifecycle support, then migrate only the private verification copy.
    await rm(path.join(fixture,'migrations/0005_data_lifecycle.sql'));
    await invoke([cli, 'd1', 'migrations', 'apply', 'DB', '--local']);
    await cp(path.join(root,'migrations/0005_data_lifecycle.sql'),path.join(fixture,'migrations/0005_data_lifecycle.sql'));
    await writeFile(path.join(fixture, 'seed.sql'), "INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,name,form_name,form_data,attribution,landing_page) VALUES('restore-check','receipt','key','hash','2026-09-16','2026-09-16','2026-09-16','Synthetic','enquiry','{}','{}','/'); INSERT INTO notes(id,lead_id,body,created_at) VALUES('note','restore-check','Synthetic note','2026-09-16');");
    await invoke([cli, 'd1', 'execute', 'DB', '--local', '--file', 'seed.sql', '--yes']);
    const recovery = await invoke(['scripts/admin-account.mjs', 'rotate-password', '--local', '--out', '.secrets/local-recovery-password.txt']);
    assert.ok(!recovery.stdout.includes('pbkdf2_sha256'));
    await invoke(['scripts/admin-account.mjs', 'revoke-sessions', '--local']);
    await invoke(['scripts/backup.mjs', 'export', '--local', '--out', '.secrets/backup.sql']);
    const verified = await invoke(['scripts/backup.mjs', 'verify', '--file', '.secrets/backup.sql']);
    assert.match(verified.stdout, /"leads":1/); assert.match(verified.stdout, /"notes":1/); assert.match(verified.stdout, /"notifications":1/); assert.match(verified.stdout, /"rotated_accounts":1/);
    for (const file of ['backup.sql', 'local-recovery-password.txt']) assert.equal((await stat(path.join(fixture, '.secrets', file))).mode & 0o777, 0o600);
    await assert.rejects(() => invoke(['scripts/backup.mjs', 'export', '--local', '--out', '.secrets/backup.sql']), /already exists/);
    const hookId=crypto.randomUUID(),leadId=crypto.randomUUID(),requestKey=crypto.randomUUID(),marker='private-synthetic-erasure-marker',stamp=new Date().toISOString();
    const hash=createHash('sha256').update('erased-submission:'+requestKey).digest('hex');
    await writeFile(path.join(fixture,'erase-seed.sql'),`INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,name,email,form_name,form_data,attribution,landing_page) VALUES('${leadId}','${crypto.randomUUID()}','${requestKey}','hash','${stamp}','${stamp}','${stamp.slice(0,10)}','${marker}','${marker}@example.invalid','enquiry','{"name":"${marker}"}','{"gclid":"${marker}"}','/'); INSERT INTO notes(id,lead_id,body,created_at) VALUES('${crypto.randomUUID()}','${leadId}','${marker}','${stamp}'); INSERT INTO activity(id,lead_id,event_type,description,created_at) VALUES('${crypto.randomUUID()}','${leadId}','created','${marker}','${stamp}'); INSERT INTO sessions(token_hash,created_at,expires_at) VALUES('synthetic-old-session',1,9999999999); INSERT INTO webhooks(id,name,url,enabled,created_at) VALUES('${hookId}','Synthetic recovery hook','https://hooks.example.com/receive',1,'${stamp}'); INSERT INTO webhook_outbox(id,webhook_id,lead_id,next_attempt_at,created_at) VALUES('${crypto.randomUUID()}','${hookId}','restore-check',0,'${stamp}'),('${crypto.randomUUID()}','${hookId}','${leadId}',0,'${stamp}');`);
    await invoke([cli,'d1','execute','DB','--local','--file','erase-seed.sql','--yes']);
    await invoke(['scripts/backup.mjs','export','--local','--out','.secrets/pre-erasure.sql']);
    const original=await readFile(path.join(fixture,'.secrets/pre-erasure.sql'),'utf8');
    const record={schema_version:1,complete:true,entry_count:1,dataset_id:'b'.repeat(32),generated_at:stamp,site_name:'Synthetic backup fixture',entries:[{lead_id:leadId,key_hash:hash,erased_at:stamp}]};
    await writeFile(path.join(fixture,'.secrets/erasure-record.json'),JSON.stringify(record),{mode:0o600});
    const reconciled=await invoke(['scripts/backup.mjs','verify','--file','.secrets/pre-erasure.sql','--erasure-records','.secrets/erasure-record.json','--clean-output','.secrets/cleaned.sql','--confirm-legacy-source']);
    assert.match(reconciled.stdout,/"erased_enquiries":1/);assert.match(reconciled.stdout,/"enabled_connections":0/);assert.match(reconciled.stdout,/"queued_deliveries":0/);assert.match(reconciled.stdout,/"leads":1/);assert.match(reconciled.stdout,/"notes":1/);assert.ok(!reconciled.stdout.includes(marker));
    const wrong={...record,entries:[{...record.entries[0],key_hash:'a'.repeat(64)}]};await writeFile(path.join(fixture,'.secrets/wrong-record.json'),JSON.stringify(wrong),{mode:0o600});
    await assert.rejects(()=>invoke(['scripts/backup.mjs','verify','--file','.secrets/pre-erasure.sql','--erasure-records','.secrets/wrong-record.json','--clean-output','.secrets/wrong-cleaned.sql','--confirm-legacy-source']),/does not match/);
    await assert.rejects(()=>stat(path.join(fixture,'.secrets/wrong-cleaned.sql')));
    const reverse={...record,entries:[{...record.entries[0],lead_id:crypto.randomUUID()}]};await writeFile(path.join(fixture,'.secrets/reverse-record.json'),JSON.stringify(reverse),{mode:0o600});
    await assert.rejects(()=>invoke(['scripts/backup.mjs','verify','--file','.secrets/pre-erasure.sql','--erasure-records','.secrets/reverse-record.json','--clean-output','.secrets/reverse-cleaned.sql','--confirm-legacy-source']),/suppressed submission key/);
    await assert.rejects(()=>stat(path.join(fixture,'.secrets/reverse-cleaned.sql')));
    const cleaned=await readFile(path.join(fixture,'.secrets/cleaned.sql'),'utf8');assert.ok(!cleaned.includes(marker));assert.ok(!cleaned.includes('synthetic-old-session'));assert.ok(cleaned.includes(hash));assert.equal((await stat(path.join(fixture,'.secrets/cleaned.sql'))).mode&0o777,0o600);
    assert.equal(await readFile(path.join(fixture,'.secrets/pre-erasure.sql'),'utf8'),original);
    const live=await invoke([cli,'d1','execute','DB','--local','--command','SELECT count(*) AS retained FROM leads','--json']);assert.equal(JSON.parse(live.stdout)[0].results[0].retained,2,'Original local database is unchanged');
    await assert.rejects(()=>invoke(['scripts/backup.mjs','verify','--file','.secrets/pre-erasure.sql','--erasure-records','.secrets/erasure-record.json','--clean-output','.secrets/unconfirmed.sql']),/confirm-legacy-source/);
    const foreign={...record,entry_count:0,dataset_id:'c'.repeat(32),entries:[]};await writeFile(path.join(fixture,'.secrets/foreign-record.json'),JSON.stringify(foreign),{mode:0o600});
    await assert.rejects(()=>invoke(['scripts/backup.mjs','verify','--file','.secrets/cleaned.sql','--erasure-records','.secrets/foreign-record.json','--clean-output','.secrets/foreign-cleaned.sql']),/different source database/);
    const repeated=await invoke(['scripts/backup.mjs','verify','--file','.secrets/cleaned.sql','--erasure-records','.secrets/erasure-record.json','--clean-output','.secrets/cleaned-again.sql']);assert.match(repeated.stdout,/"erased_enquiries":0/);
    await mkdir(path.join(fixture,'public'));await symlink(path.join(fixture,'public'),path.join(fixture,'.secrets/public-alias'),'junction');
    await assert.rejects(()=>invoke(['scripts/backup.mjs','export','--local','--out','.secrets/public-alias/leak.sql']),/never published/);

  } finally { await rm(fixture, { recursive: true, force: true }); }
});


test('backup reconciliation rejects partial or unsafe suppression records and redacts invalid JSON',async()=>{
  const entry={lead_id:crypto.randomUUID(),key_hash:'a'.repeat(64),erased_at:new Date().toISOString()};const record={schema_version:1,complete:true,entry_count:1,dataset_id:'a'.repeat(32),generated_at:new Date().toISOString(),entries:[entry]};
  assert.equal(validateErasureRecord(record).entries.length,1);assert.throws(()=>validateErasureRecord({...record,entries:[]}),/incomplete/);assert.throws(()=>validateErasureRecord({...record,complete:false}),/complete/);assert.throws(()=>validateErasureRecord({...record,entry_count:2,entries:[entry,entry]}),/Duplicate/);assert.throws(()=>validateErasureRecord({...record,entries:[{...entry,lead_id:"injected'); DELETE FROM leads;"}]}),/Invalid/);
  const temporary=await mkdtemp(path.join(os.tmpdir(),'bad-erasure-record-'));
  try{const recordFile=path.join(temporary,'bad.json');await writeFile(recordFile,'{"private":"synthetic-contact-secret" INVALID');assert.throws(()=>reconcileErasureRecord({recordFile,temporary,template:root,common:['--local'],execute(){throw Error('Must not execute');}}),error=>error.message.includes('not readable JSON')&&!error.message.includes('synthetic-contact-secret'));}
  finally{await rm(temporary,{recursive:true,force:true});}
});
