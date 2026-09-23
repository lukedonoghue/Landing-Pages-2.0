/** Named-owner maintenance with pinned D1 targets and resumable, versioned changes. */
import { existsSync, readFileSync, writeFileSync, mkdirSync, lstatSync, chmodSync, rmSync, realpathSync } from 'node:fs';
import { randomBytes, randomUUID, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { atomic, read, inside, UUID, hash, checkLock } from './release-tools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USERNAME = /^[a-z0-9][a-z0-9._@+\-]{2,79}$/;
const HASH = /^pbkdf2_sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/;
const now = () => new Date().toISOString();
const username = value => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!USERNAME.test(normalized)) throw new Error('Supply a named owner with 3-80 letters, numbers or email characters.');
  return normalized;
};
function privatePath(root, value) {
  const file = path.resolve(root, value), relative = path.relative(root, file);
  if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) {
    if (!relative.startsWith('.secrets' + path.sep)) throw new Error('Keep credentials in .secrets/ or an explicitly selected private location outside the project.');
    return inside(root, relative, true);
  }
  return file;
}
export function accountPlan(args, root = ROOT) {
  const [action, ...rest] = args;
  if (!['rotate-password', 'change-username', 'revoke-sessions', 'resume'].includes(action)) throw new Error('Use rotate-password, change-username, revoke-sessions or resume with exactly one of --local or --remote.');
  const options = {}, flags = new Set(['local', 'remote', 'dry-run']);
  const values = new Set(['out', 'username', 'operation', 'credentials-file', 'password-file', 'python']);
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index].slice(2);
    if (!rest[index].startsWith('--') || key in options || (!flags.has(key) && !values.has(key))) throw new Error('Unsupported or repeated owner-recovery option.');
    if (flags.has(key)) options[key] = true;
    else { const value = rest[++index]; if (!value || value.startsWith('--')) throw new Error('A named recovery option is missing its value.'); options[key] = value; }
  }
  if (!!options.local === !!options.remote) throw new Error('Choose exactly one of --local or --remote.');
  if (action === 'change-username' && !options.username) throw new Error('Supply --username for the new owner identity.');
  if (action !== 'change-username' && options.username) throw new Error('--username belongs only to change-username; password recovery preserves the owner identity.');
  if (action === 'resume' && (!UUID.test(options.operation || '') || options.out)) throw new Error('Resume the retained --operation UUID without replacing its output.');
  if (action !== 'resume' && options.operation) throw new Error('Use resume to inspect an existing operation.');
  if(action==='rotate-password'&&options.remote&&!options['dry-run']){
    if(!options.out)throw new Error('Remote password rotation requires an external --out handoff.');
    const output=path.resolve(root,options.out); let ancestor=path.dirname(output);
    while(!existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw new Error('Invalid handoff parent.');ancestor=parent;}
    const resolved=path.resolve(realpathSync(ancestor),path.relative(ancestor,output));
    const rel=path.relative(realpathSync(root),resolved);
    if(existsSync(output)&&lstatSync(output).isSymbolicLink())throw new Error('A handoff cannot be a symbolic link.');
    if(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw new Error('Remote password handoff must be outside the project.');
  }
  if (action !== 'rotate-password' && options.out) throw new Error('--out is only for a newly generated recovery password.');
  if (options['credentials-file'] && options['password-file']) throw new Error('Choose one private current-credential file.');
  return { action, target: options.remote ? '--remote' : '--local', mode: options.remote ? 'production' : 'local', dryRun: !!options['dry-run'],
    ...(options.username ? { username: username(options.username) } : {}),
    ...(options.out ? { output: privatePath(root, options.out) } : {}), options };
}
function destination(root, mode) {
  const config = read(path.join(root, 'wrangler.jsonc')), db = config.d1_databases;
  if (config.env || !Array.isArray(db) || db.length !== 1 || db[0].binding !== 'DB' || !db[0].database_id || !config.name) throw new Error('Owner recovery needs the intended flat Worker configuration and one D1 binding named DB.');
  if (mode === 'production' && (!/^[a-f0-9]{32}$/.test(config.account_id || '') || !UUID.test(db[0].database_id))) throw new Error('Pin the intended Cloudflare account and real D1 database before remote owner recovery.');
  return { target: { mode, worker: config.name, account_id: config.account_id || null, database_id: db[0].database_id },
    config: { name: config.name, compatibility_date: config.compatibility_date || '2026-07-22', ...(config.account_id ? { account_id: config.account_id } : {}), d1_databases: [db[0]] } };
}
const refPath = mode => `.secrets/current-${mode === 'local' ? 'local-' : ''}admin-access.json`;
function localAccess(root, plan, target, retained = {}) {
  const optional = file => { try { return existsSync(file) ? read(file) : {}; } catch { return {}; } };
  const savedPath = inside(root, refPath(plan.mode), true);
  const saved = optional(savedPath);
  const setupPath = inside(root, `.secrets/${plan.mode}.json`, true);
  const setup = optional(setupPath);
  const sameTarget = !saved.target || JSON.stringify(saved.target) === JSON.stringify(target);
  const explicit = plan.options['credentials-file'] || plan.options['password-file'];
  const candidateFile = plan.options['credentials-file'] || (!explicit && (retained.credentials_file || (!retained.password_file && sameTarget && saved.credentials_file)));
  const file = typeof candidateFile === 'string' ? candidateFile : null;
  const candidatePassword = plan.options['password-file'] || (!file && (retained.password_file || (sameTarget && saved.password_file)));
  const passwordFile = typeof candidatePassword === 'string' ? candidatePassword : `.secrets/${plan.mode}-admin-password.txt`;
  let values = {}, password;
  // Losing an old handoff file must not disable Cloudflare-owner password recovery.
  // Missing candidate credentials result in an explicit handoff blocker for rename.
  try {
    if (file) values = optional(privatePath(root, file));
    else if (existsSync(privatePath(root, passwordFile))) password = readFileSync(privatePath(root, passwordFile), 'utf8').trim();
  } catch {}
  const owner = values.username || retained.username || (sameTarget && saved.username) || setup.ADMIN_USERNAME;
  return { username: owner, password: values.password || password, bootstrapHash: setup.ADMIN_PASSWORD_HASH,
    reference: {...(file ? {credentials_file:privatePath(root,file)} : {password_file:privatePath(root,passwordFile)}),...(owner?{username:owner}:{})} };
}
function matchesPassword(password, encoded) {
  const match = HASH.exec(encoded || '');
  if (typeof password !== 'string' || !password || !match) return false;
  return timingSafeEqual(pbkdf2Sync(password, Buffer.from(match[1], 'hex'), 100000, 32, 'sha256'), Buffer.from(match[2], 'hex'));
}
const sqlText = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
export function recoverySql(operation) {
  const { action, id, expected_version: version, password_hash: encoded, username: owner } = operation;
  if (!['rotate-password', 'change-username', 'revoke-sessions'].includes(action) || !UUID.test(id || '') || !Number.isSafeInteger(version) || version < 0 || (encoded !== '' && !HASH.test(encoded || '')) || (owner != null && username(owner) !== owner)) throw new Error('Invalid retained owner-recovery operation.');
  const updated = action === 'rotate-password' ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : sqlText(operation.previous_updated_at || '');
  return `INSERT INTO admin_credentials(id,password_hash,version,updated_at,username,recovery_id)
SELECT 1,${sqlText(encoded)},${version + 1},${updated},${sqlText(owner)},${sqlText(id)} WHERE COALESCE((SELECT version FROM admin_credentials WHERE id=1),0)=${version}
AND NOT EXISTS(SELECT 1 FROM crm_users WHERE username=${sqlText(owner)} OR email=${sqlText(owner)})
ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,version=excluded.version,updated_at=excluded.updated_at,username=excluded.username,recovery_id=excluded.recovery_id WHERE admin_credentials.version=${version};
DELETE FROM sessions WHERE user_id IS NULL AND credential_version<=${version};\n`;
}
export async function runAccount(args, { run = spawnSync, log = console.log, root = ROOT } = {}) {
  root = path.resolve(root);
  const plan = accountPlan(args, root);
  if (plan.dryRun) { log(`Dry run: ${plan.action} on ${plan.target}. Pin the database, retain a private operation, apply one version-checked change and reconcile its outcome. No credentials or remote state changed.`); return plan; }
  const selected = destination(root, plan.mode);
  const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
  if (!existsSync(cli)) throw new Error('Run npm ci first.');
  let state, base;
  if (plan.action === 'resume') {
    base = inside(root, '.secrets/account-recovery/' + plan.options.operation, true); state = read(path.join(base, 'state.json'));
    if (state.id !== plan.options.operation || state.schema_version !== 1 || JSON.stringify(state.target) !== JSON.stringify(selected.target)) throw new Error('This saved recovery belongs to another destination. Restore its intended configuration before continuing.');
  } else {
    const id = randomUUID(); base = inside(root, '.secrets/account-recovery/' + id, true); mkdirSync(base, {recursive:true,mode:0o700});
    state = { schema_version:1, id, action:plan.action, target:selected.target, requested_username:plan.username || null, requested_output:plan.output || null, created_at:now(), phase:'inspecting', attempts:0 };
    atomic(path.join(base, 'wrangler.jsonc'), selected.config);atomic(path.join(base,'state.json'),state);
  }
  if(state.phase==='complete'){const result={status:'complete',operation_id:state.id,action:state.action,mode:plan.mode,already_completed:true};log(JSON.stringify(result));return result;}
  const configFile = path.join(base, 'wrangler.jsonc');
  if (JSON.stringify(read(configFile)) !== JSON.stringify(selected.config)) throw new Error('The retained account-recovery destination changed.');
  const save = () => atomic(path.join(base, 'state.json'), state);
  const inheritedFd=Number(process.env.FUNNEL_PUBLISH_LOCK_FD);
  const stdio=['ignore','pipe','pipe',...(Number.isInteger(inheritedFd)&&inheritedFd>=3?[inheritedFd]:[])];
  const invoke = async extra => await run(process.execPath, [cli, 'd1', 'execute', 'DB', plan.target, '--config', configFile,
    ...(plan.mode === 'local' ? ['--persist-to', path.join(root, '.wrangler/state')] : []), ...extra],
    {cwd:root,stdio,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false',...(selected.target.account_id?{CLOUDFLARE_ACCOUNT_ID:selected.target.account_id}:{})}});
  const inspect = async () => {
    const result = await invoke(['--command', 'SELECT password_hash,version,updated_at,username,recovery_id FROM admin_credentials WHERE id=1', '--json']);
    try {
      if (result.status !== 0) throw new Error(); const entries = JSON.parse(result.stdout);
      if (!Array.isArray(entries) || entries.some(row => row.success === false)) throw new Error();
      const rows = entries.flatMap(row => row.results || []); if (rows.length > 1) throw new Error();
      const current = rows[0] || {password_hash:'',version:0,updated_at:null,username:null,recovery_id:null};
      if (!Number.isSafeInteger(current.version) || current.version < 0) throw new Error();
      return current;
    } catch { throw new Error('Owner state could not be inspected. Check the intended database, current migrations and account access. Raw provider output was not printed.'); }
  };
  try {
    let current = await inspect();
    const intentFile=path.join(base,'intent.json');
    const retained=existsSync(intentFile)?read(intentFile):null;
    if(retained && ((state.intent_sha256 && hash(readFileSync(intentFile))!==state.intent_sha256) || retained.id!==state.id || retained.action!==state.action || JSON.stringify(retained.target)!==JSON.stringify(state.target)))throw new Error('The retained private recovery intent changed.');
    const supplied = localAccess(root, plan, selected.target, retained?.access_reference || {});
    if(!existsSync(intentFile)) {
      if(state.phase!=='inspecting')throw new Error('The private recovery intent is missing. Preserve the operation and inspect its actual outcome.');
      const owner=state.action==='change-username'?state.requested_username:current.username;
      const intent={id:state.id,action:state.action,target:state.target,expected_version:current.version,previous_updated_at:current.updated_at,
        username:owner,password_hash:current.password_hash||'',owner_name:state.action==='revoke-sessions'?(owner||null):username(owner||supplied.username),access_reference:supplied.reference};
      if(state.action==='rotate-password') {
        const output=state.requested_output||path.join(base,'password.txt');
        if(existsSync(output))throw new Error('The recovery output already exists. Choose a new --out file; passwords are never overwritten.');
        const password=randomBytes(32).toString('base64url'),salt=randomBytes(16).toString('hex');
        intent.password_hash=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
        intent.generated_password=password;intent.password_file=path.relative(root,output).startsWith('..')?output:path.relative(root,output);
      }
      // One atomic private intent retains both the new secret and expected version
      // before writing an optional handoff copy or attempting the database change.
      atomic(intentFile,intent);
    }
    const intent=read(intentFile),intentHash=hash(readFileSync(intentFile));
    if((state.intent_sha256 && state.intent_sha256!==intentHash) || intent.id!==state.id || intent.action!==state.action || JSON.stringify(intent.target)!==JSON.stringify(state.target))throw new Error('The retained private recovery intent changed.');
    const {generated_password:secret,...publicIntent}=intent;
    Object.assign(state,publicIntent,{intent_sha256:intentHash});
    if(state.phase==='inspecting')state.phase='prepared';save();
    if(state.action==='rotate-password') {
      const output=privatePath(root,state.password_file);
      if(existsSync(output)) {
        if(lstatSync(output).isSymbolicLink() || readFileSync(output,'utf8').trim()!==secret)throw new Error('The retained password handoff file changed. Preserve it and the private recovery intent.');
        chmodSync(output,0o600);
      } else {mkdirSync(path.dirname(output),{recursive:true,mode:0o700});writeFileSync(output,secret+'\n',{mode:0o600,flag:'wx'});}
    }
    const sql=recoverySql(state),sqlFile=path.join(base,'operation.sql');
    if(existsSync(sqlFile)) {if(readFileSync(sqlFile,'utf8')!==sql)throw new Error('The retained recovery operation changed. Preserve it for inspection.');}
    else writeFileSync(sqlFile,sql,{mode:0o600,flag:'wx'});
    const matches = row => row.version === state.expected_version + 1 && row.recovery_id === state.id && row.username === state.username && row.password_hash === state.password_hash;
    if (!matches(current)) {
      if (current.version !== state.expected_version) throw new Error('The owner account changed after this operation was prepared. No recovery change or private access reference was overwritten.');
      if (state.attempts >= 3) throw new Error('The bounded account-recovery retry limit is exhausted. Preserve this operation and inspect the database before another change.');
      state.phase='applying';state.attempts++;save();
      let result;try{result=await invoke(['--file',path.join(base,'operation.sql'),'--yes']);}catch{result={status:null};}
      state.command_exit=result.status;state.phase='reconciling';save();
      current=await inspect();
      if (!matches(current)) throw new Error('Recovery did not confirm the intended owner state. Resume this exact saved operation; do not generate another password or reset its version.');
    }
    state.phase='confirmed';state.confirmed_at=now();save();
    let reference;
    if (state.action !== 'revoke-sessions') {
      const secret = state.action === 'rotate-password' ? readFileSync(privatePath(root,state.password_file),'utf8').trim() : supplied.password;
      const owner = username(current.username || state.owner_name);
      reference={username:owner,target:state.target,credential_version:current.version,operation_id:state.id};
      if (state.action==='rotate-password' && plan.mode==='production') {
        reference.password_file=state.password_file;
      } else if (matchesPassword(secret,current.password_hash || supplied.bootstrapHash)) {
        const file=path.join(base,'current-credentials.json');atomic(file,{username:owner,password:secret});reference.credentials_file=path.relative(root,file);
      } else reference.needs_password=true;
      atomic(inside(root,refPath(plan.mode),true),reference);
    }
    state.phase='complete';state.last_error=null;state.completed_at=now();save();
    if(state.action==='rotate-password'&&plan.mode==='production'){
      const sanitized={...read(intentFile)};delete sanitized.generated_password;atomic(intentFile,sanitized);state.intent_sha256=hash(readFileSync(intentFile));save();
      for(const file of [path.join(base,'current-credentials.json'),path.join(root,'.secrets/production-admin-password.txt'),path.join(root,'.secrets/current-credentials.json')])if(existsSync(file)&&!lstatSync(file).isSymbolicLink())rmSync(file);
    }
    const result={status:'complete',operation_id:state.id,action:state.action,mode:plan.mode,...(state.password_file?{password_file:state.password_file}:{}),current_access:reference?.needs_password?'needs-current-private-password':reference?'updated':'unchanged'};
    log(JSON.stringify(result));return result;
  } catch(error) {
    state.last_error={at:now(),message:error.message};state.failures=[...(state.failures||[]),state.last_error];save();
    const failure=new Error('Owner recovery did not complete. Its private diagnostic and original intent were retained.');failure.operationId=state.id;throw failure;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  try {
    const plan=accountPlan(args);
    let ownLock=false;
    if(!plan.dryRun){try{checkLock(ROOT);ownLock=true;}catch{}}
    // Verification can inherit another project's lock. Never treat that handle
    // as authority for this root; acquire this project's actual lock instead.
    if (!plan.dryRun && !ownLock) {
      const python=plan.options.python || process.env.FUNNEL_PYTHON || 'python3';
      if(!existsSync(path.join(ROOT,'scripts/release_state.py')))throw new Error('Update the generated project helpers before owner maintenance; the project process lock is required.');
      const result=spawnSync(python,[path.join(ROOT,'scripts/release_state.py'),'run',ROOT,'--',process.execPath,fileURLToPath(import.meta.url),...args],{cwd:ROOT,stdio:'inherit'});
      process.exitCode=result.status??1;
    } else {
      await runAccount(args);
    }
  } catch(error) { console.error(error.operationId?`Owner maintenance did not complete. Resume the saved operation ${error.operationId} on the same --local or --remote target; inspect its private diagnostic first.`:'Owner maintenance did not complete. Check the supplied options, current helpers and intended account; credentials and provider output were not printed.');process.exitCode=1; }
}
