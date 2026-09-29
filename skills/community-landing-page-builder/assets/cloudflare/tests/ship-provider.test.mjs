/** Offline provider contracts. No requests to a cloud account or real sheet. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
import {accountsFromWhoami,rateRule,bookmarkFrom,validateInput,localEnvironment,pollExisting} from '../scripts/ship-provider.mjs';
import {signedSheetsPayload,connectionKey} from '../src/sheets-protocol.js';
import {runtimeIdentity} from '../scripts/release-tools.mjs';
const base={run_id:randomUUID(),source:'a'.repeat(64),intent:{domain:'landing.acme.com',owner:'owner@acme.com',site:'acme-site',sheets:false,environment:'production'}};
test('account parsing accepts only concrete returned IDs and deduplicates',()=>{
 const a='a'.repeat(32),b='b'.repeat(32);assert.deepEqual(accountsFromWhoami(`Account name | ${a}\nSecond | ${b}\n${a}`),[a,b]);assert.deepEqual(accountsFromWhoami('not authenticated'),[]);
});
test('Free-plan edge rule uses supported path-only counting and short windows',()=>{
 const r=rateRule();assert.equal(r.expression,'(http.request.uri.path eq "/api/leads")');assert.doesNotMatch(r.expression,/request.method|host/);
 assert.deepEqual(r.ratelimit.characteristics,['cf.colo.id','ip.src']);assert.equal(r.ratelimit.period,10);assert.equal(r.ratelimit.mitigation_timeout,10);assert.equal(r.action,'block');
});
test('recovery bookmark must be a real structured provider value',()=>{
 assert.equal(bookmarkFrom({bookmark:'00000001-00000002-00000003-1234'}),'00000001-00000002-00000003-1234');
 assert.equal(bookmarkFrom({result:{bookmark:'00000001-00000002'}}),'00000001-00000002');
 for(const x of [{},null,{bookmark:''},{bookmark:'<script>'},{bookmark:'pretend backup passed'}])assert.throws(()=>bookmarkFrom(x));
});
test('untrusted intent cannot become arbitrary shell arguments or credential URLs',()=>{
 assert.equal(validateInput(base),base);
 for(const patch of [{domain:'https://acme.com'},{domain:'acme.com/path'},{site:'x;curl bad'},{owner:'bad\nheader:x'},{sheets:'false'},{account_id:'../wrong'},{sheets_url:'https://script.google.com/macros/s/x/exec?token=secret'}])assert.throws(()=>validateInput({...base,intent:{...base.intent,...patch}}));
});
test('private runtime proof is sent as headers, not returned or placed in URLs',async()=>{
 const id={version_id:randomUUID(),release_id:randomUUID(),source_fingerprint:'b'.repeat(64)};const secret='c'.repeat(64);
 let seen;const out=await runtimeIdentity('https://landing.acme.com',id,async(url,options)=>{seen={url,options};return Response.json({ok:true,database:'connected',release:id});},secret);
 assert.equal(seen.url,'https://landing.acme.com/api/health');assert.equal(seen.options.redirect,'error');
 assert.equal(seen.options.headers['X-CRM-Release-Proof'],createHmac('sha256',secret).update('release-probe:https://landing.acme.com:'+seen.options.headers['X-CRM-Release-Time']).digest('hex'));
 assert.equal(JSON.stringify(out).includes(secret),false);assert.equal(JSON.stringify(out).includes(seen.options.headers['X-CRM-Release-Proof']),false);
});
test('live verifier and publisher explicitly pass the private proof without making health public',()=>{
 const live=readFileSync(new URL('../scripts/live-verify.mjs',import.meta.url),'utf8');const driver=readFileSync(new URL('../scripts/publish-driver.mjs',import.meta.url),'utf8');
 assert.equal((live.match(/runtimeIdentity\(target.url.origin, identity, runtime.fetch \|\| fetch, runtime.releaseSecret\)/g)||[]).length,2);
 assert.match(driver,/releaseSecret:login\?\.production\?\.SESSION_SECRET/);
 assert.ok(driver.indexOf('if(runtime.beforeMigrations)')<driver.indexOf("persist('migrations_started')"));
});
function appsScript(properties,tabs){
 let opened=0,writes=0,locked=false;
 class Sheet{
  constructor(rows=[]){this.rows=rows;}
  getLastRow(){return this.rows.length;}getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
  appendRow(r){writes++;this.rows.push([...r]);}deleteRow(n){writes++;this.rows.splice(n-1,1);}
  getRange(row,col,height,width){const sheet=this;return {getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sheet.rows[row-1+i]?.[col-1+j]??'')),
   setValues:values=>{writes++;values.forEach((r,i)=>{sheet.rows[row-1+i]||=[];r.forEach((v,j)=>sheet.rows[row-1+i][col-1+j]=v);});},
   createTextFinder(value){return {matchEntireCell(){return this;},useRegularExpression(){return this;},findAll(){const found=[];for(let i=row-1;i<row-1+height;i++)if(sheet.rows[i]?.[col-1]===value)found.push({getRow:()=>i+1});return found;},findNext(){return this.findAll()[0]||null;}};}};}
 }
 const ctx=vm.createContext({Date,Number,JSON,Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(text,secret)=>[...createHmac('sha256',secret).update(text).digest()]},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]})},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType(){return JSON.parse(text);}})},
  LockService:{getScriptLock:()=>({tryLock(){locked=true;return true;},releaseLock(){locked=false;}})},
  SpreadsheetApp:{openById:id=>{assert.equal(id,properties.CRM_SPREADSHEET_ID);opened++;return {getSheetByName:n=>tabs.get(n)||null,insertSheet:n=>{writes++;const s=new Sheet();tabs.set(n,s);return s;}};},flush(){}}});
 vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),ctx);
 return {post:body=>ctx.doPost({postData:{contents:typeof body==='string'?body:JSON.stringify(body)}}),stats:()=>({opened,writes,locked}),Sheet};
}
const url='https://script.google.com/macros/s/SYNTHETIC_ONLY/exec';const env={GOOGLE_SHEETS_SIGNING_SECRET:'d'.repeat(64)};
async function harness(){return appsScript({CRM_CONNECTION_SECRET:await connectionKey(env,url),CRM_KEY_VERSION:'1',CRM_SPREADSHEET_ID:'synthetic-only-sheet'},new Map());}
async function signed(event,extra={}){return signedSheetsPayload(env,url,{event,event_id:randomUUID(),...extra});}
test('signed probe works on an empty sheet without creating any rows or tabs',async()=>{
 const h=await harness(),id=randomUUID(),response=h.post(await signed('connection.probe',{lead_id:id}));assert.equal(response.ok,true);assert.equal(response.protocol,2);assert.equal(response.lead_present,false);assert.equal(response.erased,false);
 assert.deepEqual(h.stats(),{opened:1,writes:0,locked:false});
});
test('forged, stale and wrong-version probes never open the spreadsheet',async()=>{
 const h=await harness(),valid=JSON.parse(await signed('connection.probe',{lead_id:randomUUID()}));
 for(const body of [{...valid,signature:'0'.repeat(64)},{...valid,timestamp:valid.timestamp-301},{...valid,key_version:2},{event:'connection.probe',lead_id:randomUUID()}])assert.equal(h.post(body).ok,false);
 assert.equal(h.stats().opened,0);assert.equal(h.stats().writes,0);
});
test('signed probe observes the actual create/erase lifecycle and cannot resurrect erased leads',async()=>{
 const h=await harness(),id=randomUUID();assert.equal(h.post(await signed('lead.created',{lead:{id,name:'Synthetic Test',email:'test@example.invalid'}})).ok,true);
 let value=h.post(await signed('connection.probe',{lead_id:id}));assert.equal(value.lead_present,true);assert.equal(value.erased,false);
 const writes=h.stats().writes;h.post(await signed('connection.probe',{lead_id:id}));assert.equal(h.stats().writes,writes);
 assert.equal(h.post(await signed('lead.erased',{lead_id:id})).ok,true);
 value=h.post(await signed('connection.probe',{lead_id:id}));assert.equal(value.lead_present,false);assert.equal(value.erased,true);
 h.post(await signed('lead.created',{lead:{id,name:'Late delivery'}}));value=h.post(await signed('connection.probe',{lead_id:id}));assert.equal(value.lead_present,false);assert.equal(value.erased,true);
 assert.deepEqual(Object.keys(value).sort(),['erased','event_id','key_version','lead_present','ok','protocol']);
});

test('local quality processes exclude production credentials from their environment',()=>{
 const actual=localEnvironment({PATH:'/bin',HOME:'/operator',FUNNEL_PYTHON:'/python',CLOUDFLARE_API_TOKEN:'s',ADMIN_PASSWORD:'s',AWS_SECRET_ACCESS_KEY:'s',GH_TOKEN:'s',GOOGLE_APPLICATION_CREDENTIALS:'s',SAFE:'yes'});
 assert.deepEqual(actual,{PATH:'/bin',HOME:'/operator',FUNNEL_PYTHON:'/python',SAFE:'yes'});
});
test('Sheets delivery is observed before the existing verifier removes its test contact',()=>{
 const live=readFileSync(new URL('../scripts/live-verify.mjs',import.meta.url),'utf8');
 const hook=live.indexOf('runtime.beforeSyntheticCleanup({lead_id:createdId');
 const cleanup=live.indexOf('attempt.cleanup_started=true;saveAttempt();',hook);
 const deletion=live.indexOf("await adminRequest('/api/admin/leads/' + createdId, 'DELETE')",hook);
 assert.ok(hook>0&&cleanup>hook&&deletion>cleanup);
 const driver=readFileSync(new URL('../scripts/publish-driver.mjs',import.meta.url),'utf8');
 assert.match(driver,/beforeSyntheticCleanup:runtime.beforeSyntheticCleanup/);
});
test('a pending erasure uses one operation and authoritative lookup before refreshing a preview',()=>{
 const text=readFileSync(new URL('../scripts/ship-provider.mjs',import.meta.url),'utf8');
 assert.match(text,/status.status===404&&attempt<2/);
 assert.match(text,/operation_id:saved.operation_id,token:saved.preview/);
 assert.doesNotMatch(text,/operation_id:randomUUID\(\),token:/);
});
test('the provider refuses unowned release pointers instead of starting another upload',()=>{
 const text=readFileSync(new URL('../scripts/ship-provider.mjs',import.meta.url),'utf8');
 assert.match(text,/owned.release_id===current.state.id&&owned.source===input.source/);
 assert.match(text,/input.previous_release===current.state.id&&current.state.phase==='verified'/);
 assert.match(text,/await sealedProof\(root\);args\['new-release'\]=true/);
});

test('pending downstream work is polled until both managed and CRM deletion complete',async()=>{
 let calls=0;const delays=[];
 const value=await pollExisting(async()=>({crm_complete:true,all_managed_copies_erased:++calls===3}),v=>v.crm_complete&&v.all_managed_copies_erased,{attempts:4,intervalMs:5,sleep:async ms=>delays.push(ms)});
 assert.equal(value.all_managed_copies_erased,true);assert.equal(calls,3);assert.deepEqual(delays,[5,5]);
});
test('exhausted polling pauses rather than inventing delivery or deletion success',async()=>{
 let calls=0,waits=0;
 await assert.rejects(pollExisting(async()=>{calls++;return false;},v=>v,{attempts:3,intervalMs:0,sleep:async()=>waits++}),e=>e.code==='cleanup');
 assert.equal(calls,3);assert.equal(waits,2);
});
test('polling returns immediately on proof and never masks an actual provider failure',async()=>{
 const never=async()=>{throw new Error('must not wait');};
 assert.equal(await pollExisting(async()=>true,v=>v,{sleep:never}),true);
 await assert.rejects(pollExisting(async()=>{throw new Error('provider rejected');},v=>v,{sleep:never}),/provider rejected/);
 await assert.rejects(pollExisting(async()=>false,v=>v,{attempts:0}),/Invalid polling budget/);
});
