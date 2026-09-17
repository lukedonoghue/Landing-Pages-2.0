import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { unstable_splitSqlQuery } from 'wrangler';
import { reconcileErasureRecord } from './erasure-backup.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const value = (args, key) => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
function privateOutput(file){
  let ancestor=path.dirname(file),parts=[path.basename(file)];
  while(!existsSync(ancestor)){parts.unshift(path.basename(ancestor));ancestor=path.dirname(ancestor);}
  const actual=path.resolve(realpathSync(ancestor),...parts),relative=path.relative(realpathSync(root),actual);
  if(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)&&!relative.startsWith('.secrets'+path.sep))throw new Error('Store customer-data backups in .secrets/ or outside the project, never published assets or source control.');
}
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
  const booleans=new Set(['--local','--remote','--dry-run','--confirm-legacy-source']),values=new Set(['--out','--file','--erasure-records','--clean-output']),seen=new Set();
  for(let i=1;i<args.length;i++){
    const key=args[i];if(seen.has(key))throw new Error('Duplicate backup option.');seen.add(key);
    if(booleans.has(key)){if(args[i+1]&&!args[i+1].startsWith('--'))throw new Error(`${key} is a flag and takes no value.`);}
    else if(values.has(key)){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Supply a file after ${key}.`);i++;}
    else throw new Error('Unknown backup option.');
  }
  if(action==='export'&&['--file','--erasure-records','--clean-output','--confirm-legacy-source'].some(key=>seen.has(key)))throw new Error('Export accepts --out; erasure reconciliation belongs to verify.');
  if(action!=='export'&&seen.has('--out'))throw new Error('Use --file for verification or a recovery plan.');
  if(action==='restore-plan'&&['--local','--remote','--erasure-records','--clean-output','--confirm-legacy-source'].some(key=>seen.has(key)))throw new Error('A recovery plan accepts a private --file and makes no database changes.');
  if (action === 'export' && args.includes('--local') === args.includes('--remote')) throw new Error('Export requires exactly one of --local or --remote.');
  const input = value(args, action === 'export' ? '--out' : '--file');
  if (!input || input.startsWith('--')) throw new Error(action === 'export' ? 'Supply --out <private-backup.sql>.' : 'Supply --file <private-backup.sql>.');
  const file = path.resolve(root, input);
  if (action === 'export') privateOutput(file);
  if (!file.endsWith('.sql')) throw new Error('Use a .sql backup file.');
  const record=value(args,'--erasure-records'),output=value(args,'--clean-output');
  if((record||output)&&(action!=='verify'||!record||!output||record.startsWith('--')||output.startsWith('--')))throw new Error('Use verify with both --erasure-records <private.json> and --clean-output <new-private.sql>.');
  if(action==='verify'&&args.includes('--remote'))throw new Error('Verification uses an isolated local restore; --remote is not supported.');
  const recordFile=record?path.resolve(root,record):null,cleanFile=output?path.resolve(root,output):null;
  if(args.includes('--confirm-legacy-source')&&!recordFile)throw new Error('Legacy source confirmation only applies to a verified backup/erasure-record reconciliation.');
  if(cleanFile){privateOutput(cleanFile);if(!cleanFile.endsWith('.sql')||cleanFile===file)throw new Error('Choose a separate new .sql file for the cleaned backup.');}
  return { action, file, target: args.includes('--remote') ? '--remote' : '--local', dryRun: args.includes('--dry-run'),...(recordFile?{recordFile,cleanFile,confirmLegacySource:args.includes('--confirm-legacy-source')}:{}) };
}
export function runBackup(args, { run = spawnSync, log = console.log } = {}) {
  const plan = backupPlan(args);
  const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
  if (plan.action === 'restore-plan') {
    if (!existsSync(plan.file)) throw new Error('Backup file not found.');
    log(`Recovery plan for ${plan.file}:\n1. Obtain the latest complete erasure record from the current owner Data controls.\n2. Run backup verify with --erasure-records <private.json> --clean-output <new-private.sql>. This filters an isolated local restore, revokes its sessions, turns automatic retention off and pauses old delivery jobs. Check the record date and source client. A pre-feature backup without a source identity also requires --confirm-legacy-source after its provenance is verified.\n3. Create a NEW empty D1 recovery database in the intended Cloudflare account. Import the CLEANED SQL file using wrangler d1 execute RECOVERY_DATABASE --remote --file <cleaned-private.sql>.\n4. Apply any current application migrations missing from that cleaned backup.\n5. Rotate the owner password before access. Review retention and external delivery state before enabling either again.\n6. Bind a separate preview Worker, verify that suppressed enquiries remain absent, then check counts, login, lead detail and analytics.\n7. After the owner confirms the exact recovered database and cutover, update the production DB binding and deploy. Keep the original DB for rollback subject to its retention policy.\nThis command makes no database changes. Never import directly over the live client database. Without the current erasure record, an older backup is not cleared for restored use.`);
    return plan;
  }
  if (plan.dryRun) {
    log(plan.action === 'export' ? `Dry run: wrangler d1 export DB ${plan.target} --output ${plan.file}; file permissions 0600.` : `Dry run: import ${plan.file} into an isolated temporary LOCAL D1, verify required tables and counts${plan.recordFile?', apply the supplied complete erasure record and save a separate private cleaned SQL copy':''}, and destroy only that temporary copy. No live data is touched.`);
    return plan;
  }
  if (!existsSync(cli)) throw new Error('Run npm ci first.');
  const childEnv={...process.env,WRANGLER_SEND_METRICS:'false'};
  if(plan.action==='verify'||plan.target==='--local')for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL'])delete childEnv[name];
  const execute = args => {
    const result = run(process.execPath, [cli, ...args], { cwd: root, env:childEnv, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
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
  if(plan.cleanFile&&existsSync(plan.cleanFile))throw new Error('Cleaned backup output already exists. Choose a new filename.');
  const temp = mkdtempSync(path.join(os.tmpdir(), 'funnel-recovery-test-')); chmodSync(temp, 0o700);
  try {
    const config = path.join(temp, 'wrangler.json');
    writeFileSync(config, JSON.stringify({ name: 'isolated-recovery-check', compatibility_date: '2026-07-22', d1_databases: [{ binding: 'RESTORE_DB', database_name: 'isolated-recovery-check', database_id: '11111111-1111-1111-1111-111111111111' }] }), { mode: 0o600 });
    // The pinned exporter uses the configuration directory's .wrangler/state
    // and does not accept --persist-to. All commands share this private temp config.
    const common = ['--config', config, '--local'];
    execute(['d1', 'execute', 'RESTORE_DB', ...common, '--file', plan.file, '--yes']);
    const erasure=plan.recordFile?reconcileErasureRecord({recordFile:plan.recordFile,temporary:temp,template:root,common,execute,confirmLegacySource:plan.confirmLegacySource}):null;
    const output = execute(['d1', 'execute', 'RESTORE_DB', ...common, '--command', "SELECT (SELECT count(*) FROM leads) AS leads,(SELECT count(*) FROM visit_events) AS visit_events,(SELECT count(*) FROM admin_credentials) AS rotated_accounts,(SELECT count(*) FROM notes) AS notes,(SELECT count(*) FROM lead_notifications) AS notifications,(SELECT count(*) FROM sessions) AS sessions,(SELECT count(*) FROM webhooks WHERE enabled=1) AS enabled_connections,(SELECT count(*) FROM webhook_outbox WHERE status IN ('pending','sending')) AS queued_deliveries;", '--json']);
    const parsed = JSON.parse(output); const counts = parsed.flatMap(result => result.results || [])[0];
    if (!counts || !Number.isInteger(counts.leads)) throw new Error('Backup imported but required funnel tables could not be verified.');
    const integrity = JSON.parse(execute(['d1', 'execute', 'RESTORE_DB', ...common, '--command', 'PRAGMA foreign_key_check;', '--json']));
    if (integrity.some(result => (result.results || []).length)) throw new Error('Restored backup contains broken foreign-key relationships. Do not cut over.');
    if(erasure&&(counts.sessions||counts.enabled_connections||counts.queued_deliveries))throw new Error('The reconciled restore still has enabled access or deliveries. No cleaned output was created.');
    if(plan.cleanFile){
      const exported=path.join(temp,'cleaned.sql');execute(['d1','export','RESTORE_DB',...common,'--output',exported]);
      privateOutput(plan.cleanFile);mkdirSync(path.dirname(plan.cleanFile),{recursive:true,mode:0o700});
      writeFileSync(plan.cleanFile,normaliseD1Export(readFileSync(exported,'utf8')),{mode:0o600,flag:'wx'});
    }
    log(`Verified isolated local restore: ${JSON.stringify(counts)}.${erasure?' Erasure reconciliation: '+JSON.stringify(erasure)+'. Use the separately saved CLEANED SQL for recovery; the original backup is unchanged.':' This check alone does not apply the current erasure record.'} This proves SQL import and table integrity, not a live production cutover.`);
    return { ...plan, counts, ...(erasure?{erasure}:{}) };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runBackup(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
