/** Trusted-operator bridge for the guided publisher. Never run with production
 * credentials in the coding agent. JSON stdout contains allow-listed summaries
 * only; raw tools and credential inputs remain in the private local directory. */
import {existsSync,readFileSync,writeFileSync,mkdirSync,chmodSync,lstatSync,realpathSync,readdirSync,renameSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createHash,randomUUID,randomBytes,createHmac} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {read,atomic,inside,validateTarget,provider,runtimeIdentity,localRunner,currentSourceFingerprint,UUID,SHA} from './release-tools.mjs';
import {access,publish,applicationRegressions} from './publish-driver.mjs';
import {sheetsEndpoint,signedSheetsPayload,readAppsScriptAck} from '../src/sheets-protocol.js';
import {assertPublicDestination} from '../src/webhooks.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACTIONS=new Set(['prerequisites','cloudflare','login','configure','quality','sheets','preflight','protect','publish','cleanup','verify','open_handoff']);
const result=(evidence={})=>({status:'pass',evidence});
export class NeedsAction extends Error {constructor(code,choices=[]){super(code);this.code=code;this.choices=choices;}}
const hex=value=>createHash('sha256').update(value).digest('hex');
const pack=value=>JSON.stringify(value,Object.keys(value).sort());
function must(condition,code='destination'){if(!condition)throw new NeedsAction(code);}
export function validateInput(input){
  must(input && typeof input==='object' && !Array.isArray(input));
  must(UUID.test(input.run_id||'') && SHA.test(input.source||''));
  const v=input.intent;
  must(!Object.keys(input).some(k=>!['run_id','source','intent','consents','attestations','handoff','previous_release'].includes(k)));
  must(v && typeof v==='object' && !Array.isArray(v));
  must(!Object.keys(v).some(k=>!['domain','owner','site','sheets','environment','account_id','existing_database_id','sheets_url','sheet_id'].includes(k)));
  must(typeof v.domain==='string' && v.domain.length<=253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v.domain));
  must(!/\.(?:localhost|local|invalid|test|example|internal)$/.test(v.domain));
  must(typeof v.owner==='string' && /^[a-z0-9][a-z0-9._+\-]{0,63}@[a-z0-9.-]+\.[a-z]{2,63}$/.test(v.owner) && v.owner.length<=80);
  must(/^[a-z][a-z0-9-]{2,48}$/.test(v.site||'') && v.site!=='branded-lead-funnel');
  must(typeof v.sheets==='boolean' && ['production','staging'].includes(v.environment));
  if(v.account_id)must(/^[a-f0-9]{32}$/.test(v.account_id));
  if(v.existing_database_id)must(UUID.test(v.existing_database_id));
  if(v.sheets_url)sheetsEndpoint(v.sheets_url);
  if(input.previous_release)must(UUID.test(input.previous_release));
  if(v.sheet_id)must(/^[A-Za-z0-9_-]{20,160}$/.test(v.sheet_id));
  return input;
}
function noSymlinkParents(file){for(let at=path.resolve(file);;at=path.dirname(at)){try{must(!lstatSync(at).isSymbolicLink());}catch(error){if(error.code!=='ENOENT')throw error;}if(at===path.dirname(at))break;}}
function privateDir(root){const dir=inside(root,'.secrets/ship',true);noSymlinkParents(dir);mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);return dir;}
function privateJson(root,name,value){const file=path.join(privateDir(root),name);noSymlinkParents(file);if(value!==undefined){atomic(file,value);chmodSync(file,0o600);}return existsSync(file)?read(file):null;}
function privateHome(root){const base=path.join(os.homedir(),'.landing-pages-publishing',hex(realpathSync(root)).slice(0,24));noSymlinkParents(base);mkdirSync(base,{recursive:true,mode:0o700});chmodSync(base,0o700);const relative=path.relative(realpathSync(root),base);must(relative.startsWith('..'+path.sep)||path.isAbsolute(relative));return base;}
export function localEnvironment(env=process.env){return Object.fromEntries(Object.entries(env).filter(([name])=>!/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL)|^(?:CLOUDFLARE_|CF_API_|AWS_|AZURE_|GH_|GITHUB_|GOOGLE_APPLICATION_CREDENTIALS)/i.test(name)));}
async function command(root,exe,args,{stdin,timeout=180000,env={},localOnly=false}={}){
  const log=path.join(privateDir(root),'diagnostic.log');
  return await new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{cwd:root,env:{...(localOnly?localEnvironment():process.env),...(!localOnly&&existsSync(path.join(root,'wrangler.jsonc'))&&/^[a-f0-9]{32}$/.test(read(path.join(root,'wrangler.jsonc')).account_id||'')?{CLOUDFLARE_ACCOUNT_ID:read(path.join(root,'wrangler.jsonc')).account_id}:{}),...env,WRANGLER_SEND_METRICS:'false'},stdio:['pipe','pipe','pipe'],detached:true});
    let out='',err='',over=false,killTimer;
    const kill=()=>{if(killTimer)return;try{process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},2000);};
    const timer=setTimeout(()=>{over=true;kill();},timeout);
    const collect=(part,isError)=>{if(over)return;const value=part.toString();if(isError)err+=value;else out+=value;if(out.length+err.length>16*1024*1024){over=true;kill();}};
    child.stdout.on('data',p=>collect(p,false));child.stderr.on('data',p=>collect(p,true));
    child.on('error',()=>{clearTimeout(timer);clearTimeout(killTimer);reject(new NeedsAction('prerequisites'));});
    child.on('close',code=>{clearTimeout(timer);clearTimeout(killTimer);writeFileSync(log,(out+'\n'+err).slice(-1024*1024),{mode:0o600});chmodSync(log,0o600);resolve({code:over?1:code,stdout:out,stderr:err});});
    child.stdin.on('error',()=>{});child.stdin.end(stdin||'');
  });
}
export function accountsFromWhoami(text){return [...new Set([...text.matchAll(/\b[a-f0-9]{32}\b/g)].map(m=>m[0]))];}
export function rateRule(){return {ref:'lp2_guided_lead_intake',description:'Landing Pages 2.0 public form protection',
  expression:'(http.request.uri.path eq "/api/leads")',action:'block',ratelimit:{characteristics:['cf.colo.id','ip.src'],period:10,requests_per_period:10,mitigation_timeout:10}};}
