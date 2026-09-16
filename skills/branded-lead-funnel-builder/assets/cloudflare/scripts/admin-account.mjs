import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const value = (args, key) => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
export function accountPlan(args) {
  const action = args[0];
  if (!['rotate-password', 'revoke-sessions'].includes(action)) throw new Error('Use rotate-password or revoke-sessions, with exactly one of --local or --remote.');
  if (args.includes('--local') === args.includes('--remote')) throw new Error('Choose exactly one of --local or --remote.');
  const output = path.resolve(root, value(args, '--out') || `.secrets/${args.includes('--remote') ? 'production' : 'local'}-recovery-password.txt`);
  const relative = path.relative(root, output);
  if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative) && !relative.startsWith('.secrets' + path.sep)) throw new Error('Store recovery passwords in .secrets/ or outside the project.');
  return { action, target: args.includes('--remote') ? '--remote' : '--local', dryRun: args.includes('--dry-run'), output };
}
export function recoverySql(action, encoded) {
  if (action === 'rotate-password' && !/^pbkdf2_sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(encoded || '')) throw new Error('Invalid generated credential hash.');
  if (action === 'rotate-password') return `INSERT INTO admin_credentials(id,password_hash,version,updated_at) VALUES(1,'${encoded}',1,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,version=version+1,updated_at=excluded.updated_at;\nDELETE FROM sessions;\n`;
  // Revocation is a single SQL transaction in D1's import. Bump a stored version
  // if present; deleting sessions immediately signs out all existing devices.
  return 'UPDATE admin_credentials SET version=version+1 WHERE id=1;\nDELETE FROM sessions;\n';
}
export function runAccount(args, { run = spawnSync, log = console.log } = {}) {
  const plan = accountPlan(args);
  if (plan.dryRun) {
    log(`Dry run: wrangler d1 execute DB ${plan.target} --file <private recovery SQL>. ${plan.action === 'rotate-password' ? `Generate a new password into ${plan.output}; invalidate all sessions.` : 'Invalidate all current sessions.'}`);
    return plan;
  }
  if (!existsSync(path.join(root, 'node_modules/wrangler/bin/wrangler.js'))) throw new Error('Run npm ci first.');
  // The authenticated Cloudflare account owner is the recovery authority.
  const temp = mkdtempSync(path.join(os.tmpdir(), 'funnel-account-')); chmodSync(temp, 0o700);
  let password; let encoded;
  try {
    if (plan.action === 'rotate-password') {
      if (existsSync(plan.output)) throw new Error('The recovery output already exists. Choose a new --out file; passwords are never overwritten.');
      password = randomBytes(32).toString('base64url'); const salt = randomBytes(16).toString('hex');
      encoded = `pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')}`;
      mkdirSync(path.dirname(plan.output), { recursive: true, mode: 0o700 });
      writeFileSync(plan.output, password + '\n', { mode: 0o600, flag: 'wx' });
    }
    const sqlFile = path.join(temp, 'recovery.sql'); writeFileSync(sqlFile, recoverySql(plan.action, encoded), { mode: 0o600, flag: 'wx' });
    const result = run(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'DB', plan.target, '--file', sqlFile, '--yes'], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    // Never echo the SQL, hash, Wrangler output or password. Wrangler can include
    // SQL in errors; the private output remains available after an uncertain result.
    if (result.status !== 0) throw new Error(`Account recovery did not confirm success. Check Cloudflare connectivity/account access and retry carefully. ${password ? `The proposed password is retained in ${plan.output}; it may not be active.` : ''}`);
    log(plan.action === 'rotate-password' ? `Password changed and sessions revoked. Read ${plan.output} privately, then save it in your password manager. Username is unchanged. The D1 hash overrides the original deployment secret.` : 'All current sessions revoked.');
    return plan;
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runAccount(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
