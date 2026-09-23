import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {pbkdf2Sync,createHmac} from 'node:crypto';
import vm from 'node:vm';
import {normalizePath,sessionCookie,requireStepUp,rateLimit,publicRateLimit,hmac} from '../src/security.js';
import {permissions,authorize} from '../src/team-accounts.js';
import {canonical,signedSheetsPayload,connectionKey,minimalSheetsLead,readAppsScriptAck,SheetsRejected,sheetsEndpoint} from '../src/sheets-protocol.js';
import {deliver,deleteWebhook,processSheetsErasures} from '../src/webhooks.js';
import {beginErasure,previewErasure,erasureStatus} from '../src/data-lifecycle.js';
import {reconcileErasureRecord} from '../scripts/erasure-backup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const password='security-test-only-owner-password-123';
const salt='112233445566778899aabbccddeeff00';
const encoded=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
const endpoint='https://script.google.com/macros/s/TEST_DEPLOYMENT_123/exec';
function database(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');
  for(const file of readdirSync(path.join(root,'migrations')).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(path.join(root,'migrations',file),'utf8'));
  const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values);},async first(){const row=db.prepare(sql).get(...args);return row?{...row}:null;},async all(){const rows=db.prepare(sql).all(...args);return {results:rows.map(r=>({...r})),success:true};},async run(){const rows=db.prepare(sql).all(...args);return {results:rows.map(r=>({...r})),success:true,meta:{changes:db.prepare('SELECT changes() AS n').get().n}};},_sql:sql,_args:args});
  return {raw:db,prepare,async batch(statements){db.exec('BEGIN');try{const rows=[];for(const statement of statements)rows.push(await statement.run());db.exec('COMMIT');return rows;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
let temp,worker,env,cookie,seq=0,pending=[],sent=[],originalFetch=globalThis.fetch;
async function call(resource,{method='GET',body,auth=true,proof=false,headers={}}={}){
  const request=new Request('https://site.test'+resource,{method,headers:{'CF-Connecting-IP':`203.0.113.${++seq}`,...(auth&&cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:'https://site.test','Content-Type':'application/json'}:{}),...(proof?{'X-CRM-Confirm-Password':password}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const response=await worker.fetch(request,env,{waitUntil(p){pending.push(p);}});return response;
}
async function login(){const response=await call('/api/auth/login',{auth:false,method:'POST',body:{username:'owner',password}});assert.equal(response.status,200,await response.clone().text());cookie=response.headers.get('set-cookie').split(';')[0];return cookie;}
async function drain(){await Promise.all(pending);pending=[];}
before(async()=>{
  temp=mkdtempSync(path.join(tmpdir(),'crm-security-test-'));cpSync(path.join(root,'src'),temp,{recursive:true});
  const source=readFileSync(path.join(temp,'worker.js'),'utf8').replace("from './site-config.json';","from './site-config.json' with {type:'json'};");writeFileSync(path.join(temp,'worker.js'),source);writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
  worker=(await import(pathToFileURL(path.join(temp,'worker.js')))).default;
  env={DB:database(),ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:encoded,SESSION_SECRET:'a'.repeat(64),GOOGLE_SHEETS_SIGNING_SECRET:'b'.repeat(64),CF_VERSION_METADATA:{id:'version-test'},FUNNEL_RELEASE_ID:'release-test',FUNNEL_SOURCE_FINGERPRINT:'f'.repeat(64),ASSETS:{fetch:async()=>new Response('asset')}};
  globalThis.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url);
    if(u.hostname==='cloudflare-dns.com')return Response.json({Status:0,Answer:u.searchParams.get('type')==='A'?[{type:1,data:'93.184.216.34'}]:[]});
    if(u.hostname==='script.google.com'){const body=JSON.parse(options.body);sent.push(body);return Response.json({ok:true,event_id:body.event_id});}
    return new Response('ok');};
});
after(async()=>{await drain();globalThis.fetch=originalFetch;env?.DB.raw.close();rmSync(temp,{recursive:true,force:true});});

test('all migrations including hardening apply with foreign keys enabled',()=>{assert.ok(env.DB.raw.prepare("SELECT name FROM sqlite_master WHERE name='sheets_delivery_receipts'").get());});
test('F8 normalized aliases are gated before static assets and double encoding is rejected',async()=>{
  for(const pathname of ['//admin/index.html','/%61dmin/index.html','/admin%2findex.html']){assert.equal(normalizePath(pathname),'/admin/index.html');assert.equal((await call(pathname,{auth:false})).status,302);}
  assert.throws(()=>normalizePath('/%2561dmin/index.html'));assert.throws(()=>normalizePath('/%00admin'));assert.equal((await call('/%2561dmin/',{auth:false})).status,400);
});
test('F9 __Host cookie has no Domain, always Secure remotely, and old cookie is refused',async()=>{
  await login();assert.match(cookie,/^__Host-crm_session=/);const full=sessionCookie(new Request('https://site.test'), 'a'.repeat(64));assert.match(full,/Secure/);assert.match(full,/Path=\//);assert.doesNotMatch(full,/Domain=/);
  assert.equal((await call('/api/admin/leads',{headers:{Cookie:cookie.replace('__Host-','')}})).status,401);
});
test('F10 public health omits release, authenticated health and signed publisher retain it',async()=>{
  const publicBody=await(await call('/api/health',{auth:false})).json();assert.equal(publicBody.release,undefined);
  assert.equal((await(await call('/api/health')).json()).release.release_id,'release-test');
  const timestamp=String(Math.floor(Date.now()/1000)),proof=await hmac(env.SESSION_SECRET,`release-probe:https://site.test:${timestamp}`);
  assert.equal((await(await call('/api/health',{auth:false,headers:{'X-CRM-Release-Time':timestamp,'X-CRM-Release-Proof':proof}})).json()).release.release_id,'release-test');
  assert.equal((await(await call('/api/health',{auth:false,headers:{'X-CRM-Release-Time':timestamp,'X-CRM-Release-Proof':'0'.repeat(64)}})).json()).release,undefined);
});
test('F2 manager retains ordinary editing but no exports, connections, data or user management',()=>{
  const manager={id:'m',role:'manager'};assert.equal(permissions(manager).edit_leads,true);assert.equal(permissions(manager).export_leads,false);
  for(const route of ['/api/admin/leads/export.csv','/api/admin/webhooks','/api/admin/data/retention','/api/admin/users','/api/admin/security/overview'])assert.throws(()=>authorize(manager,route,'GET'),e=>e.status===403);
  assert.doesNotThrow(()=>authorize(manager,'/api/admin/leads/example','PATCH'));
});
test('F11 sensitive actions require current password, not just a valid cookie',async()=>{
  let response=await call('/api/admin/leads/export.csv');assert.equal(response.status,403);assert.equal((await response.json()).code,'reauthentication_required');
  assert.equal((await call('/api/admin/leads/export.csv',{headers:{'X-CRM-Confirm-Password':'wrong'}})).status,403);
  assert.equal((await call('/api/admin/leads/export.csv',{proof:true})).status,200);
  // Successful proofs do not lock the user out after five legitimate actions.
  for(let i=0;i<7;i++)assert.equal((await call('/api/admin/leads/export.csv',{proof:true})).status,200);
});
test('F0/F1 manual privileged resets remain blocked even with current owner password',async()=>{
  env.DB.raw.prepare("UPDATE crm_owner_profile SET email='owner@example.invalid',email_verified_at=? WHERE id=1").run(new Date().toISOString());
  assert.equal((await call('/api/admin/users/owner/reset',{method:'POST',body:{},proof:true})).status,403);
  const id=crypto.randomUUID();env.DB.raw.prepare("INSERT INTO crm_users(id,username,email,role,status,password_hash,email_verified_at,created_at,updated_at) VALUES(?,?,?,'admin','active',?,?,?,?)").run(id,'other-admin','other@example.invalid',encoded,new Date().toISOString(),'2026-09-22','2026-09-22');
  assert.equal((await call(`/api/admin/users/${id}/reset`,{method:'POST',body:{},proof:true})).status,403);
  const ownerCookie=cookie;const logged=await call('/api/auth/login',{method:'POST',auth:false,body:{username:'other-admin',password}});cookie=logged.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/admin/users',{method:'POST',proof:true,body:{username:'third-admin',email:'third@example.invalid',role:'admin'}})).status,403);
  assert.equal((await call(`/api/admin/users/${id}`,{method:'PATCH',proof:true,body:{role:'manager'}})).status,403);cookie=ownerCookie;
});
test('S2 connection creation rejects legacy URL tokens and requires a signing secret',async()=>{
  assert.throws(()=>sheetsEndpoint(endpoint+'?token=abc'));
  const response=await call('/api/admin/webhooks',{method:'POST',proof:true,body:{name:'legacy',url:endpoint+'?token=abc'}});assert.equal(response.status,400);
});
test('S1/S4 payload is allow-listed, with no attribution, identity keys or free-text',()=>{
  const lead={id:crypto.randomUUID(),name:'Name',email:'a@example.invalid',email_key:'secret-key',phone_key:'secret-phone',attribution:{gclid:'click'},form_data:{service:'Dental',details:'medical private',size:'large'}};
  const config={sensitiveCategory:false,googleSheets:{formFields:['details','size']},formFields:[{name:'details',type:'textarea'},{name:'size',type:'select'}]};
  const value=minimalSheetsLead(lead,config);assert.equal(value.fields.size,'large');assert.equal(value.fields.details,undefined);assert.equal(value.email_key,undefined);assert.equal(value.attribution,undefined);
  assert.equal(minimalSheetsLead(lead,{...config,sensitiveCategory:true}).fields,undefined);
});
test('S2 body HMAC uses a per-destination/version key and is interoperable with Apps Script',async()=>{
  const payload=JSON.parse(await signedSheetsPayload(env,endpoint,{event:'lead.created',event_id:crypto.randomUUID(),lead:{id:crypto.randomUUID(),name:'Zoë 😀'}}));
  const code=readFileSync(path.join(root,'google-apps-script/Code.gs'),'utf8');const context=vm.createContext({Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(text,secret)=>[...createHmac('sha256',secret).update(text).digest()]},Date,Number,JSON});vm.runInContext(code,context);
  const key=await connectionKey(env,endpoint),properties={getProperty:k=>({CRM_CONNECTION_SECRET:key,CRM_KEY_VERSION:'1'}[k])};
  const read=value=>context.signedMessage({postData:{contents:JSON.stringify(value)}},properties);
  assert.ok(read(payload));assert.equal(read({...payload,lead:{...payload.lead,name:'Changed'}}),null);assert.equal(read({...payload,timestamp:payload.timestamp-301}),null);assert.equal(read({...payload,key_version:2}),null);
  assert.notEqual(key,await connectionKey(env,endpoint,2));assert.notEqual(key,await connectionKey(env,endpoint.replace('TEST_','OTHER_')));
  assert.equal(context.safeCell('  =IMPORTXML("bad")').startsWith("'"),true);
});
test('S5 acknowledgements are streamed with a byte cap and explicit rejection is terminal',async()=>{
  await assert.rejects(readAppsScriptAck(new Response('x'.repeat(17000)), 'id'),/Oversized/);
  await assert.rejects(readAppsScriptAck(Response.json({ok:true,event_id:'other'}),'id'));
  await assert.rejects(readAppsScriptAck(Response.json({ok:false,retryable:false}),'id'),SheetsRejected);
});
test('Sheets redirects cannot forward payload/auth to an arbitrary host',async()=>{
  let calls=0;await assert.rejects(deliver(endpoint,{},'{}','id',async()=>{calls++;return Response.redirect('https://evil.example.com/macros/steal',302);}));assert.equal(calls,1);
  const requests=[];await deliver(endpoint,{'X-CRM-Signature':'private'},'secret-body','id',async(url,options)=>{requests.push({url,options});if(url.includes('cloudflare-dns'))return Response.json({Status:0,Answer:url.includes('type=A&')||url.endsWith('type=A')?[{type:1,data:'93.184.216.34'}]:[]});if(url===endpoint)return Response.redirect('https://script.googleusercontent.com/macros/echo?id=public',302);return Response.json({ok:true,event_id:'id'});});
  const last=requests.at(-1);assert.equal(last.options.method,'GET');assert.equal(last.options.body,undefined);assert.equal(last.options.headers,undefined);
});
test('S3 possible delivered copies remain erasable after connection removal',async()=>{
  const create=await call('/api/admin/webhooks',{method:'POST',proof:true,body:{name:'Sheets',url:endpoint}});assert.equal(create.status,201,await create.clone().text());const hook=(await create.json()).webhook;
  const leadResponse=await call('/api/leads',{method:'POST',auth:false,body:{idempotency_key:crypto.randomUUID(),website:'',form_name:'enquiry',landing_page:'/',form_data:{first_name:'Alex',last_name:'Test',email:'synthetic@example.invalid',phone:'+44 7700 900123',service:'Service one',contact_method:'Email'},attribution:{}}});assert.equal(leadResponse.status,201,await leadResponse.clone().text());const lead=(await leadResponse.json()).lead_id;await drain();
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM sheets_delivery_receipts WHERE lead_id=?').get(lead).n,1);
  await deleteWebhook(env,hook.id,'owner');
  const preview=await previewErasure(env,{lead_ids:[lead]});const operation=await beginErasure(env,{operation_id:crypto.randomUUID(),token:preview.token});
  assert.equal(operation.crm_complete,true);assert.equal(operation.all_managed_copies_erased,false);assert.equal(operation.downstream[0].status,'pending');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM leads WHERE id=?').get(lead).n,0);
  await processSheetsErasures(env);const result=await erasureStatus(env,operation.id);assert.equal(result.all_managed_copies_erased,true);assert.ok(sent.some(row=>row.event==='lead.erased'&&row.lead_id===lead));
});
test('F5 recent audit includes logins/export/connection changes without raw credentials',async()=>{
  const response=await call('/api/admin/security/overview');assert.equal(response.status,200);const value=await response.json();const actions=value.events.map(row=>row.action);
  for(const action of ['login-success','leads-exported','webhook-created','webhook-deleted'])assert.ok(actions.includes(action),action);
  const text=JSON.stringify(value);assert.equal(text.includes(password),false);assert.equal(text.includes('token='),false);assert.equal(text.includes(encoded),false);
});
test('F6 saturated rate-limit buckets stop increasing rather than allocating unlimited writes',async()=>{
  const request=new Request('https://site.test');await rateLimit(env,request,'security-test',1,600,true);
  for(let i=0;i<5;i++)await assert.rejects(rateLimit(env,request,'security-test',1,600,true),e=>e.status===429);
  const key=await hmac(env.SESSION_SECRET,`rate:security-test:${Math.floor(Date.now()/1000/600)}:global`);assert.equal(env.DB.raw.prepare('SELECT count FROM rate_limits WHERE key=?').get(key).count,2);
});
test('F11 idle expiry is not renewed by background session polling',async()=>{
  await login();const token=await hmac(env.SESSION_SECRET,'session:'+cookie.split('=')[1]),old=Math.floor(Date.now()/1000)-3590;
  env.DB.raw.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(old,token);assert.equal((await call('/api/auth/session')).status,200);assert.equal(env.DB.raw.prepare('SELECT last_seen_at FROM sessions WHERE token_hash=?').get(token).last_seen_at,old);
  env.DB.raw.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(old-20,token);assert.equal((await call('/api/admin/leads')).status,401);
});

test('S2 key rotation is monotonic and survives removing/re-adding the endpoint',async()=>{
  await login();
  let response=await call('/api/admin/webhooks',{method:'POST',proof:true,body:{name:'Rotate Sheets',url:endpoint}});
  assert.equal(response.status,201);const hook=(await response.json()).webhook;
  response=await call(`/api/admin/webhooks/${hook.id}`,{method:'PATCH',proof:true,body:{sheets_key_version:3}});
  assert.equal(response.status,200);assert.equal((await response.json()).key_version,3);
  assert.equal((await call(`/api/admin/webhooks/${hook.id}`,{method:'PATCH',proof:true,body:{sheets_key_version:2}})).status,409);
  await deleteWebhook(env,hook.id,'owner');
  response=await call('/api/admin/webhooks',{method:'POST',proof:true,body:{name:'Re-added Sheets',url:endpoint}});
  assert.equal(response.status,201);const added=(await response.json()).webhook;
  assert.equal(added.sheets_key_version,3);
  assert.equal(env.DB.raw.prepare('SELECT sheets_key_version FROM webhooks WHERE id=?').get(added.id).sheets_key_version,3);
});

test('F11 confirmation accepts UTF-8 without placing passwords in URLs',async()=>{
  const secret='synthetic-Żółć-😀-long-password';
  const id=crypto.randomUUID(),hash=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(secret,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
  env.DB.raw.prepare("INSERT INTO crm_users(id,username,email,role,status,password_hash,email_verified_at,created_at,updated_at) VALUES(?,?,?,'admin','active',?,?,?,?)").run(id,'unicode-admin','unicode@example.invalid',hash,new Date().toISOString(),'2026-09-22','2026-09-22');
  const logged=await call('/api/auth/login',{method:'POST',auth:false,body:{username:'unicode-admin',password:secret}});assert.equal(logged.status,200);const prior=cookie;cookie=logged.headers.get('set-cookie').split(';')[0];
  try {
    assert.equal((await call('/api/admin/leads/export.csv',{headers:{'X-CRM-Confirm-Password-UTF8':Buffer.from(secret).toString('base64')}})).status,200);
    assert.equal((await call('/api/admin/leads/export.csv',{headers:{'X-CRM-Confirm-Password-UTF8':'not base64!'}})).status,400);
  }finally{cookie=prior;}
});

test('S3 Apps Script deletes both tabs, deduplicates and prevents late resurrection',async()=>{
  class Sheet {
    constructor(rows=[]){this.rows=rows;}
    getLastRow(){return this.rows.length;}
    getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
    appendRow(row){this.rows.push([...row]);}
    deleteRow(row){this.rows.splice(row-1,1);}
    getRange(row,column,height,width){const sheet=this;return {
      getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sheet.rows[row-1+i]?.[column-1+j]??'')),
      setValues:values=>values.forEach((r,i)=>{sheet.rows[row-1+i]||=[];r.forEach((v,j)=>sheet.rows[row-1+i][column-1+j]=v);}),
      createTextFinder(value){return {matchEntireCell(){return this;},useRegularExpression(){return this;},findAll(){const found=[];for(let i=row-1;i<row-1+height;i++)if(sheet.rows[i]?.[column-1]===value)found.push({getRow:()=>i+1});return found;},findNext(){return this.findAll()[0]||null;}};}
    };}
  }
  const tabs=new Map(),book={getSheetByName:n=>tabs.get(n)||null,insertSheet:n=>{const tab=new Sheet();tabs.set(n,tab);return tab;}};
  const key=await connectionKey(env,endpoint),properties={getProperty:k=>({CRM_CONNECTION_SECRET:key,CRM_KEY_VERSION:'1',CRM_SPREADSHEET_ID:'synthetic-sheet'}[k])};let locked=false;
  const context=vm.createContext({Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(text,secret)=>[...createHmac('sha256',secret).update(text).digest()]},Date,Number,JSON,
    PropertiesService:{getScriptProperties:()=>properties},LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(locked,false);locked=true;return true;},releaseLock:()=>{locked=false;}})},
    SpreadsheetApp:{openById:id=>{assert.equal(id,'synthetic-sheet');return book;},flush:()=>{}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})}});
  vm.runInContext(readFileSync(path.join(root,'google-apps-script/Code.gs'),'utf8'),context);
  const lead={id:crypto.randomUUID(),name:' =malicious-formula'},event_id=crypto.randomUUID();
  const submit=async envelope=>JSON.parse(context.doPost({postData:{contents:await signedSheetsPayload(env,endpoint,envelope)}}));
  assert.equal((await submit({event:'lead.created',event_id,lead})).ok,true);
  assert.equal((await submit({event:'lead.created',event_id,lead})).ok,true);assert.equal(tabs.get('Leads').rows.length,2);assert.match(tabs.get('Leads').rows[1][3],/^'/);
  tabs.set('Attribution',new Sheet([['Lead ID','Campaign'],[lead.id,'private-first'],['unrelated','keep'],[lead.id,'private-last']]));
  const erase={event:'lead.erased',event_id:crypto.randomUUID(),lead_id:lead.id};
  assert.equal((await submit(erase)).ok,true);assert.equal((await submit(erase)).ok,true);
  assert.equal(tabs.get('Leads').rows.length,1);assert.equal(tabs.get('Attribution').rows.length,2);
  assert.equal((await submit({event:'lead.created',event_id:crypto.randomUUID(),lead})).erased,true);
  assert.equal(tabs.get('Leads').rows.length,1);assert.equal(tabs.get('_CRM Erased').rows.length,2);assert.equal(locked,false);
  const stale=JSON.parse(await signedSheetsPayload(env,endpoint,{event:'lead.created',event_id:crypto.randomUUID(),lead},1,Date.now()-301000));
  assert.equal(JSON.parse(context.doPost({postData:{contents:JSON.stringify(stale)}})).retryable,false);
});


