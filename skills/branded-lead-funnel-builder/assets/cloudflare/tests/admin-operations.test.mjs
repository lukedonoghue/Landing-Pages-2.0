import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, cp, symlink, writeFile, stat, rm } from 'node:fs/promises';
import { pbkdf2Sync } from 'node:crypto';
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
  let calls = 0; const logs = []; const run = () => { calls++; throw new Error('must not run'); };
  runAccount(['rotate-password', '--remote', '--dry-run'], { run, log: x => logs.push(x) });
  runBackup(['export', '--remote', '--out', '.secrets/test.sql', '--dry-run'], { run, log: x => logs.push(x) });
  runBackup(['verify', '--file', '.secrets/test.sql', '--dry-run'], { run, log: x => logs.push(x) });
  assert.equal(calls, 0); assert.ok(logs.some(x => x.includes('LOCAL')));
  assert.throws(() => recoverySql('rotate-password', "malicious' SQL"), /Invalid/);
  assert.ok(recoverySql('rotate-password', encoded).includes('DELETE FROM sessions'));
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
    for (const script of ['backup.mjs', 'admin-account.mjs']) await cp(path.join(root, 'scripts', script), path.join(fixture, 'scripts', script));
    await cp(path.join(root, 'migrations'), path.join(fixture, 'migrations'), { recursive: true });
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    await writeFile(path.join(fixture, 'wrangler.jsonc'), JSON.stringify({ name: 'isolated-backup-test', compatibility_date: '2026-07-22', d1_databases: [{ binding: 'DB', database_name: 'isolated-backup-test', database_id: '22222222-2222-2222-2222-222222222222', migrations_dir: 'migrations' }] }));
    const invoke = args => execute(process.execPath, args, { cwd: fixture, maxBuffer: 4 * 1024 * 1024 });
    const cli = path.join(fixture, 'node_modules/wrangler/bin/wrangler.js');
    await invoke([cli, 'd1', 'migrations', 'apply', 'DB', '--local']);
    await writeFile(path.join(fixture, 'seed.sql'), "INSERT INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,name,form_name,form_data,attribution,landing_page) VALUES('restore-check','receipt','key','hash','2026-09-16','2026-09-16','2026-09-16','Synthetic','enquiry','{}','{}','/'); INSERT INTO notes(id,lead_id,body,created_at) VALUES('note','restore-check','Synthetic note','2026-09-16');");
    await invoke([cli, 'd1', 'execute', 'DB', '--local', '--file', 'seed.sql', '--yes']);
    const recovery = await invoke(['scripts/admin-account.mjs', 'rotate-password', '--local']);
    assert.ok(!recovery.stdout.includes('pbkdf2_sha256'));
    await invoke(['scripts/admin-account.mjs', 'revoke-sessions', '--local']);
    await invoke(['scripts/backup.mjs', 'export', '--local', '--out', '.secrets/backup.sql']);
    const verified = await invoke(['scripts/backup.mjs', 'verify', '--file', '.secrets/backup.sql']);
    assert.match(verified.stdout, /"leads":1/); assert.match(verified.stdout, /"notes":1/); assert.match(verified.stdout, /"notifications":1/); assert.match(verified.stdout, /"rotated_accounts":1/);
    for (const file of ['backup.sql', 'local-recovery-password.txt']) assert.equal((await stat(path.join(fixture, '.secrets', file))).mode & 0o777, 0o600);
    await assert.rejects(() => invoke(['scripts/backup.mjs', 'export', '--local', '--out', '.secrets/backup.sql']), /already exists/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
