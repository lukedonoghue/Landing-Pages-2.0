/** Guarded release driver. The CLI entry holds a project-wide process lock. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseArgs, loadFixture } from './browser-compat.mjs';
import { credentials, testRunOptions, runLiveVerify } from './live-verify.mjs';
import { UUID, read, atomic, inside, hash, validateTarget, chooseOrigin, originsFromOutput, initialSecrets, testSummary, localRunner, provider, runtimeIdentity, expectedIdentity, sameReleaseIdentity, verifyCredentials, checkLock } from './release-tools.mjs';

const allowed=new Set(['resume','new-release','url','fixture','credentials-file','password-file','python','browser-executable']);
const success=result=>{if(result.code!==0)throw new Error('A required local/publishing command failed. Inspect the private release diagnostic; no success was assumed.');return result.stdout;};
export function argumentsFor(argv) {
  const args=parseArgs(argv);
  if(Object.keys(args).some(key=>!allowed.has(key)))throw new Error('Unsupported publish option. Use private credential files, --resume, or --new-release.');
  for(const key of ['resume','new-release'])if(args[key]!==undefined && args[key]!==true)throw new Error('Boolean publication options cannot take a value.');
  if(args.resume && args['new-release'])throw new Error('Resume the saved release or create a new one, not both.');
  return args;
}
export function access(root,args) {
  try {
    const saved=existsSync(path.join(root,'.secrets/current-admin-access.json'))?read(path.join(root,'.secrets/current-admin-access.json')):{};
    if(saved.needs_password && !args['credentials-file'] && !args['password-file'])throw new Error('Current private password is required.');
    let savedTarget;
    if(saved.target){
      const config=read(path.join(root,'wrangler.jsonc'));
      if(saved.target.mode==='production' && saved.target.account_id===config.account_id && saved.target.worker===config.name && saved.target.database_id===config.d1_databases?.[0]?.database_id)savedTarget=saved.target;
      else if(!args['credentials-file'])throw new Error('The saved credential reference belongs to another destination.');
    }
    const production=existsSync(path.join(root,'.secrets/production.json'))?read(path.join(root,'.secrets/production.json')):null;
    const file=args['credentials-file'] || (!args['password-file'] && saved.credentials_file);
    const password=args['password-file'] || (!file && saved.password_file) || '.secrets/production-admin-password.txt';
    const options=file?{'credentials-file':path.resolve(root,file)}:{'password-file':path.resolve(root,password)};
    const username=(!saved.target || savedTarget ? saved.username : null) || production?.ADMIN_USERNAME || process.env.ADMIN_USERNAME;
    const auth=credentials(options,{ADMIN_USERNAME:username});
    if(!/^[a-z0-9][a-z0-9._@+-]{2,79}$/i.test(auth.username.trim()) || !auth.password || auth.password.length>1024)throw new Error('invalid');
    return {auth:{username:auth.username.trim().toLowerCase(),password:auth.password},options,production,
      reference:{...(file?{credentials_file:path.resolve(root,file)}:{password_file:path.resolve(root,password)}),username:auth.username.trim().toLowerCase(),...(savedTarget?{target:savedTarget}:{})}};
  } catch {throw new Error('Current private administrator credentials are missing or malformed. Use --credentials-file or --password-file; never put passwords in command arguments or project source.');}
}
export async function localPreconditions(root,args,auth,run) {
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22 || (major===22&&minor<19))throw new Error('Use the supported Node runtime before publishing.');
  const fixturePath=inside(root,args.fixture||'test-fixture.json');
  const fixture=loadFixture(fixturePath);
  if(!fixture.fields || Array.isArray(fixture.fields) || typeof fixture.fields!=='object' || fixture.synthetic!==true)throw new Error('The reviewed form fixture must use explicit synthetic fields.');
  const approval=read(path.join(root,'build/workflow.json')).approvals?.publish;
  testRunOptions({'allow-test-lead':approval?.allow_test_lead===true},fixture);
  const { chromium }=await import('playwright-core'); let browser;
  try {
    browser=await chromium.launch({headless:true,...(args['browser-executable']?{executablePath:args['browser-executable']}:{})});
    const page=await browser.newPage();await page.setContent('<!doctype html><title>Local selector validation</title>');
    for(const selector of Object.values(fixture.selectors)){if(typeof selector!=='string'||!selector.trim())throw new Error('invalid selector');await page.locator(selector).count();}
  } catch {throw new Error('Chromium or a fixture selector is unavailable/invalid. Repair the local verification setup before any remote mutation.');}
  finally{await browser?.close();}
  const scan=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('Public source cannot contain symlinks.');if(entry.isDirectory())scan(file);else if(auth.password.length>=8&&readFileSync(file).includes(Buffer.from(auth.password)))throw new Error('The current administrator password appears in a public asset. Remove it before publication.');}};
  scan(path.join(root,'public'));
  const python=args.python||process.env.FUNNEL_PYTHON||'python3';
  success(await run(python,['scripts/workflow.py','check-publish','.']));
  success(await run(process.execPath,['scripts/preflight.mjs']));
  if(!existsSync(path.join(root,'tests/backend.test.mjs')))throw new Error('Application regressions are missing.');
  const tests=readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
  testSummary(success(await run(process.execPath,['--test','--test-reporter=tap',...tests])));
  const wrangler=read(path.join(root,'node_modules/wrangler/package.json'));
  if(wrangler.version!=='4.115.0')throw new Error('Install the locked Wrangler version with npm ci before using this release adapter.');
  return fixture;
}
export async function publish(root,args,runtime={}) {
  root=path.resolve(root);
  const imported=path.join(root,'build/handoff-import.json');
  if(existsSync(imported) && read(imported).publication_context_pending)throw new Error('This imported handoff needs its current user/account scope reconciled before any publishing or live recovery. Retained publication history is not authorization.');
  const lockFd=runtime.lockFd ?? checkLock(root);
  const run=runtime.run || localRunner(root,lockFd);
  const python=args.python||process.env.FUNNEL_PYTHON||'python3';
  const pointerPath=inside(root,'build/current-release.json');
  const pointer=existsSync(pointerPath)?read(pointerPath):null;
  if(args.resume && !pointer)throw new Error('No saved guarded release exists to resume. Inspect any legacy deployment record; do not invent an upload result.');
  if(!pointer && existsSync(path.join(root,'build/deployment-record.json')))throw new Error('A legacy upload record exists without frozen release evidence. Reconcile that deployment before starting a new upload.');
  let state,base,packageRoot;
  let log=inside(root,'.secrets/publish-preflight.log',true);
  const py=async argv=>JSON.parse(success(await run(python,[path.join(root,'scripts/release_state.py'),...argv],{log})));
  const persist=(phase,detail={})=>{state.phase=phase;state.last_error=null;state.updated_at=new Date().toISOString();state.events.push({phase,at:state.updated_at,...detail});atomic(path.join(base,'state.json'),state);};
  if(pointer && !UUID.test(pointer.id||''))throw new Error('The saved release pointer is invalid.');
  if(pointer && !args['new-release']) {
    base=inside(root,'build/releases/'+pointer.id);state=read(path.join(base,'state.json'));packageRoot=path.join(base,'package');
    if(state.id!==pointer.id)throw new Error('Release pointer and state disagree.');
    await py(['validate',root,'--id',state.id]);
    if(args.fixture && args.fixture!==state.fixture)throw new Error('Resume uses the frozen reviewed fixture. A changed fixture needs a newly reviewed release.');
  } else {
    if(pointer) {
      const previous=read(inside(root,'build/releases/'+pointer.id+'/state.json'));
      if(previous.phase!=='verified')throw new Error('The current release is unresolved. Resume/reconcile it before another upload.');
      await py(['verified',root,'--id',pointer.id]);
    }
    const config=read(path.join(root,'wrangler.jsonc')),funnel=read(path.join(root,'funnel.json'));
    if(funnel.development_fixture)throw new Error('Fictional development fixtures cannot be published.');
    const login=access(root,args); // Fail malformed/private prerequisites before remote activity.
    const target=validateTarget(config);
    chooseOrigin(target,[],args.url); // An arbitrary --url cannot be discovered after mutation.
    await (runtime.localPreconditions||localPreconditions)(root,args,login.auth,run);
    const id=randomUUID();const frozen=await py(['freeze',root,'--id',id,'--fixture',args.fixture||'test-fixture.json']);
    base=inside(root,'build/releases/'+id);packageRoot=path.join(base,'package');
    state={schema_version:1,id,created_at:new Date().toISOString(),source_fingerprint:frozen.source_fingerprint,fixture:frozen.fixture,target,phase:'prepared',events:[],attempt:0,known_origins:[]};
    persist('prepared');atomic(pointerPath,{schema_version:1,id});
  }
  log=inside(root,'.secrets/release-'+state.id+'.log',true);
  const uploadLog=inside(root,'.secrets/release-'+state.id+'-upload.log',true);
  const target=validateTarget(read(path.join(packageRoot,'wrangler.jsonc')));
  if(JSON.stringify(target)!==JSON.stringify(state.target))throw new Error('Frozen destination differs from the saved release state.');
  chooseOrigin(target,state.known_origins,args.url);
  const cloud=runtime.provider || provider(root,packageRoot,target,run,log);
  const fetcher=runtime.fetch || fetch;
  const inspect=()=>cloud.inspect();
  const validate=async()=>{const sealed=await py(['validate',root,'--id',state.id]);if(sealed.id!==state.id||sealed.source_fingerprint!==state.source_fingerprint||sealed.fixture!==state.fixture)throw new Error('Release state differs from its sealed source/fixture.');return sealed;};
  await validate();
  try {
    let observed=await inspect();
    if(['prepared','preflight_failed'].includes(state.phase)) {
      const login=access(root,args);
      if(observed) {
        if(observed.database_id!==target.database_id || !UUID.test(observed.release_id||'') || !observed.source_fingerprint)throw new Error('An existing Worker does not match this guarded application/database. Use a reviewed legacy migration rather than overwriting it.');
        const previous=existsSync(path.join(root,'build/deployment-record.json'))?read(path.join(root,'build/deployment-record.json')):null;
        const priorOrigins=previous && previous.worker===target.worker && previous.account_id===target.account_id && previous.database_id===target.database_id?[previous.url]:[];
        const priorUrl=chooseOrigin(target,priorOrigins,args.url);
        if(!priorUrl)throw new Error('Confirm the existing Worker origin from its actual deployment before redeploying.');
        await runtimeIdentity(priorUrl,observed,fetcher);
        await verifyCredentials(priorUrl,login.auth,fetcher);
        state.known_origins=priorOrigins;state.first_deploy=false;
      } else {initialSecrets(login.production,login.auth);state.first_deploy=true;}
      atomic(inside(root,'.secrets/current-admin-access.json',true),login.reference);
      await validate();persist('migrations_started');
      const result=await cloud.call(['d1','migrations','apply','DB','--remote']);
      if(result.code!==0)throw new Error('Migrations did not confirm success. Resume will inspect the migration ledger before any further change.');
    }
    if(state.phase==='migrations_started') {
      const query=await cloud.call(['d1','execute','DB','--remote','--command','SELECT name FROM d1_migrations','--json']);
      let applied=[];
      try{const rows=JSON.parse(query.stdout);if(query.code!==0||!Array.isArray(rows))throw new Error();applied=rows.flatMap(item=>item.results||[]).map(item=>item.name);}catch{throw new Error('The migration ledger is not confirmed. Inspect the saved attempt and database before any retry.');}
      const expected=readdirSync(path.join(packageRoot,'migrations')).filter(name=>name.endsWith('.sql'));
      if(!expected.length||expected.some(name=>!applied.includes(name)))throw new Error('Some migrations remain unconfirmed. No upload was attempted; reconcile the migration outcome before retrying.');
      persist('migrations_done');
    }
    if(state.phase==='migrations_done') {
      await validate();
      const current=JSON.parse(success(await run(python,[path.join(root,'scripts/check_gates.py'),'snapshot',root,'--mode','handoff','--out','build/publish-source-check.json'],{log})));
      if(current.source_fingerprint!==state.source_fingerprint)throw new Error('Working source changed after release approval. The frozen package was preserved; review the new work before any upload.');
      persist('upload_started');
      const command=['deploy','--tag',state.id,'--var','FUNNEL_RELEASE_ID:'+state.id,'--var','FUNNEL_SOURCE_FINGERPRINT:'+state.source_fingerprint,'--no-autoconfig'];
      if(state.first_deploy)command.push('--secrets-file',inside(root,'.secrets/production.json',true));
      const uploaded=await run(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),...command,'--config',path.join(packageRoot,'wrangler.jsonc')],{cwd:packageRoot,env:{CLOUDFLARE_ACCOUNT_ID:target.account_id},log:uploadLog});
      state.known_origins=[...new Set([...state.known_origins,...originsFromOutput(uploaded.stdout,target.worker)])];
      persist('upload_started',{command_exit:uploaded.code});
      // Independently inspect even when the CLI response was lost or unsuccessful.
      observed=await inspect();
    }
    if(state.phase==='upload_started' && existsSync(uploadLog))state.known_origins=[...new Set([...state.known_origins,...originsFromOutput(readFileSync(uploadLog,'utf8'),target.worker)])];
    const url=chooseOrigin(target,state.known_origins,args.url);
    if(!url)throw new Error('The upload outcome needs its actual origin. Recover the original upload output or reviewed domain; do not upload again.');
    const identity=expectedIdentity(observed,target,state.id,state.source_fingerprint,url);
    if(state.identity)sameReleaseIdentity(identity,state.identity);
    state.identity=identity;
    if(state.phase==='upload_started')persist('uploaded');
    await runtimeIdentity(url,identity,fetcher);
    await validate();
    const compat={...identity,uploaded_at:state.events.find(e=>e.phase==='uploaded')?.at||state.created_at,verification_pending:true,release_id:state.id};
    if(state.phase==='verified'){
      const proof=await py(['verified',root,'--id',state.id]);
      sameReleaseIdentity(identity,read(inside(packageRoot,proof.identity.path)));
      atomic(inside(root,'build/deployment-record.json'),{...compat,verification_pending:false});
      return {status:'verified',url,release_id:state.id,identity_rechecked_at:new Date().toISOString(),verification:proof};
    }
    atomic(inside(root,'build/deployment-record.json'),compat);
    if(state.phase==='public_checks_passed')return {status:'uploaded_unverified',readiness:'public-checks-only',url,release_id:state.id,reason:'The frozen approval did not authorize a controlled live lead. Its scope must be resolved before full verification.'};
    await py(['live-snapshot',root,'--id',state.id]);
    let attempt=String(state.attempt).padStart(3,'0');
    let out=path.join(packageRoot,'build/live',attempt);
    const previous=state.attempt && existsSync(path.join(out,'result.json'))?read(path.join(out,'result.json')):null;
    if(previous?.fully_verified===true && ['pass','pass_with_warnings'].includes(previous.status)) {
      const verified=await py(['finalize',root,'--id',state.id,'--attempt',attempt]);persist('verified');atomic(inside(root,'build/deployment-record.json'),{...compat,verification_pending:false});return verified;
    }
    const checkpoint=state.attempt && existsSync(path.join(out,'attempt.json'))?read(path.join(out,'attempt.json')):null;
    const resumeJourney=checkpoint?.schema_version===2;
    if(state.attempt && !resumeJourney && (!checkpoint || checkpoint.form_attempted))throw new Error('A prior verification may have submitted a synthetic lead without a supported recovery journal. Its request/receipt is retained. Reconcile that attempt before another submission; resume has not redeployed or repeated it.');
    if(!resumeJourney && state.attempt>=3)throw new Error('The bounded verification retry budget is exhausted; inspect the recorded failures.');
    const approval=read(path.join(base,'inputs.json')).approval;
    if(resumeJourney && !approval.allow_test_lead)throw new Error('The frozen approval did not authorize this synthetic journey. Preserve the record and resolve its scope before recovery.');
    const login=approval.allow_test_lead?access(root,args):null;
    if(!resumeJourney){
      state.attempt++;attempt=String(state.attempt).padStart(3,'0');out=path.join(packageRoot,'build/live',attempt);
      atomic(path.join(out,'identity.json'),identity);atomic(path.join(out,'attempt.json'),{schema_version:1,form_attempted:false,stage:'prepared'});
    } else sameReleaseIdentity(identity,read(path.join(out,'identity.json')));
    persist('verification_started',{attempt,resumed_journey:resumeJourney});
    const verifyArgs={url,'allow-remote':true,fixture:path.join(packageRoot,state.fixture),'project-root':packageRoot,snapshot:'build/live/snapshot.json',out,'deployment-record':path.join(out,'identity.json'),identity:path.join(out,'identity.json')};
    if(login){Object.assign(verifyArgs,login.options,{'allow-test-lead':true});}
    else verifyArgs['read-only']=true;
    if(resumeJourney)verifyArgs['resume-journey']=true;
    const result=await (runtime.verify||runLiveVerify)(verifyArgs,{env:{...process.env,ADMIN_USERNAME:login?.auth.username},fetch:fetcher});
    if(!approval.allow_test_lead && result.status==='pass_with_warnings' && result.readiness==='public-checks-only'){persist('public_checks_passed',{attempt});return {status:'uploaded_unverified',readiness:result.readiness,url,release_id:state.id};}
    if(!result.fully_verified){persist('verification_failed',{attempt,readiness:result.readiness||'incomplete'});throw new Error('Upload is retained, but live verification is incomplete. Resume this release after addressing the recorded failure; no second deployment is needed.');}
    const verified=await py(['finalize',root,'--id',state.id,'--attempt',attempt]);
    persist('verified');atomic(inside(root,'build/deployment-record.json'),{...compat,verification_pending:false});return verified;
  } catch(error) {
    if(state.phase==='prepared')persist('preflight_failed');
    state.last_error={at:new Date().toISOString(),phase:state.phase,message:error.message};state.events.push({event:'failed',...state.last_error});atomic(path.join(base,'state.json'),state);
    throw error;
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {const result=await publish(process.cwd(),argumentsFor(process.argv.slice(2)));console.log(JSON.stringify(result,null,2));if(result.status!=='verified')process.exitCode=1;}
  catch(error){console.error(error.message);process.exitCode=1;}
}