test('review: per-IP rejected calls cannot consume the site-wide allowance',async()=>{
  const isolated={DB:database(),SESSION_SECRET:'c'.repeat(64)};
  try{
    const request=new Request('https://site.test',{headers:{'CF-Connecting-IP':'192.0.2.11'}});
    const limits=[['review-daily',10,86400],['review-window',6,600]];
    await publicRateLimit(isolated,request,'review-ip',1,600,limits);
    for(let i=0;i<20;i++)await assert.rejects(publicRateLimit(isolated,request,'review-ip',1,600,limits),e=>e.status===429);
    for(const [name,,period]of limits){
      const key=await hmac(isolated.SESSION_SECRET,`rate:${name}:${Math.floor(Date.now()/1000/period)}:global`);
      assert.equal(isolated.DB.raw.prepare('SELECT count FROM rate_limits WHERE key=?').get(key).count,1);
    }
    await publicRateLimit(isolated,new Request('https://site.test',{headers:{'CF-Connecting-IP':'192.0.2.12'}}),'review-ip',1,600,limits);
  }finally{isolated.DB.raw.close();}
});
test('review: an exhausted global allowance rejects rotating IPs without allocating rows',async()=>{
  const isolated={DB:database(),SESSION_SECRET:'d'.repeat(64)};
  try{
    const limits=[['review-global',1,600]];
    await publicRateLimit(isolated,new Request('https://site.test'),'review-ip',1,600,limits);
    const count=isolated.DB.raw.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n;
    for(let i=0;i<20;i++)await assert.rejects(publicRateLimit(isolated,new Request('https://site.test',{headers:{'CF-Connecting-IP':`192.0.2.${i}`}}),'review-ip',1,600,limits),e=>e.status===429);
    assert.equal(isolated.DB.raw.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n,count);
  }finally{isolated.DB.raw.close();}
});
test('review: a field called service cannot smuggle free text into a sensitive Sheet',()=>{
  const lead={id:crypto.randomUUID(),form_data:{service:'Private medical history'}};
  for(const type of ['textarea','text',undefined])assert.equal(minimalSheetsLead(lead,{sensitiveCategory:true,formFields:[{name:'service',type}]}).service,undefined);
  const config={sensitiveCategory:true,formFields:[{name:'service',type:'select',options:['Consultation']}]};
  assert.equal(minimalSheetsLead(lead,config).service,undefined);
  assert.equal(minimalSheetsLead({...lead,form_data:{service:'Consultation'}},config).service,'Consultation');
});
test('review: each Sheets deletion gets a fresh lease even after a slow earlier job',async()=>{
  const isolated={DB:database(),SESSION_SECRET:'e'.repeat(64),GOOGLE_SHEETS_SIGNING_SECRET:'f'.repeat(64)};
  const oldNow=Date.now,oldFetch=globalThis.fetch;let clock=oldNow(),deliveries=0;
  Date.now=()=>clock;
  try{
    for(let i=0;i<3;i++)isolated.DB.raw.prepare("INSERT INTO sheets_erasure_outbox(id,webhook_id,destination,lead_id,operation_id,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),'removed-connection',endpoint,crypto.randomUUID(),crypto.randomUUID(),Math.floor(clock/1000),new Date(clock).toISOString());
    globalThis.fetch=async(input,options={})=>{
      const url=new URL(input);
      if(url.hostname==='cloudflare-dns.com')return Response.json({Status:0,Answer:url.searchParams.get('type')==='A'?[{type:1,data:'93.184.216.34'}]:[]});
      const message=JSON.parse(options.body),row=isolated.DB.raw.prepare('SELECT locked_until FROM sheets_erasure_outbox WHERE id=?').get(message.event_id);
      assert.ok(row.locked_until>Math.floor(clock/1000));deliveries++;clock+=95000;
      return Response.json({ok:true,event_id:message.event_id});
    };
    await processSheetsErasures(isolated);
    assert.equal(deliveries,3);
    assert.equal(isolated.DB.raw.prepare("SELECT COUNT(*) AS n FROM sheets_erasure_outbox WHERE status='delivered'").get().n,3);
  }finally{Date.now=oldNow;globalThis.fetch=oldFetch;isolated.DB.raw.close();}
});


test('review: cleaned backups invalidate one-use access links and pause Sheets deletions',()=>{
  const DB=database(),temporary=mkdtempSync(path.join(tmpdir(),'restore-security-'));
  try{
    const now=new Date().toISOString(),dataset=DB.raw.prepare('SELECT dataset_id FROM data_retention_policy WHERE id=1').get().dataset_id;
    DB.raw.prepare("INSERT INTO crm_account_actions(id,token_hash,user_id,email,purpose,expected_version,state,expires_at,created_at,approved_by) VALUES(?,?,?,?,?,?,'ready',?,?,?)").run(crypto.randomUUID(),'synthetic-action-hash','owner','owner@example.invalid','reset',0,Math.floor(Date.now()/1000)+3600,now,'owner');
    DB.raw.prepare("INSERT INTO sheets_erasure_outbox(id,webhook_id,destination,lead_id,operation_id,status,next_attempt_at,created_at,claim_token,locked_until) VALUES(?,?,?,?,?,'sending',0,?,?,?)").run(crypto.randomUUID(),'removed-hook',endpoint,crypto.randomUUID(),crypto.randomUUID(),now,'old-lease',Math.floor(Date.now()/1000)+300);
    const recordFile=path.join(temporary,'record.json');writeFileSync(recordFile,JSON.stringify({schema_version:1,complete:true,entry_count:0,entries:[],dataset_id:dataset,generated_at:now}));
    const execute=args=>{
      if(args.includes('--command'))return JSON.stringify([{results:DB.raw.prepare(args[args.indexOf('--command')+1]).all()}]);
      if(args.includes('--file')){DB.raw.exec(readFileSync(args[args.indexOf('--file')+1],'utf8'));return '[]';}
      throw new Error('Unexpected fixture command');
    };
    const result=reconcileErasureRecord({recordFile,temporary,template:root,common:['--local'],execute});
    assert.equal(DB.raw.prepare('SELECT state FROM crm_account_actions').get().state,'failed');
    const job=DB.raw.prepare('SELECT status,locked_until,claim_token FROM sheets_erasure_outbox').get();assert.equal(job.status,'failed');assert.equal(job.locked_until,null);assert.equal(job.claim_token,null);
    assert.equal(result.downstream_deletions,'paused_for_reconciliation');assert.equal(result.account_action_links,'invalidated');
  }finally{DB.raw.close();rmSync(temporary,{recursive:true,force:true});}
});
