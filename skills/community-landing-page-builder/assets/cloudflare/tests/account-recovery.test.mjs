/** Owner recovery protocol backed by actual local Worker/D1; no account calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { accountPlan, runAccount } from '../scripts/admin-account.mjs';
import { access } from '../scripts/publish-driver.mjs';
import { atomic, read, verifyCredentials } from '../scripts/release-tools.mjs';
const template=fileURLToPath(new URL('../',import.meta.url));
const owner='owner@example.invalid', password='synthetic-original-password', salt='1'.repeat(32);
const encoded=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;

async function fixture(t) {
  const root=mkdtempSync(path.join(os.tmpdir(),'owner-recovery-'));let ip=0,writes=0,drop=false,fail=false,blockReference=false;
  const handoffDir=mkdtempSync(path.join(os.tmpdir(),'owner-recovery-handoff-'));
  atomic(path.join(root,'wrangler.jsonc'),{name:'recovery-fixture',account_id:'a'.repeat(32),d1_databases:[{binding:'DB',database_name:'recovery-fixture',database_id:'12345678-1234-4234-8234-123456789abc'}]});
  for(const mode of ['production','local']) {
    atomic(path.join(root,'.secrets/'+mode+'.json'),{ADMIN_USERNAME:owner,ADMIN_PASSWORD_HASH:encoded});
    writeFileSync(path.join(root,'.secrets/'+mode+'-admin-password.txt'),password+'\n',{mode:0o600});
  }
  mkdirSync(path.join(root,'node_modules/wrangler/bin'),{recursive:true});writeFileSync(path.join(root,'node_modules/wrangler/bin/wrangler.js'),'// intercepted, never executed');
  const bundled=await build({entryPoints:[path.join(template,'src/worker.js')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  const settings={modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-22',d1Databases:{DB:'owner-recovery'},bindings:{ADMIN_USERNAME:owner,ADMIN_PASSWORD_HASH:encoded,SESSION_SECRET:'synthetic-private-session-key-with-at-least-32-characters'},serviceBindings:{ASSETS:()=>new Response('Synthetic public asset')},outboundService:()=>new Response('External calls disabled',{status:503})};
  const mf=new Miniflare(settings);let db=await mf.getD1Database('DB');
  for(const name of readdirSync(path.join(template,'migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(readFileSync(path.join(template,'migrations',name),'utf8')).map(sql=>db.prepare(sql)));
  t.after(async()=>{await mf.dispose();rmSync(root,{recursive:true,force:true});rmSync(handoffDir,{recursive:true,force:true});});
  const logs=[];
  const run=async(_command,args,options)=>{
    assert.equal(options.env.CLOUDFLARE_ACCOUNT_ID,'a'.repeat(32));
    assert.equal(read(args[args.indexOf('--config')+1]).d1_databases[0].database_id,read(path.join(root,'wrangler.jsonc')).d1_databases[0].database_id);
    if(args.includes('--command')) {
      const rows=await db.prepare(args[args.indexOf('--command')+1]).all();
      if(blockReference && writes){blockReference=false;mkdirSync(path.join(root,'.secrets/current-admin-access.json'));}
      return {status:0,stdout:JSON.stringify([{success:true,results:rows.results}])};
    }
    assert.ok(args.includes('--file'));writes++;
    if(fail){fail=false;return {status:1,stdout:'SYNTHETIC PRIVATE PROVIDER OUTPUT'};}
    const sql=readFileSync(args[args.indexOf('--file')+1],'utf8');await db.batch(unstable_splitSqlQuery(sql).map(s=>db.prepare(s)));
    if(drop){drop=false;return {status:1,stdout:'SYNTHETIC lost response'};}
    return {status:0,stdout:'[]'};
  };
  const request=async(url,options={})=>mf.dispatchFetch(url,{...options,headers:{...Object.fromEntries(new Headers(options.headers)),'CF-Connecting-IP':`198.51.100.${++ip%200+1}`}});
  const login=async(name=owner,secret=password)=>request('https://site.test/api/auth/login',{method:'POST',headers:{Origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({username:name,password:secret})});
  const account=args=>runAccount(args[0]==='rotate-password'&&args.includes('--remote')&&!args.includes('--out')
    ?[...args,'--out',path.join(handoffDir,`${crypto.randomUUID()}.txt`)]:args,{root,run,log:value=>logs.push(value)});
  return {root,account,logs,login,request,get db(){return db;},get writes(){return writes;},drop:()=>{drop=true;},fail:()=>{fail=true;},blockReference:()=>{blockReference=true;},restart:async()=>{await mf.setOptions({...settings,bindings:{...settings.bindings,ADMIN_USERNAME:'old-bootstrap@example.invalid'}});db=await mf.getD1Database('DB');}};
}
const state=(f,id)=>read(path.join(f.root,'.secrets/account-recovery',id,'state.json'));

test('password recovery confirms a lost response and updates the publisher current credential reference',async t=>{
  const f=await fixture(t);const old=(await f.login()).headers.get('set-cookie').split(';')[0];f.drop();
  const result=await f.account(['rotate-password','--remote']);assert.equal(result.current_access,'updated');assert.equal(f.writes,1);
  const current=access(f.root,{});assert.notEqual(current.auth.password,password);assert.equal((await f.login(owner,password)).status,401);
  assert.equal((await f.request('https://site.test/api/auth/session',{headers:{Cookie:old}})).status,401);
  await verifyCredentials('https://site.test',current.auth,f.request);
  await f.account(['resume','--remote','--operation',result.operation_id]);assert.equal(f.writes,1);
  const printed=f.logs.join('\n');assert.ok(!printed.includes(current.auth.password));assert.ok(!printed.includes('pbkdf2_sha256'));assert.ok(!printed.includes('PRIVATE PROVIDER'));
  assert.equal(statSync(path.resolve(f.root,result.password_file)).mode&0o777,0o600);
});
test('failed write resumes the identical private password intent without another credential version',async t=>{
  const f=await fixture(t);f.fail();let id;
  await assert.rejects(f.account(['rotate-password','--remote']),error=>{id=error.operationId;return !!id;});
  const before=state(f,id);const secret=readFileSync(path.resolve(f.root,before.password_file),'utf8');
  await f.account(['resume','--remote','--operation',id]);assert.equal(readFileSync(path.resolve(f.root,before.password_file),'utf8'),secret);
  assert.equal((await f.db.prepare('SELECT version FROM admin_credentials').first()).version,1);assert.equal(f.writes,2);
});
test('losing or corrupting an old credential handoff does not prevent password recovery',async t=>{
  const f=await fixture(t);
  await f.account(['change-username','--remote','--username','known-owner']);
  const reference=read(path.join(f.root,'.secrets/current-admin-access.json'));
  rmSync(path.join(f.root,reference.credentials_file));
  await f.account(['rotate-password','--remote']);await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
  const current=read(path.join(f.root,'.secrets/current-admin-access.json'));
  writeFileSync(path.resolve(f.root,current.password_file),'malformed private file');
  await f.account(['rotate-password','--remote']);await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
  atomic(path.join(f.root,'.secrets/current-admin-access.json'),{username:'known-owner',credentials_file:true});
  await f.account(['rotate-password','--remote']);await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
});
test('resumed rename retains its explicit current-credential reference',async t=>{
  const f=await fixture(t),changed='synthetic-current-ui-password';const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];
  assert.equal((await f.request('https://site.test/api/admin/account/password',{method:'POST',headers:{Origin:'https://site.test',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({current_password:password,new_password:changed})})).status,200);
  atomic(path.join(f.root,'.secrets/current-ui.json'),{username:owner,password:changed});f.fail();let id;
  await assert.rejects(f.account(['change-username','--remote','--username','renamed-owner','--credentials-file','.secrets/current-ui.json']),error=>{id=error.operationId;return !!id;});
  const result=await f.account(['resume','--remote','--operation',id]);assert.equal(result.current_access,'updated');
  assert.equal(access(f.root,{}).auth.password,changed);await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
});
test('interrupted local credential handoff resumes without repeating the remote change',async t=>{
  const f=await fixture(t);f.blockReference();let id;
  await assert.rejects(f.account(['rotate-password','--remote']),error=>{id=error.operationId;return !!id;});assert.equal(f.writes,1);
  rmSync(path.join(f.root,'.secrets/current-admin-access.json'),{recursive:true});
  await f.account(['resume','--remote','--operation',id]);assert.equal(f.writes,1);await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
});
test('first-use username change revokes old access and survives a Worker restart with stale bootstrap configuration',async t=>{
  const f=await fixture(t);const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];
  await f.account(['change-username','--remote','--username',' New.Owner@Example.Invalid ']);
  assert.equal((await f.login()).status,401);assert.equal((await f.request('https://site.test/api/auth/session',{headers:{Cookie:cookie}})).status,401);
  const current=access(f.root,{});assert.equal(current.auth.username,'new.owner@example.invalid');assert.equal(current.auth.password,password);
  await f.restart();await verifyCredentials('https://site.test',current.auth,f.request);
  assert.equal(read(path.join(f.root,'.secrets/production.json')).ADMIN_USERNAME,owner);
});
test('UI-rotated passwords and renamed usernames remain authoritative through subsequent recovery and restart',async t=>{
  const f=await fixture(t),changed='synthetic-password-from-account-ui';const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];
  const rotated=await f.request('https://site.test/api/admin/account/password',{method:'POST',headers:{Origin:'https://site.test',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({current_password:password,new_password:changed})});assert.equal(rotated.status,200);
  atomic(path.join(f.root,'.secrets/current-ui.json'),{username:owner,password:changed});
  await verifyCredentials('https://site.test',access(f.root,{'credentials-file':'.secrets/current-ui.json'}).auth,f.request);
  await f.account(['change-username','--remote','--username','changed-owner','--credentials-file','.secrets/current-ui.json']);
  await f.restart();await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
  const recovered=await f.account(['rotate-password','--remote']);assert.equal(recovered.current_access,'updated');assert.equal(access(f.root,{}).auth.username,'changed-owner');
  await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
});
test('an unknown current password leaves an explicit private-reference blocker instead of using the bootstrap password',async t=>{
  const f=await fixture(t);const replacement=pbkdf2Sync('unknown-current-private-password',Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
  await f.db.prepare('INSERT INTO admin_credentials(id,password_hash,version,updated_at,username) VALUES(1,?,1,?,?)').bind('pbkdf2_sha256$100000$'+salt+'$'+replacement,new Date().toISOString(),owner).run();
  const result=await f.account(['change-username','--remote','--username','new-owner']);assert.equal(result.current_access,'needs-current-private-password');
  assert.throws(()=>access(f.root,{}),/credentials/);
  await f.account(['rotate-password','--remote']);await verifyCredentials('https://site.test',access(f.root,{}).auth,f.request);
});
test('a newer account change prevents pending recovery from overwriting it or its current reference',async t=>{
  const f=await fixture(t);f.fail();let id;
  await assert.rejects(f.account(['rotate-password','--remote']),error=>{id=error.operationId;return !!id;});
  const newer=await f.account(['change-username','--remote','--username','newer-owner']);const reference=read(path.join(f.root,'.secrets/current-admin-access.json'));const writes=f.writes;
  await assert.rejects(f.account(['resume','--remote','--operation',id]));assert.equal(f.writes,writes);assert.deepEqual(read(path.join(f.root,'.secrets/current-admin-access.json')),reference);
  assert.equal((await f.db.prepare('SELECT recovery_id FROM admin_credentials').first()).recovery_id,newer.operation_id);
});
test('local recovery keeps production access separate and rejects a changed target reference',async t=>{
  const f=await fixture(t);const result=await f.account(['rotate-password','--local']);
  assert.equal(result.mode,'local');assert.equal(access(f.root,{}).auth.password,password);
  assert.equal(read(path.join(f.root,'.secrets/current-local-admin-access.json')).target.mode,'local');
  await f.account(['rotate-password','--remote']);const config=read(path.join(f.root,'wrangler.jsonc'));config.d1_databases[0].database_id='22345678-1234-4234-8234-123456789abc';atomic(path.join(f.root,'wrangler.jsonc'),config);
  assert.throws(()=>access(f.root,{}),/credentials/);
});
test('recovery option parsing never interprets an explicit false string or unknown flag as authorization',()=>{
  for(const args of [['rotate-password','--remote','false'],['rotate-password','--local','--remote'],['change-username','--remote'],['rotate-password','--remote','--username','someone'],['rotate-password','--remote','--skip-checks']])assert.throws(()=>accountPlan(args));
});
