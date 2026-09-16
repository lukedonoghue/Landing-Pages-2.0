import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { unstable_splitSqlQuery } from 'wrangler';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const value = (args, key) => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
export function normaliseD1Export(sql) {
  // D1 exports can interleave table creation/data even when a later table is
  // referenced by a foreign key. Create every table before importing any row.
  // Keep triggers after data, so restoring does not regenerate notifications.
  const statements = unstable_splitSqlQuery(sql);
  const pragmas = [], tables = [], rest = [];
  for (const statement of statements) {
    if (/^\s*PRAGMA\b/i.test(statement)) pragmas.push(statement);
    else if (/^\s*CREATE\s+TABLE\b/i.test(statement)) tables.push(statement);
    else rest.push(statement);
  }
  if (!tables.length) throw new Error('Backup has no table schema; export a complete database.');
  return [...pragmas, ...tables, ...rest].map(statement => statement.trim().replace(/;?$/, ';')).join('\n') + '\n';
}
export function backupPlan(args) {
  const action = args[0];
  if (!['export', 'verify', 'restore-plan'].includes(action)) throw new Error('Use export, verify, or restore-plan.');
  if (action === 'export' && args.includes('--local') === args.includes('--remote')) throw new Error('Export requires exactly one of --local or --remote.');
  const input = value(args, action === 'export' ? '--out' : '--file');
  if (!input || input.startsWith('--')) throw new Error(action === 'export' ? 'Supply --out <private-backup.sql>.' : 'Supply --file <private-backup.sql>.');
  const file = path.resolve(root, input);
  const relative = path.relative(root, file);
  if (action === 'export' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative) && !relative.startsWith('.secrets' + path.sep)) throw new Error('Store customer-data backups in .secrets/ or outside the project, never published assets or source control.');
  if (!file.endsWith('.sql')) throw new Error('Use a .sql backup file.');
  return { action, file, target: args.includes('--remote') ? '--remote' : '--local', dryRun: args.includes('--dry-run') };
}
export function runBackup(args, { run = spawnSync, log = console.log } = {}) {
  const plan = backupPlan(args);
  const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
  if (plan.action === 'restore-plan') {
    if (!existsSync(plan.file)) throw new Error('Backup file not found.');
    log(`Recovery plan for ${plan.file}:\n1. Run backup verify first (an isolated local restore).\n2. Create a NEW empty D1 recovery database in the intended Cloudflare account.\n3. Import using: wrangler d1 execute RECOVERY_DATABASE --remote --file <this private SQL file>\n4. Delete sessions from the recovery database and rotate the owner password there before access.\n5. Bind a separate preview Worker, check counts, login, lead detail and analytics.\n6. After the owner confirms the exact recovered database and cutover, update the production DB binding and deploy. Keep the original DB for rollback.\nThis command makes no database changes. Never import directly over the live client database.`);
    return plan;
  }
  if (plan.dryRun) {
    log(plan.action === 'export' ? `Dry run: wrangler d1 export DB ${plan.target} --output ${plan.file}; file permissions 0600.` : `Dry run: import ${plan.file} into an isolated temporary LOCAL D1, verify required tables and counts, and destroy only that temporary copy. No live data is touched.`);
    return plan;
  }
  if (!existsSync(cli)) throw new Error('Run npm ci first.');
  const execute = args => {
    const result = run(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) throw new Error('D1 backup command failed. Confirm the account, database and connection. No raw database output is printed.');
    return result.stdout;
  };
  if (plan.action === 'export') {
    if (existsSync(plan.file)) throw new Error('Backup output already exists. Choose a new filename.');
    mkdirSync(path.dirname(plan.file), { recursive: true, mode: 0o700 });
    writeFileSync(plan.file, '', { mode: 0o600, flag: 'wx' });
    try {
      execute(['d1', 'export', 'DB', plan.target, '--output', plan.file]);
      chmodSync(plan.file, 0o600);
      if (!statSync(plan.file).size) throw new Error('Backup export produced an empty file.');
      writeFileSync(plan.file, normaliseD1Export(readFileSync(plan.file, 'utf8')), { mode: 0o600 });
      log(`Saved private SQL backup: ${plan.file}. Next: node scripts/backup.mjs verify --file <backup>.`);
    } catch (error) { chmodSync(plan.file, 0o600); throw error; }
    return plan;
  }
  if (!existsSync(plan.file) || !statSync(plan.file).size) throw new Error('Nonempty backup file required.');
  const temp = mkdtempSync(path.join(os.tmpdir(), 'funnel-recovery-test-')); chmodSync(temp, 0o700);
  try {
    const config = path.join(temp, 'wrangler.json');
    writeFileSync(config, JSON.stringify({ name: 'isolated-recovery-check', compatibility_date: '2026-07-22', d1_databases: [{ binding: 'RESTORE_DB', database_name: 'isolated-recovery-check', database_id: '11111111-1111-1111-1111-111111111111' }] }), { mode: 0o600 });
    const common = ['--config', config, '--local', '--persist-to', path.join(temp, 'state')];
    execute(['d1', 'execute', 'RESTORE_DB', ...common, '--file', plan.file, '--yes']);
    const output = execute(['d1', 'execute', 'RESTORE_DB', ...common, '--command', 'SELECT (SELECT count(*) FROM leads) AS leads,(SELECT count(*) FROM visit_events) AS visit_events,(SELECT count(*) FROM admin_credentials) AS rotated_accounts,(SELECT count(*) FROM notes) AS notes,(SELECT count(*) FROM lead_notifications) AS notifications;', '--json']);
    const parsed = JSON.parse(output); const counts = parsed.flatMap(result => result.results || [])[0];
    if (!counts || !Number.isInteger(counts.leads)) throw new Error('Backup imported but required funnel tables could not be verified.');
    const integrity = JSON.parse(execute(['d1', 'execute', 'RESTORE_DB', ...common, '--command', 'PRAGMA foreign_key_check;', '--json']));
    if (integrity.some(result => (result.results || []).length)) throw new Error('Restored backup contains broken foreign-key relationships. Do not cut over.');
    log(`Verified isolated local restore: ${JSON.stringify(counts)}. This proves SQL import and table integrity, not a live production cutover.`);
    return { ...plan, counts };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runBackup(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
