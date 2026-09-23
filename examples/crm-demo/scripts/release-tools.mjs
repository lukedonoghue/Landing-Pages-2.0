/** Local release utilities and read-only Cloudflare identity inspection. */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, existsSync, lstatSync, fstatSync, openSync, closeSync, fsyncSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac, randomUUID, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SHA = /^[a-f0-9]{64}$/;
export const hash = value => createHash('sha256').update(value).digest('hex');
export function currentSourceFingerprint(root) {
  const here=path.dirname(fileURLToPath(import.meta.url));
  const checker=[path.join(here,'check_gates.py'),path.resolve(here,'../../../scripts/check_gates.py')].find(existsSync);
  if(!checker)throw new Error('The source evidence helper is missing. Restore the reviewed helpers before verification.');
  const code='import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);import check_gates;print(check_gates.source_snapshot(Path(sys.argv[2]))["source_fingerprint"])';
  const result=spawnSync(process.env.FUNNEL_PYTHON||'python3',['-c',code,path.dirname(checker),root],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(result.status!==0 || !SHA.test(result.stdout.trim()))throw new Error('The current project source cannot be checked. Preserve its evidence and restore the supported local tools.');
  return result.stdout.trim();
}
export function read(file) { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('A required local release/configuration JSON file is missing or invalid. Inspect it privately; no contents were echoed.'); } }
export function inside(root, value, privateAllowed = false) {
  const file = path.resolve(root, value), relative = path.relative(root, file);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Release files must stay inside the project.');
  let current = root;
  for (const part of relative.split(path.sep)) {
    if (['.git', 'node_modules', '.wrangler'].includes(part) || (!privateAllowed && (part === '.secrets' || part.startsWith('.env') || part.startsWith('.dev.vars')))) throw new Error('Release evidence cannot use credential/runtime paths.');
    current = path.join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('Release paths cannot use symlinks.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return file;
}
export function atomic(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const pending = file + '.' + randomUUID() + '.tmp'; let fd;
  try {
    fd = openSync(pending, 'wx', 0o600); writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(pending, file);
  } finally { if (fd !== undefined) closeSync(fd); if (existsSync(pending)) unlinkSync(pending); }
}
export function origin(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use a clean reviewed HTTPS origin.');
  return url.origin;
}
export function validateTarget(config) {
  const db = config.d1_databases;
  if (!/^[a-f0-9]{32}$/.test(config.account_id || '') || !/^[a-z][a-z0-9-]{2,48}$/.test(config.name || '') || config.name === 'branded-lead-funnel') throw new Error('Pin the intended Cloudflare account and unique Worker name before final review.');
  if (!Array.isArray(db) || db.length !== 1 || db[0].binding !== 'DB' || !UUID.test(db[0].database_id || '')) throw new Error('The reviewed Worker needs one real D1 binding named DB.');
  if (config.version_metadata?.binding !== 'CF_VERSION_METADATA') throw new Error('Add the supported version metadata binding before final QA and approval.');
  if (config.env || config.build?.command || config.assets?.directory !== 'public' || config.assets?.run_worker_first !== true) throw new Error('Use the reviewed flat Workers/static-assets profile for this beta release; environment overrides and custom build commands need a separate validated adapter.');
  const domains = (config.routes || []).map(route => {
    if (!route.custom_domain || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(route.pattern || '')) throw new Error('Use explicit custom domains for the supported publishing profile.');
    return origin('https://' + route.pattern.toLowerCase());
  });
  return { account_id: config.account_id, worker: config.name, database_id: db[0].database_id.toLowerCase(), domains, workers_dev: config.workers_dev !== false };
}
export function originsFromOutput(text, worker) {
  return [...new Set([...text.matchAll(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev\b/g)].map(match => origin(match[0])).filter(url => new URL(url).hostname.startsWith(worker + '.')))];
}
export function chooseOrigin(target, known = [], requested) {
  const allowed = [...new Set([...target.domains, ...known])];
  if (requested) { const selected = origin(requested); if (!allowed.includes(selected)) throw new Error('Verification URL is not a reviewed custom domain or a URL returned by this Worker upload. No credentials were sent.'); return selected; }
  if (target.domains.length === 1) return target.domains[0];
  if (!target.domains.length && known.length === 1) return known[0];
  if (allowed.length > 1) throw new Error('Choose one of the reviewed published origins with --url.');
  return null;
}
export function initialSecrets(values, auth) {
  if (!values || !/^[a-z0-9][a-z0-9._@+-]{2,79}$/.test(values.ADMIN_USERNAME || '') || !/^[a-f0-9]{64}$/.test(values.SESSION_SECRET || '')) throw new Error('Initial owner secrets are malformed; repair private setup before publishing.');
  const match = /^pbkdf2_sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(values.ADMIN_PASSWORD_HASH || '');
  if (!match || auth.username.trim().toLowerCase() !== values.ADMIN_USERNAME) throw new Error('Initial login identity does not match the private setup.');
  const actual = pbkdf2Sync(auth.password, Buffer.from(match[1], 'hex'), 100000, 32, 'sha256');
  if (!timingSafeEqual(actual, Buffer.from(match[2], 'hex'))) throw new Error('The current password does not match first-deployment setup. No remote changes were made.');
}
export function testSummary(text) {
  const result = {};
  for (const field of ['tests','pass','fail','cancelled','skipped']) {
    const match = text.match(new RegExp('^# '+field+' (\\d+)\\s*$', 'm'));
    if (!match) throw new Error('Application tests did not return a complete execution summary.');
    result[field] = Number(match[1]);
  }
  if (!result.tests || result.tests !== result.pass || result.fail || result.cancelled || result.skipped) throw new Error('All application/browser tests must execute and pass before publication; skipped tests cannot authorize release.');
  return result;
}
export function localRunner(root, lockFd) {
  return async (command, args, { cwd = root, env = {}, log, timeout = 180000 } = {}) => {
    let stdout = '', stderr = ''; let logFd;
    if (log) { mkdirSync(path.dirname(log), { recursive: true, mode: 0o700 }); logFd = openSync(log, 'a', 0o600); }
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', ...env }, detached: true, stdio: ['ignore','pipe','pipe', ...(Number.isInteger(lockFd) && lockFd>=3 ? [lockFd] : [])] });
      let timedOut=false, killTimer;
      const timer=setTimeout(()=>{
        timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch{}
        killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},2000);
      },timeout);
      const collect = (stream, part) => { const value=part.toString(); if (stream==='out') stdout+=value; else stderr+=value; if(logFd!==undefined)writeFileSync(logFd,part); };
      child.stdout.on('data', data => collect('out',data)); child.stderr.on('data', data => collect('err',data));
      child.on('error', () => { clearTimeout(timer);clearTimeout(killTimer); if(logFd!==undefined){closeSync(logFd);logFd=undefined;} reject(new Error('The required publishing tool could not start. Check the private diagnostic and installed runtime.')); });
      child.on('close', code => { clearTimeout(timer);clearTimeout(killTimer); if(logFd!==undefined){closeSync(logFd);logFd=undefined;} resolve({ code:timedOut?1:code, stdout, stderr }); });
    });
  };
}
export function checkLock(root) {
  const fd = Number(process.env.FUNNEL_PUBLISH_LOCK_FD);
  if (!Number.isInteger(fd) || fd < 3) throw new Error('Run the guarded publish command so its process lock is held.');
  const actual = fstatSync(fd), expected = lstatSync(inside(root,'.secrets/publish.lock',true));
  if (actual.dev !== expected.dev || actual.ino !== expected.ino) throw new Error('Publishing lock does not belong to this project.');
  return fd;
}
export function provider(root, packageRoot, target, run, log) {
  const executable = path.join(root,'node_modules/wrangler/bin/wrangler.js');
  const call = async args => {
    const result = await run(process.execPath,[executable,...args,'--config',path.join(packageRoot,'wrangler.jsonc')],
      { cwd:packageRoot,env:{CLOUDFLARE_ACCOUNT_ID:target.account_id},log });
    return result;
  };
  const json = async args => {
    const result = await call(args);
    if (result.code !== 0) {
      const error = new Error('Cloudflare inspection failed. Check the intended account, permissions and private diagnostic before retrying.');
      error.workerMissing = /\[code:\s*10007\]/.test(result.stderr + result.stdout);
      throw error;
    }
    try { return JSON.parse(result.stdout); } catch { throw new Error('Cloudflare returned an unexpected inspection response; no identity was inferred.'); }
  };
  return {
    call,
    async inspect() {
      let deployments;
      try { deployments = await json(['deployments','list','--name',target.worker,'--json']); }
      catch(error) { if(error.workerMissing)return null; throw error; }
      if (!Array.isArray(deployments)) throw new Error('Unexpected deployment listing.');
      if (!deployments.length) return null;
      deployments.sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
      const current=deployments[0];
      if (!Number.isFinite(Date.parse(current.created_on)) || current.versions?.length!==1 || current.versions[0].percentage!==100 || !UUID.test(current.versions[0].version_id)) throw new Error('The current Worker is not one fully active version. Reconcile its rollout before using this publishing profile.');
      const version=await json(['versions','view',current.versions[0].version_id,'--name',target.worker,'--json']);
      if(version.id!==current.versions[0].version_id || !Array.isArray(version.resources?.bindings))throw new Error('Cloudflare version identity is incomplete.');
      const bindings=version.resources.bindings;
      const binding=name=>bindings.filter(item=>item.name===name);
      const db=binding('DB'); const release=binding('FUNNEL_RELEASE_ID'); const source=binding('FUNNEL_SOURCE_FINGERPRINT');
      return {schema_version:1,evidence_source:'cloudflare-wrangler-deployments-and-version-api',account_id:target.account_id,worker:target.worker,
        deployment_id:current.id,version_id:version.id,active_versions:current.versions,database_id:db.length===1&&db[0].type==='d1'?db[0].id:null,
        release_id:release.length===1&&release[0].type==='plain_text'?release[0].text:null,
        source_fingerprint:source.length===1&&source[0].type==='plain_text'?source[0].text:null,
        script_etag:version.resources.script?.etag||null,observed_at:new Date().toISOString()};
    }
  };
}
export async function runtimeIdentity(url, expected, fetcher = fetch, secret = null) {
  const target=origin(url);
  const timestamp=String(Math.floor(Date.now()/1000));
  const headers=secret?{'X-CRM-Release-Time':timestamp,'X-CRM-Release-Proof':createHmac('sha256',secret).update(`release-probe:${target}:${timestamp}`).digest('hex')}:{};
  const response=await fetcher(target+'/api/health',{headers,redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)throw new Error('The published health endpoint is not ready. Resume verification after the destination is available.');
  const body=await response.json(), release=body.release;
  if(body.ok!==true || body.database!=='connected' || !release || release.version_id!==expected.version_id || release.release_id!==expected.release_id || release.source_fingerprint!==expected.source_fingerprint)throw new Error('The running Worker does not match the independently inspected release version.');
  return {version_id:release.version_id,release_id:release.release_id,source_fingerprint:release.source_fingerprint,observed_at:new Date().toISOString()};
}
export function expectedIdentity(observed,target,id,fingerprint,url) {
  if(!observed || observed.account_id!==target.account_id || observed.worker!==target.worker || observed.database_id!==target.database_id || observed.release_id!==id || observed.source_fingerprint!==fingerprint || !UUID.test(observed.version_id||'') || !UUID.test(id) || !SHA.test(fingerprint)) throw new Error('Cloudflare does not show the expected release and D1 binding. Do not upload again to resolve an uncertain outcome.');
  return {...observed,url:origin(url)};
}
export function sameReleaseIdentity(current, saved) {
  const keys = ['account_id','worker','database_id','version_id','release_id','source_fingerprint','url','script_etag'];
  if (!saved || keys.some(key => !current[key] || current[key] !== saved[key])) throw new Error('The active release differs from the version covered by retained verification. Preserve the historical evidence and reconcile the changed deployment before continuing.');
}
export async function verifyCredentials(url, auth, fetcher = fetch) {
  const base=origin(url);let cookie;
  try {
    const response=await fetcher(base+'/api/auth/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(auth)});
    if(!response.ok)throw new Error('Current administrator login failed before publication. Update the private credential reference; do not redeploy to reset a rotated password.');
    cookie=response.headers.get('set-cookie')?.split(';')[0];
    if(!cookie)throw new Error('Administrator login did not return a usable session.');
    const session=await fetcher(base+'/api/auth/session',{headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!session.ok || (await session.json()).authenticated!==true)throw new Error('Current administrator session could not be verified.');
  } finally {
    if(cookie)await fetcher(base+'/api/auth/logout',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(15000)}).catch(()=>{});
  }
}
