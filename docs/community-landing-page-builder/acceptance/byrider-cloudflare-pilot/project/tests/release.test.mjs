/** Offline protocol tests. Injected provider/approval fixtures are never launch evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pbkdf2Sync } from 'node:crypto';
import { publish, argumentsFor, access, localPreconditions } from '../scripts/publish-driver.mjs';
import { atomic, read, validateTarget, chooseOrigin, originsFromOutput, provider, runtimeIdentity, expectedIdentity, sameReleaseIdentity, initialSecrets, testSummary, verifyCredentials } from '../scripts/release-tools.mjs';

const id='11111111-1111-4111-8111-111111111111', db='22222222-2222-4222-8222-222222222222';
const version='33333333-3333-4333-8333-333333333333', other='44444444-4444-4444-8444-444444444444';
const fingerprint='a'.repeat(64), url='https://protocol.example';
const config={name:'protocol-fixture',account_id:'b'.repeat(32),routes:[{pattern:'protocol.example',custom_domain:true}],d1_databases:[{binding:'DB',database_id:db}],assets:{directory:'public',run_worker_first:true},version_metadata:{binding:'CF_VERSION_METADATA'}};
const target=validateTarget(config);
const identity={schema_version:1,evidence_source:'cloudflare-wrangler-deployments-and-version-api',...target,version_id:version,release_id:id,source_fingerprint:fingerprint,url,script_etag:'synthetic-etag',active_versions:[{version_id:version,percentage:100}]};

function fixture(t,phase='uploaded',attempt=0) {
  const root=mkdtempSync(path.join(tmpdir(),'release-protocol-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const base=path.join(root,'build/releases',id),pkg=path.join(base,'package');
  const put=(name,value)=>atomic(path.join(root,name),value);
  const state={schema_version:1,id,phase,attempt,fixture:'test-fixture.json',source_fingerprint:fingerprint,target,identity:{...identity},known_origins:[],created_at:new Date().toISOString(),events:[]};
  put('build/current-release.json',{id});atomic(path.join(pkg,'wrangler.jsonc'),config);atomic(path.join(base,'state.json'),state);
  atomic(path.join(base,'inputs.json'),{approval:{allow_test_lead:false}});
  atomic(path.join(pkg,'build/live/001/identity.json'),identity);
  put('build/deployment-record.json',{...identity,verification_pending:false});
  const calls={inspect:0,commands:[],fetch:[],verify:0};const observed={...identity};
  const runtime={lockFd:99,provider:{inspect:async()=>{calls.inspect++;return observed;},call:async()=>{throw Error('Unexpected mutation');}},
    fetch:async(request,options)=>{calls.fetch.push([request,options]);assert.equal(request,url+'/api/health');return {ok:true,json:async()=>({ok:true,database:'connected',release:{version_id:observed.version_id,release_id:observed.release_id,source_fingerprint:observed.source_fingerprint}})};},
    run:async(_command,args)=>{calls.commands.push(args);const action=args[1];assert.ok(['validate','verified','live-snapshot','finalize'].includes(action));return {code:0,stdout:JSON.stringify(action==='verified'?{status:'verified',identity:{path:'build/live/001/identity.json'}}:action==='finalize'?{status:'verified'}:{id,source_fingerprint:fingerprint,fixture:'test-fixture.json'})};},
    verify:async args=>{calls.verify++;assert.equal(args['read-only'],true);return {status:'pass_with_warnings',readiness:'public-checks-only'};}};
  return {root,base,pkg,put,state,calls,observed,runtime};
}

test('verified resume preserves a completed summary without another form or upload',async t=>{
  const f=fixture(t,'verified',1);const result=await publish(f.root,{resume:true},f.runtime);
  assert.equal(result.status,'verified');assert.equal(read(path.join(f.root,'build/deployment-record.json')).verification_pending,false);assert.equal(f.calls.verify,0);
});
test('imported publication history cannot contact a provider before current user scope is reconciled',async t=>{
  const f=fixture(t,'verified',1);f.put('build/handoff-import.json',{publication_context_pending:true});
  for(const args of [{},{resume:true},{'new-release':true}])await assert.rejects(publish(f.root,args,f.runtime),/current user\/account scope/);
  assert.equal(f.calls.inspect,0);assert.equal(f.calls.verify,0);assert.deepEqual(f.calls.commands,[]);
});
test('active version replacement cannot reuse an older journey, even with unchanged markers',async t=>{
  const f=fixture(t,'verified',1);f.observed.version_id=other;
  await assert.rejects(publish(f.root,{resume:true},f.runtime),/active release differs/);
  assert.equal(read(path.join(f.root,'build/deployment-record.json')).version_id,version);assert.equal(f.calls.verify,0);
});
test('saved state cannot substitute for the retained verified identity',async t=>{
  const f=fixture(t,'verified',1);f.observed.version_id=other;f.state.identity.version_id=other;atomic(path.join(f.base,'state.json'),f.state);
  await assert.rejects(publish(f.root,{resume:true},f.runtime),/active release differs/);assert.equal(f.calls.verify,0);
});
test('accepted but incomplete form attempt is retained without another submission',async t=>{
  const f=fixture(t,'verification_started',1);atomic(path.join(f.pkg,'build/live/001/attempt.json'),{form_attempted:true,request_key:'synthetic-key',receipt:{lead_id:id}});
  await assert.rejects(publish(f.root,{resume:true},f.runtime),/prior verification may have submitted/);assert.equal(f.calls.verify,0);
});
test('supported journey recovery stays in the same approved attempt without another upload',async t=>{
  const f=fixture(t,'verification_failed',1);const checkpoint={schema_version:2,id,form_attempted:true,runs:1,request_key:'synthetic-key'};
  atomic(path.join(f.pkg,'build/live/001/attempt.json'),checkpoint);atomic(path.join(f.base,'inputs.json'),{approval:{allow_test_lead:true}});
  f.put('.secrets/current.json',{username:'owner',password:'synthetic-current-password'});f.put('.secrets/current-admin-access.json',{credentials_file:path.join(f.root,'.secrets/current.json')});
  f.runtime.verify=async args=>{f.calls.verify++;assert.equal(args['resume-journey'],true);assert.equal(args.out,path.join(f.pkg,'build/live/001'));assert.equal(args['allow-test-lead'],true);return {fully_verified:true,status:'pass'};};
  await publish(f.root,{resume:true},f.runtime);
  assert.equal(read(path.join(f.base,'state.json')).attempt,1);assert.deepEqual(read(path.join(f.pkg,'build/live/001/attempt.json')),checkpoint);assert.equal(f.calls.verify,1);
});
test('recovery cannot expand a frozen read-only approval',async t=>{
  const f=fixture(t,'verification_failed',1);atomic(path.join(f.pkg,'build/live/001/attempt.json'),{schema_version:2,id,form_attempted:true,runs:1});
  await assert.rejects(publish(f.root,{resume:true},f.runtime),/frozen approval did not authorize/);assert.equal(f.calls.verify,0);
});
test('completed journey resumes finalization without a browser or form retry',async t=>{
  const f=fixture(t,'verification_started',1);atomic(path.join(f.pkg,'build/live/001/result.json'),{fully_verified:true,status:'pass'});
  await publish(f.root,{resume:true},f.runtime);assert.equal(read(path.join(f.base,'state.json')).phase,'verified');assert.equal(f.calls.verify,0);
  assert.ok(f.calls.commands.some(args=>args[1]==='finalize'));
});
test('uncertain upload adopts its inspected version and performs no second upload',async t=>{
  const f=fixture(t,'upload_started');delete f.state.identity;atomic(path.join(f.base,'state.json'),f.state);
  assert.equal((await publish(f.root,{resume:true},f.runtime)).status,'uploaded_unverified');assert.equal(f.calls.verify,1);
  assert.equal(read(path.join(f.base,'state.json')).phase,'public_checks_passed');
  await publish(f.root,{resume:true},f.runtime);assert.equal(f.calls.verify,1);
});
test('wrong binding blocks uncertain upload recovery before credentials or a test lead',async t=>{
  const f=fixture(t,'upload_started');f.observed.database_id=other;
  await assert.rejects(publish(f.root,{resume:true},f.runtime),/does not show the expected/);assert.equal(f.calls.fetch.length,0);assert.equal(f.calls.verify,0);
});
test('an exhausted verification budget and unresolved releases cannot be restarted',async t=>{
  const f=fixture(t,'verification_failed',3);atomic(path.join(f.pkg,'build/live/003/attempt.json'),{form_attempted:false});
  await assert.rejects(publish(f.root,{resume:true},f.runtime),/retry budget/);
  await assert.rejects(publish(f.root,{'new-release':true},f.runtime),/current release is unresolved/);
});
test('credential and override errors fail before provider inspection',async t=>{
  const f=fixture(t);rmSync(path.join(f.root,'build'),{recursive:true});f.put('wrangler.jsonc',config);f.put('funnel.json',{});
  await assert.rejects(publish(f.root,{},f.runtime),/credentials/);assert.equal(f.calls.inspect,0);
  assert.throws(()=>argumentsFor(['--skip-checks']),/Unsupported/);assert.throws(()=>argumentsFor(['--resume','--new-release']),/not both/);
});
test('current credential references override original bootstrap password',t=>{
  const f=fixture(t);f.put('.secrets/production.json',{ADMIN_USERNAME:'owner'});f.put('.secrets/current.json',{username:'owner',password:'synthetic-rotated-password'});
  f.put('.secrets/current-admin-access.json',{credentials_file:path.join(f.root,'.secrets/current.json')});
  assert.equal(access(f.root,{}).auth.password,'synthetic-rotated-password');
});
test('origin and source guards reject unrelated targets',()=>{
  assert.throws(()=>chooseOrigin(target,[], 'https://elsewhere.example'),/not a reviewed/);
  assert.deepEqual(originsFromOutput('https://other.account.workers.dev https://protocol-fixture.account.workers.dev',target.worker),['https://protocol-fixture.account.workers.dev']);
  assert.throws(()=>expectedIdentity({...identity,source_fingerprint:'c'.repeat(64)},target,id,fingerprint,url),/does not show/);
  assert.throws(()=>sameReleaseIdentity({...identity,script_etag:'changed'},identity),/active release/);
  assert.throws(()=>validateTarget({...config,env:{production:{}}}),/flat Workers/);
});
test('initial secrets must match current login and all tests must actually run',()=>{
  const password='synthetic-initial-password',salt='1'.repeat(32);
  const secrets={ADMIN_USERNAME:'owner',SESSION_SECRET:'2'.repeat(64),ADMIN_PASSWORD_HASH:`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`};
  initialSecrets(secrets,{username:'owner',password});assert.throws(()=>initialSecrets(secrets,{username:'owner',password:'changed'}),/does not match/);
  assert.equal(testSummary('# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n').pass,2);
  assert.throws(()=>testSummary('# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 1\n'),/skipped/);
});
test('provider chooses latest active version and extracts its actual D1 binding',async()=>{
  const calls=[];const run=async(_cmd,args)=>{calls.push(args);return {code:0,stdout:JSON.stringify(args.includes('deployments')?[
    {id:'old',created_on:'2026-09-01T00:00:00Z',versions:[{version_id:other,percentage:100}]},
    {id:'new',created_on:'2026-09-02T00:00:00Z',versions:[{version_id:version,percentage:100}]}
  ]:{id:version,resources:{script:{etag:'actual-etag'},bindings:[{type:'d1',name:'DB',id:db},{type:'plain_text',name:'FUNNEL_RELEASE_ID',text:id},{type:'plain_text',name:'FUNNEL_SOURCE_FINGERPRINT',text:fingerprint}]}})};};
  const observed=await provider('/fixture','/fixture/package',target,run).inspect();assert.equal(observed.database_id,db);assert.equal(observed.deployment_id,'new');assert.ok(calls[1].includes(version));
});
test('provider ambiguity and unavailable API never become an absent Worker',async()=>{
  const inspect=run=>provider('/fixture','/fixture/package',target,run).inspect();
  assert.equal(await inspect(async()=>({code:1,stdout:'',stderr:'[code: 10007]'})),null);
  await assert.rejects(inspect(async()=>({code:1,stdout:'',stderr:'Permission denied'})),/inspection failed/);
  await assert.rejects(inspect(async()=>({code:0,stdout:JSON.stringify([{created_on:'2026-09-02',versions:[{version_id:version,percentage:50},{version_id:other,percentage:50}]}])})),/fully active/);
});
test('runtime identity mismatch fails and never follows an origin redirect',async()=>{
  let options;await assert.rejects(runtimeIdentity(url,identity,async(_request,opts)=>{options=opts;return {ok:true,json:async()=>({ok:true,database:'connected',release:{version_id:other}})};}),/does not match/);assert.equal(options.redirect,'error');
});
test('current login is checked and its session revoked without exposing credentials',async()=>{
  const calls=[];await verifyCredentials(url,{username:'owner',password:'synthetic'},async(request,options)=>{calls.push([request,options]);return {ok:true,headers:new Headers({'set-cookie':'session=synthetic; Secure'}),json:async()=>({authenticated:true})};});
  assert.deepEqual(calls.map(([request])=>new URL(request).pathname),['/api/auth/login','/api/auth/session','/api/auth/logout']);
  assert.ok(calls.every(([,options])=>options.redirect==='error'));
});

function newProject(t) {
  const f=fixture(t);rmSync(path.join(f.root,'build'),{recursive:true});
  f.put('wrangler.jsonc',config);f.put('funnel.json',{});
  const password='synthetic-bootstrap-password',salt='1'.repeat(32);
  f.put('.secrets/production.json',{ADMIN_USERNAME:'owner',SESSION_SECRET:'2'.repeat(64),ADMIN_PASSWORD_HASH:`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`});
  writeFileSync(path.join(f.root,'.secrets/production-admin-password.txt'),password+'\n');
  let savedId, uploaded=false;const writes=[];
  f.runtime.localPreconditions=async()=>{};
  f.runtime.provider={inspect:async()=>{f.calls.inspect++;return uploaded?{...identity,release_id:savedId}:null;},call:async args=>{writes.push(args);return {code:0,stdout:JSON.stringify([{results:[{name:'001.sql'}]}])};}};
  f.runtime.fetch=async()=>({ok:true,json:async()=>({ok:true,database:'connected',release:{version_id:version,release_id:savedId,source_fingerprint:fingerprint}})});
  f.runtime.run=async(_command,args)=>{
    f.calls.commands.push(args);
    if(args.includes('deploy')){uploaded=true;writes.push(args);return {code:1,stdout:'Upload response intentionally lost in this synthetic fixture'};}
    const action=args[1];
    if(action==='freeze'){
      savedId=args[args.indexOf('--id')+1];const base=path.join(f.root,'build/releases',savedId),pkg=path.join(base,'package');
      atomic(path.join(pkg,'wrangler.jsonc'),config);atomic(path.join(base,'inputs.json'),{approval:{allow_test_lead:false}});
      mkdirSync(path.join(pkg,'migrations'),{recursive:true});writeFileSync(path.join(pkg,'migrations/001.sql'),'-- synthetic');
    }
    assert.ok(['freeze','validate','live-snapshot','snapshot'].includes(action));
    return {code:0,stdout:JSON.stringify({id:savedId,fixture:'test-fixture.json',source_fingerprint:fingerprint})};
  };
  return {...f,writes};
}
test('first publish uploads secrets with its version and reconciles a lost CLI response',async t=>{
  const f=newProject(t);const result=await publish(f.root,{},f.runtime);
  assert.equal(result.status,'uploaded_unverified');const uploads=f.writes.filter(args=>args.includes('deploy'));
  assert.equal(uploads.length,1);assert.ok(uploads[0].includes('--secrets-file'));assert.equal(f.writes.some(args=>args.includes('bulk')),false);
  await publish(f.root,{resume:true},f.runtime);assert.equal(f.writes.filter(args=>args.includes('deploy')).length,1);assert.equal(f.calls.verify,1);
});
test('failed early prerequisites perform no inspection, migration, upload, or secret write',async t=>{
  const f=newProject(t);f.runtime.localPreconditions=async()=>{throw Error('Synthetic missing browser');};
  await assert.rejects(publish(f.root,{},f.runtime),/missing browser/);assert.equal(f.calls.inspect,0);assert.deepEqual(f.writes,[]);
});
test('resume validates an overridden origin before any inspection or mutations',async t=>{
  const f=fixture(t,'prepared');
  await assert.rejects(publish(f.root,{resume:true,url:'https://elsewhere.example'},f.runtime),/not a reviewed/);
  assert.equal(f.calls.inspect,0);assert.equal(f.calls.verify,0);
});
test('actual browser prerequisite fails early for an unavailable executable',async t=>{
  const f=fixture(t);f.put('test-fixture.json',{synthetic:true,path:'/',thank_you_path:'/thank-you.html',pdf_path:'/brochure.pdf',selectors:Object.fromEntries(['openModal','modal','step','next','submit','closeModal','error'].map(key=>[key,'#'+key])),fields:{name:'Synthetic'},query:{utm_source:'google',utm_medium:'cpc'},expected_dimensions:{source:'google',traffic:'paid',device:'desktop'}});
  f.put('build/workflow.json',{approvals:{publish:{allow_test_lead:true}}});let commands=0;
  await assert.rejects(localPreconditions(f.root,{'browser-executable':'/missing-synthetic-browser'}, {password:'synthetic'},async()=>{commands++;}),/Chromium|fixture/);
  assert.equal(commands,0);
});