export function bookmarkFrom(value){
  // Wrangler/API representation: do not accept arbitrary stdout or a fabricated default.
  const bookmark=value?.bookmark ?? value?.result?.bookmark;
  must(typeof bookmark==='string' && /^[a-zA-Z0-9:_-]{8,256}$/.test(bookmark),'destination');return bookmark;
}
function targetMatches(config,intent){const t=validateTarget(config);must(t.account_id===intent.account_id && t.worker===intent.site && t.domains.includes('https://'+intent.domain));return t;}
function requireConsent(input,kind){const c=input.consents?.[kind];must(c && typeof c.message==='string' && c.message.length>20 && /^ship-ui:[a-f0-9-]{36}$/.test(c.message_id||''));if(kind==='publish')must(c.allow_test_lead===true && c.allow_cleanup===true && c.source===input.source,'approval_stale');return c;}
function success(res,code='destination'){must(res.code===0,code);return res.stdout;}
function jsonResult(res,code='destination'){try{return JSON.parse(success(res,code));}catch(error){if(error instanceof NeedsAction)throw error;throw new NeedsAction(code);}}
function cli(root){const p=path.join(root,'node_modules/wrangler/bin/wrangler.js');must(existsSync(p),'prerequisites');return p;}
const wrangler=(root,args,options)=>command(root,process.execPath,[cli(root),...args],options);
const python=(root,args,options)=>command(root,process.env.FUNNEL_PYTHON||'python3',args,options);
async function cloudIdentity(root,target){const run=localRunner(root);return provider(root,root,target,run,path.join(privateDir(root),'identity.log')).inspect();}
export function ownerHandoff(root,target){
  const pointer=inside(root,'.secrets/current-admin-access.json',true);
  const login=access(root,{}),ref=login.reference;
  const key=ref.credentials_file?'credentials_file':'password_file',source=ref[key];
  noSymlinkParents(source);must(existsSync(source));
  const relative=path.relative(realpathSync(root),realpathSync(source));
  if(relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return;
  must(relative.startsWith('.secrets'+path.sep));
  const name=(key==='credentials_file'?'owner-credentials-':'owner-password-')+hex(pack(target)).slice(0,16)+(key==='credentials_file'?'.json':'.txt');
  const destination=path.join(privateHome(root),name);noSymlinkParents(destination);
  if(!existsSync(destination))writeFileSync(destination,readFileSync(source),{mode:0o600,flag:'wx'});
  must(readFileSync(destination).equals(readFileSync(source)));
  atomic(pointer,{[key]:destination,username:login.auth.username,target:{mode:'production',account_id:target.account_id,worker:target.worker,database_id:target.database_id}});
  unlinkSync(source); // Only after byte verification and durable external reference.
}
export async function signedProbe(root,url,version,message,fetcher=fetch){
  const env=read(inside(root,'.secrets/production.json',true));
  const checked=await assertPublicDestination(sheetsEndpoint(url),fetcher);
  const event={event:'connection.probe',event_id:randomUUID(),lead_id:message};
  let response=await fetcher(checked,{method:'POST',headers:{'Content-Type':'application/json'},body:await signedSheetsPayload(env,url,event,version),redirect:'manual',signal:AbortSignal.timeout(15000)});
  if([301,302,303].includes(response.status)){
    const location=response.headers.get('location');await response.body?.cancel();
    const u=new URL(location);must(u.protocol==='https:'&&u.hostname==='script.googleusercontent.com'&&u.pathname.startsWith('/macros/')&&!u.username&&!u.password&&!u.port&&!u.hash,'sheets_probe');
    await assertPublicDestination(u.href,fetcher);
    response=await fetcher(u.href,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});
  }
  must(response.ok,'sheets_probe');const value=await readAppsScriptAck(response,event.event_id);
  must(value.protocol===2 && typeof value.lead_present==='boolean'&&typeof value.erased==='boolean'&&value.key_version===version,'sheets_probe');return value;
}
async function configuredSheets(root,input){
  must(input.intent.sheets_url&&input.intent.sheet_id,'sheets_setup');
  const target=targetMatches(read(path.join(root,'wrangler.jsonc')),input.intent),url=sheetsEndpoint(input.intent.sheets_url);
  let version=1;
  const ledger=await wrangler(root,['d1','execute','DB','--remote','--command',"SELECT destination,key_version FROM sheets_destination_keys",'--json']);
  if(ledger.code===0){const rows=jsonResult(ledger).flatMap(v=>v.results||[]);const retained=rows.find(v=>v.destination===url);if(retained)version=retained.key_version;}
  else {
    // Only a verified new uninitialised database may omit the security table.
    const catalog=jsonResult(await wrangler(root,['d1','execute','DB','--remote','--command',"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('webhooks','sheets_destination_keys')",'--json']));
    must(catalog.flatMap(v=>v.results||[]).length===0,'sheets_setup');
  }
  must(Number.isSafeInteger(version)&&version>0,'sheets_setup');
  const secretFile=inside(root,'.secrets/production.json',true);noSymlinkParents(secretFile);const env=read(secretFile);
  if(!env.GOOGLE_SHEETS_SIGNING_SECRET){env.GOOGLE_SHEETS_SIGNING_SECRET=randomBytes(32).toString('hex');atomic(secretFile,env);}
  must(/^[a-f0-9]{64}$/.test(env.GOOGLE_SHEETS_SIGNING_SECRET));
  const key=createHmac('sha256',env.GOOGLE_SHEETS_SIGNING_SECRET).update(`sheets:v1:${version}:${url}`).digest('hex');
  const properties={CRM_CONNECTION_SECRET:key,CRM_KEY_VERSION:String(version),CRM_SPREADSHEET_ID:input.intent.sheet_id};
  const output=path.join(privateHome(root),'google-script-properties-'+hex(url).slice(0,16)+'.json');
  noSymlinkParents(output);atomic(output,properties);chmodSync(output,0o600);
  const previous=privateJson(root,'sheets.json');
  if(!previous||previous.url!==url||previous.version!==version||previous.sheet_id!==input.intent.sheet_id){
    privateJson(root,'sheets.json',{url,version,sheet_id:input.intent.sheet_id,private_handoff:output,probe_lead:randomUUID()});
    throw new NeedsAction('sheets_setup');
  }
  const check=await signedProbe(root,url,version,previous.probe_lead);
  must(!check.lead_present&&!check.erased,'sheets_probe');
  return result({protocol:2,key_version:version,read_only_signed_probe:'passed',lead_data_sent:false});
}
async function edgeProtection(root,input,write=false){
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token){must(input.attestations?.edge?.value===true,'edge');return {status:'owner-confirmed',automatically_verified:false};}
  const call=async(endpoint,method='GET',body)=>{
    const r=await fetch('https://api.cloudflare.com/client/v4'+endpoint,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    let value;try{value=await r.json();}catch{throw new NeedsAction('edge');}return {ok:r.ok&&value.success===true,status:r.status,value:value.result};
  };
  const zones=await call('/zones?account.id='+encodeURIComponent(input.intent.account_id)+'&per_page=50');
  if(!zones.ok){must(input.attestations?.edge?.value===true,'edge');return {status:'owner-confirmed',automatically_verified:false};}
  const matches=zones.value.filter(z=>z.status==='active'&&(input.intent.domain===z.name||input.intent.domain.endsWith('.'+z.name))).sort((a,b)=>b.name.length-a.name.length);
  must(matches.length>0,'destination');const zone=matches[0];must(/^[a-f0-9]{32}$/.test(zone.id),'edge');
  const endpoint='/zones/'+zone.id+'/rulesets/phases/http_ratelimit/entrypoint';
  let ruleset=await call(endpoint);const rule=rateRule();
  const correct=r=>r.ref===rule.ref&&r.enabled!==false&&r.action===rule.action&&r.expression===rule.expression&&
    JSON.stringify(r.ratelimit?.characteristics)===JSON.stringify(rule.ratelimit.characteristics)&&
    r.ratelimit?.period===10&&r.ratelimit?.requests_per_period===10&&r.ratelimit?.mitigation_timeout===10;
  if(ruleset.ok&&ruleset.value.rules?.some(correct))return {status:'api-verified',automatically_verified:true,zone_id:zone.id};
  if(!write)return {status:'configuration-needed',automatically_verified:false,zone_id:zone.id};
  if(ruleset.ok){
    // Never overwrite another rule or silently consume an unavailable plan slot.
    if(ruleset.value.rules?.length){must(input.attestations?.edge?.value===true,'edge');return {status:'owner-confirmed',automatically_verified:false};}
    must(/^[a-f0-9]{32}$/.test(ruleset.value.id),'edge');
    const added=await call('/zones/'+zone.id+'/rulesets/'+ruleset.value.id+'/rules','POST',rule);must(added.ok,'edge');
  }else if(ruleset.status===404){
    const added=await call('/zones/'+zone.id+'/rulesets','POST',{name:'Landing Pages form protection',kind:'zone',phase:'http_ratelimit',rules:[rule]});must(added.ok,'edge');
  }else throw new NeedsAction('edge');
  ruleset=await call(endpoint);must(ruleset.ok&&ruleset.value.rules?.some(correct),'edge');
  return {status:'api-verified',automatically_verified:true,zone_id:zone.id};
}
async function withAdmin(root,input,identity,fn){
  const config=read(path.join(root,'wrangler.jsonc')),target=targetMatches(config,input.intent),url='https://'+input.intent.domain;
  must(identity&&identity.account_id===target.account_id&&identity.database_id===target.database_id&&identity.worker===target.worker);
  const login=access(root,{});await runtimeIdentity(url,identity,fetch,login.production?.SESSION_SECRET);
  let cookie;
  const req=async(route,method='GET',body)=>{
    must(route.startsWith('/api/')&&!route.includes('://')&&!route.startsWith('//'));
    const headers={Origin:url,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})};
    if(method!=='GET'&&route.startsWith('/api/admin/'))headers['X-CRM-Confirm-Password-UTF8']=Buffer.from(login.auth.password,'utf8').toString('base64');
    const response=await fetch(url+route,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(15000)});
    return response;
  };
  try{
    const authenticated=await req('/api/auth/login','POST',login.auth);must(authenticated.ok);cookie=authenticated.headers.get('set-cookie')?.split(';')[0];must(cookie);
    const session=await req('/api/auth/session');must(session.ok&&(await session.json()).authenticated===true);
    return await fn(req);
  } finally {if(cookie)await req('/api/auth/logout','POST',{}).catch(()=>{});}
}
async function existingReview(root,input,target){
  const observed=await cloudIdentity(root,target);if(!observed)return {first_deployment:true,existing_users:0,outbound_connections:0};
  const info=await withAdmin(root,input,observed,async req=>{
    const users=await req('/api/admin/users'),hooks=await req('/api/admin/webhooks'),security=await req('/api/admin/security/overview');
    must(users.ok&&hooks.ok&&security.ok);
    const u=await users.json(),h=await hooks.json(),s=await security.json();
    const rows=u.users||[];return {first_deployment:false,existing_users:rows.length,outbound_connections:h.webhooks?.length||0,
      roles:rows.reduce((r,x)=>{r[x.role]=(r[x.role]||0)+1;return r;},{}),active_sessions:s.sessions?.reduce((sum,x)=>sum+x.active_sessions,0)||0};
  });
  // Existing trust relationships need explicit owner review, not destructive “cleanup”.
  if((info.existing_users>1||info.outbound_connections>0)&&!input.attestations?.existing_access?.value){
    privateJson(root,'existing-access-summary.json',info);throw new NeedsAction('existing_access');
  }
  return info;
}
async function connectBeforeVerify(root,input,identity){
  if(!input.intent.sheets)return;
  const state=privateJson(root,'sheets.json');must(state&&state.url===input.intent.sheets_url,'sheets_setup');
  await withAdmin(root,input,identity,async req=>{
    const res=await req('/api/admin/webhooks');must(res.ok,'sheets_setup');const value=await res.json();
    const matching=(value.webhooks||[]).filter(w=>w.url===state.url);must(matching.length<=1,'sheets_setup');
    if(matching.length){must(matching[0].enabled===true&&matching[0].sheets_key_version===state.version,'sheets_setup');return;}
    const made=await req('/api/admin/webhooks','POST',{name:'Google Sheets',url:state.url,enabled:true});must(made.ok,'sheets_setup');
  });
}
function release(root){
  const pointer=read(inside(root,'build/current-release.json'));must(UUID.test(pointer.id),'recovery');
  const base=inside(root,'build/releases/'+pointer.id),state=read(path.join(base,'state.json'));
  must(state.id===pointer.id,'recovery');return {base,state,packageRoot:path.join(base,'package')};
}
async function sealedProof(root){const {state}=release(root);return jsonResult(await python(root,['scripts/release_state.py','verified','.', '--id',state.id]),'verification');}

// Poll existing work only: no new lead, destination or erasure is created here.
// Injectable clock is for isolated unit tests; browser requests cannot supply it.
export async function pollExisting(observe, accepted, {attempts=70, intervalMs=5000, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  if(!Number.isInteger(attempts)||attempts<1||attempts>70||!Number.isInteger(intervalMs)||intervalMs<0||intervalMs>5000)throw new Error('Invalid polling budget');
  for(let index=0;index<attempts;index++) {
    const value=await observe();
    if(accepted(value))return value;
    if(index+1<attempts)await sleep(intervalMs);
  }
  throw new NeedsAction('cleanup');
}

export async function beforeSyntheticCleanup(root,input,{lead_id,release_id}){
  if(!input.intent.sheets)return;
  must(UUID.test(lead_id)&&UUID.test(release_id),'cleanup');
  const sheets=privateJson(root,'sheets.json');must(sheets?.url===input.intent.sheets_url,'sheets_probe');
  await pollExisting(()=>signedProbe(root,sheets.url,sheets.version,lead_id),
    probe=>probe.lead_present&&!probe.erased,{attempts:12,intervalMs:2000});
  privateJson(root,'sheets-created-'+release_id+'.json',{release_id,lead_id,url:sheets.url,key_version:sheets.version,verified_at:new Date().toISOString(),present:true});
}

async function cleanup(root,input){
  requireConsent(input,'publish');await sealedProof(root);
  const {base,state,packageRoot}=release(root);must(state.phase==='verified','verification');
  const out=path.join(packageRoot,'build/live',String(state.attempt).padStart(3,'0'));
  const attempt=read(path.join(out,'attempt.json')),report=read(path.join(out,'result.json'));
  const lead=report.synthetic_impact?.lead_id||report.observations?.lead_id;
  must(UUID.test(lead||'')&&report.fully_verified===true&&attempt.binding?.cleanup_test_lead===true,'cleanup');
  const stateFile='cleanup-'+state.id+'.json';let saved=privateJson(root,stateFile);
  if(saved)must(saved.lead_id===lead&&saved.release_id===state.id,'cleanup');
  if(!saved){saved={release_id:state.id,lead_id:lead,operation_id:randomUUID(),stage:'prepared'};privateJson(root,stateFile,saved);}
  const sheets= input.intent.sheets?privateJson(root,'sheets.json'):null;
  // Prove the configured real managed destination received this exact form journey,
  // before erasing it. Retain proof across interruptions and bounded retries.
  if(sheets&&!saved.sheet_created){
    const retained=privateJson(root,'sheets-created-'+state.id+'.json');
    if(!retained||retained.release_id!==state.id||retained.lead_id!==lead||retained.url!==sheets.url||retained.key_version!==sheets.version||retained.present!==true){const probe=await signedProbe(root,sheets.url,sheets.version,lead);must(probe.lead_present&&!probe.erased,'sheets_probe');}
    saved.sheet_created=true;privateJson(root,stateFile,saved);
  }
  const proof=await withAdmin(root,input,state.identity,async req=>{
    let status=await req('/api/admin/data/erasures/'+saved.operation_id);
    for(let attempt=0;status.status===404&&attempt<2;attempt++){
      const preview=await req('/api/admin/data/erasures/preview','POST',{lead_ids:[lead]});must(preview.ok,'cleanup');
      const p=await preview.json();must(p.enquiries?.length===1&&p.enquiries[0].id===lead&&typeof p.token==='string','cleanup');
      saved.preview=p.token;saved.started=true;privateJson(root,stateFile,saved);
      // Persist the exact operation and signed preview before dispatch. Reconcile a
      // lost POST using GET; never create a second operation or another contact.
      try {status=await req('/api/admin/data/erasures','POST',{operation_id:saved.operation_id,token:saved.preview});}
      catch {status=await req('/api/admin/data/erasures/'+saved.operation_id);continue;}
      if(!status.ok)status=await req('/api/admin/data/erasures/'+saved.operation_id);
    }
    must(status.ok,'cleanup');let value=await status.json();
    const complete=v=>v.crm_complete===true&&v.all_managed_copies_erased===true;
    if(!complete(value))value=await pollExisting(async()=>{
      // Continue only this saved erasure. Once the CRM part is complete, wait for
      // the existing scheduled downstream outbox instead of cancelling it or
      // treating local deletion as success. Bounded polling survives cron delay.
      if(value.crm_complete!==true) {
        const continued=await req('/api/admin/data/erasures/'+saved.operation_id+'/continue','POST',{});
        must(continued.ok,'cleanup');
      }
      const check=await req('/api/admin/data/erasures/'+saved.operation_id);must(check.ok,'cleanup');
      value=await check.json();return value;
    },complete);
    const gone=await req('/api/admin/leads/'+lead);must(gone.status===404,'cleanup');return value;
  });
  if(sheets){const absent=await signedProbe(root,sheets.url,sheets.version,lead);must(!absent.lead_present&&absent.erased,'cleanup');}
  saved.complete=true;saved.completed_at=new Date().toISOString();delete saved.preview;privateJson(root,stateFile,saved);
  return result({release_id:state.id,operation_id:saved.operation_id,synthetic_contact_erased:true,
    managed_copies_erased:proof.all_managed_copies_erased,sheets_row_lifecycle:sheets?'verified-present-then-erased':'not-enabled'});
}
export async function runOperation(operation,input,{root=ROOT}={}){
  must(ACTIONS.has(operation));validateInput(input);root=realpathSync(root);
  const funnel=read(path.join(root,'funnel.json'));must(funnel.development_fixture!==true);
  privateDir(root);
  // This bridge only acts on the currently inspected working source.
  must(currentSourceFingerprint(root)===input.source,'approval_stale');
  if(operation==='open_handoff'){
    must(['owner','sheets'].includes(input.handoff));
    const ref=input.handoff==='owner'?read(inside(root,'.secrets/current-admin-access.json',true)):null;
    const file=ref?(ref.password_file||ref.credentials_file):privateJson(root,'sheets.json')?.private_handoff;
    must(typeof file==='string'&&existsSync(file));noSymlinkParents(file);
    const base=privateHome(root);
    if(input.handoff==='owner'){const target=targetMatches(read(path.join(root,'wrangler.jsonc')),input.intent);const login=access(root,{});must((login.reference.password_file||login.reference.credentials_file)===file);const relative=path.relative(root,realpathSync(file));must(relative.startsWith('..'+path.sep)||path.isAbsolute(relative));must(ref.target?.account_id===target.account_id&&ref.target?.worker===target.worker&&ref.target?.database_id===target.database_id);}
    else must(path.dirname(file)===base);
    const opener=process.platform==='darwin'?'open':process.platform==='linux'?'xdg-open':null;must(opener,'prerequisites');
    success(await command(root,opener,[file],{timeout:30000}));return result({opened_locally:true,credential_returned:false});
  }
  if(operation==='prerequisites'){
    const [major,minor]=process.versions.node.split('.').map(Number);must(major>22||(major===22&&minor>=19),'prerequisites');
    must(existsSync(path.join(root,'node_modules/wrangler/package.json'))&&read(path.join(root,'node_modules/wrangler/package.json')).version==='4.115.0','prerequisites');
    must(existsSync(path.join(root,'test-fixture.json'))&&funnel.quality?.complete_workflow===true,'quality');
    success(await python(root,['scripts/workflow.py','check-copy','.'],{localOnly:true}),'quality');success(await python(root,['scripts/workflow.py','check-build','.'],{localOnly:true}),'quality');
    if(funnel.requested_hosts?.public||funnel.requested_hosts?.crm||funnel.requested_hosts?.pages_gateway)throw new NeedsAction('split_host');
    return result({copy_and_build:'checked',credential_access:false});
  }
  if(operation==='login'){const r=await wrangler(root,['login'],{timeout:300000});must(r.code===0,'login');return result({login:'completed'});}
  if(operation==='cloudflare'){
    const who=await wrangler(root,['whoami']);must(who.code===0,'login');const accounts=accountsFromWhoami(who.stdout);must(accounts.length>0,'login');
    const wanted=input.intent.account_id||read(path.join(root,'wrangler.jsonc')).account_id;
    if(wanted&&accounts.includes(wanted))return {...result({account_checked:true}),account_id:wanted};
    if(accounts.length===1&&!wanted)return {...result({account_checked:true}),account_id:accounts[0]};
    throw new NeedsAction('account',accounts);
  }
  if(operation==='configure'){
    const consent=requireConsent(input,'prepare');must(/^[a-f0-9]{32}$/.test(input.intent.account_id||''));
    const config=read(path.join(root,'wrangler.jsonc'));const db=config.d1_databases?.[0];must(db);
    if(input.intent.environment==='staging'&&db.database_id&&db.database_id!=='00000000-0000-0000-0000-000000000000'){const prior=privateJson(root,'environment-binding.json');must(prior?.environment==='staging'&&prior.account_id===input.intent.account_id&&prior.worker===input.intent.site&&prior.database_id===db.database_id,'staging_isolation');}
    if(!db.database_id||db.database_id==='00000000-0000-0000-0000-000000000000'){
      const databases=jsonResult(await wrangler(root,['d1','list','--json'],{env:{CLOUDFLARE_ACCOUNT_ID:input.intent.account_id}}));
      const same=databases.filter(x=>x.name===input.intent.site+'-crm');must(same.length<=1,'database_conflict');
      if(same[0]&&input.intent.environment==='staging')throw new NeedsAction('staging_isolation');
      if(same[0]&&input.intent.existing_database_id!==same[0].uuid)throw new NeedsAction('database_conflict',[same[0].uuid]);
    }
    const authorization=path.join(privateDir(root),'prepare-consent.txt');writeFileSync(authorization,consent.message,{mode:0o600});
    const args=['scripts/setup.mjs','--cloudflare','--site',input.intent.site,'--account-id',input.intent.account_id,'--domain',input.intent.domain,'--admin-username',input.intent.owner,'--authorization-file',authorization,'--authorization-message-id',consent.message_id];
    if(input.intent.existing_database_id)args.push('--database-id',input.intent.existing_database_id);
    success(await command(root,process.execPath,args,{env:{CLOUDFLARE_ACCOUNT_ID:input.intent.account_id}}));
    success(await command(root,process.execPath,['scripts/sync-config.mjs']));
    const target=targetMatches(read(path.join(root,'wrangler.jsonc')),input.intent);ownerHandoff(root,target);
    privateJson(root,'environment-binding.json',{environment:input.intent.environment,account_id:target.account_id,worker:target.worker,database_id:target.database_id});
    return result({database_bound:true,owner_password:'private-external-handoff',preview_aliases:'disabled',target});
  }
  if(operation==='quality'){
    // No self-authored evidence or re-labelled old reports. Missing reviews return
    // to the native coding assistant; only executed checks may satisfy the gates.
    success(await python(root,['scripts/check_gates.py','check','.','--mode','handoff'],{localOnly:true}),'quality');
    success(await command(root,process.execPath,['scripts/preflight.mjs'],{localOnly:true}),'quality');
    success(await command(root,process.platform==='win32'?'npm.cmd':'npm',['audit','--audit-level=high'],{timeout:180000,localOnly:true}),'quality');
    await applicationRegressions(root,(exe,args,options)=>command(root,exe,args,{...options,localOnly:true}));
    success(await wrangler(root,['deploy','--dry-run'],{timeout:180000,localOnly:true}),'quality');
    return result({handoff_gates:'passed',full_application_regressions:'passed-no-skips',dependency_audit:'passed-high-severity-gate',worker_bundle:'passed'});
  }
  if(operation==='sheets')return input.intent.sheets?await configuredSheets(root,input):result({status:'not-enabled'});
  const target=targetMatches(read(path.join(root,'wrangler.jsonc')),input.intent);
  if(operation==='preflight'){
    const review=await existingReview(root,input,target);const edge=await edgeProtection(root,input,false);
    return result({target,access:review,edge});
  }
  if(operation==='protect'){
    requireConsent(input,'publish');
    const backupFile='backup-'+input.run_id+'.json';let backup=privateJson(root,backupFile);
    if(backup)must(JSON.stringify(backup.target)===JSON.stringify(target),'recovery');
    else {
      const observed=await cloudIdentity(root,target);
      const info=jsonResult(await wrangler(root,['d1','time-travel','info','DB','--json']));
      backup={target,bookmark:bookmarkFrom(info),recorded_at:new Date().toISOString(),prior_deployment:observed,source:input.source};
      privateJson(root,backupFile,backup);
    }
    const edge=await edgeProtection(root,input,true);
    if(input.intent.sheets){
      const env=read(inside(root,'.secrets/production.json',true));must(/^[a-f0-9]{64}$/.test(env.GOOGLE_SHEETS_SIGNING_SECRET||''),'sheets_setup');
      const observed=await cloudIdentity(root,target);
      if(observed){
        // Same value only; neither rotates nor prints a key. First deployment
        // installs all prepared secrets through the existing guarded publisher.
        success(await wrangler(root,['secret','put','GOOGLE_SHEETS_SIGNING_SECRET','--name',target.worker],{stdin:env.GOOGLE_SHEETS_SIGNING_SECRET+'\n'}),'sheets_setup');
      }
    }
    return result({recovery_point:'cloudflare-time-travel-bookmark-recorded',database_id:target.database_id,restoration_performed:false,edge});
  }
  if(operation==='publish'){
    const consent=requireConsent(input,'publish');
    const message=path.join(privateDir(root),'publish-consent.txt');writeFileSync(message,consent.message,{mode:0o600});
    success(await python(root,['scripts/workflow.py','authorize-publish','.','--message-file',message,'--message-id',consent.message_id,'--allow-test-lead']),'quality');
    privateJson(root,'publish-request.json',input);
    const r=await python(root,['scripts/release_state.py','run','.', '--',process.execPath,'scripts/ship-release.mjs'],{timeout:3600000});
    if(r.code!==0)throw new NeedsAction('recovery');await sealedProof(root);
    const {state}=release(root);return result({release_id:state.id,status:'verified',url:state.identity.url,live_journey:'verified'});
  }
  if(operation==='cleanup')return await cleanup(root,input);
  if(operation==='verify'){
    const proof=await sealedProof(root);const {state}=release(root),done=privateJson(root,'cleanup-'+state.id+'.json');
    const recovery=privateJson(root,'pre-migration-'+state.id+'.json');
    must(recovery?.source===state.source_fingerprint&&recovery?.target?.database_id===target.database_id&&recovery?.release_id===state.id,'verification');
    bookmarkFrom(recovery);
    must(done?.complete===true,'cleanup');const observed=await cloudIdentity(root,target);
    must(observed&&observed.version_id===state.identity.version_id&&observed.release_id===state.id&&observed.source_fingerprint===state.source_fingerprint,'verification');
    const login=access(root,{});await runtimeIdentity('https://'+input.intent.domain,state.identity,fetch,login.production?.SESSION_SECRET);
    return result({release_id:state.id,version_id:state.identity.version_id,url:state.identity.url,source_fingerprint:state.source_fingerprint,live_proof:'sealed-and-rechecked',cleanup:'complete'});
  }
  throw new NeedsAction('destination');
}
export async function publishSaved(root=ROOT){
  const input=privateJson(root,'publish-request.json');validateInput(input);requireConsent(input,'publish');
  must(currentSourceFingerprint(root)===input.source,'approval_stale');
  const args={url:'https://'+input.intent.domain};
  const owned=privateJson(root,'owned-release-'+input.run_id+'.json');
  if(existsSync(path.join(root,'build/current-release.json'))){
    const current=release(root);
    if(owned){must(owned.release_id===current.state.id&&owned.source===input.source,'recovery');args.resume=true;}
    else {must(input.previous_release===current.state.id&&current.state.phase==='verified','recovery');await sealedProof(root);args['new-release']=true;}
  }else must(!owned&&!input.previous_release,'recovery');
  return publish(root,args,{
    onFrozen:async ({release_id,source_fingerprint,target})=>{
      privateJson(root,'owned-release-'+input.run_id+'.json',{release_id,source:source_fingerprint,target,run_id:input.run_id});
    },
    beforeMigrations:async ({target,observed,release_id,source_fingerprint})=>{
      must(source_fingerprint===input.source,'approval_stale');
      const info=jsonResult(await wrangler(root,['d1','time-travel','info','DB','--json']));
      const bookmark=bookmarkFrom(info);
      privateJson(root,'pre-migration-'+release_id+'.json',{target,bookmark,recorded_at:new Date().toISOString(),prior_deployment:observed,release_id,source:source_fingerprint,restore_authorized:false});
    },
    beforeVerify:identity=>connectBeforeVerify(root,input,identity),
    beforeSyntheticCleanup:observation=>beforeSyntheticCleanup(root,input,observation)
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    let text='';for await(const part of process.stdin){text+=part;if(text.length>65536)throw new NeedsAction('destination');}
    const value=await runOperation(process.argv[2],JSON.parse(text));process.stdout.write(JSON.stringify(value)+'\n');
  }catch(error){
    const code=error instanceof NeedsAction?error.code:'recovery';
    const uncertain=['configure','protect','publish','cleanup'].includes(process.argv[2])&&['recovery','destination','cleanup','verification'].includes(code);
    process.stdout.write(JSON.stringify({status:uncertain?'uncertain':'action',code,...(error instanceof NeedsAction&&error.choices.length?{choices:error.choices}:{})})+'\n');process.exitCode=1;
  }
}
