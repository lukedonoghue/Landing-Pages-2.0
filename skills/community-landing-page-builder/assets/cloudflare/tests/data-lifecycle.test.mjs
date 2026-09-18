/** Real isolated D1 lifecycle transactions. All contacts and destinations synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, webkit } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { createLead, recordVisit, metrics, addNote, deleteLead, changeStatus } from '../src/repository.js';
import { retentionPolicy, previewErasure, beginErasure, progressErasure, previewRetention, saveRetention, runRetention, findErasableLeads, exportErasureLedger, erasedKey } from '../src/data-lifecycle.js';
import { deleteWebhook, enableWebhook, processOutbox, listWebhooks } from '../src/webhooks.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(readFileSync(root+'tests/fixtures/site-config.json'));
const secret='synthetic-lifecycle-secret-at-least-32-characters';
const password='synthetic-owner-password-for-local-tests',salt='3'.repeat(32);
const encoded=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
const bundle=await build({entryPoints:[root+'src/worker.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',plugins:[{name:'fixture-schema',setup(b){b.onLoad({filter:/site-config\.json$/},()=>({contents:JSON.stringify(config),loader:'json'}));}}]});
const ago=days=>new Date(Date.now()-days*86400000).toISOString();
const disabled={enabled:false,lead_scope:'removed',leads_days:null,notes_days:null,attribution_days:null,visits_days:null,delivery_history_days:null};
async function fixture(t) {
  const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-22',d1Databases:{DB:'data-lifecycle'},bindings:{SESSION_SECRET:secret,ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:encoded},serviceBindings:{ASSETS:request=>{
    const url=new URL(request.url),relative=url.pathname==='/admin/'?'admin/index.html':url.pathname.slice(1),file=path.resolve(root,'public',relative);
    if(!file.startsWith(path.resolve(root,'public')+path.sep)||!existsSync(file))return new Response('Missing',{status:404});
    return new Response(readFileSync(file),{headers:{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'}});
  }},outboundService:()=>new Response('External calls disabled',{status:503})});
  t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
  for(const file of readdirSync(root+'migrations').filter(name=>name.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(readFileSync(root+'migrations/'+file,'utf8')).map(sql=>db.prepare(sql)));
  const env={DB:db,SESSION_SECRET:secret};let n=0,cookie='';
  const request=new Request('https://site.test/api/leads',{headers:{'User-Agent':'Desktop Chrome'}});
  const call=async(path,{method='GET',body,auth=true,headers={}}={})=>{
    const response=await mf.dispatchFetch('https://site.test'+path,{method,headers:{'CF-Connecting-IP':`198.51.100.${++n%240+1}`,...(auth&&cookie?{Cookie:cookie}:{}),...(method==='GET'?{}:{Origin:'https://site.test','Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
    return {response,body:await response.json()};
  };
  const login=await call('/api/auth/login',{method:'POST',body:{username:'owner',password}});assert.equal(login.response.status,200);cookie=login.response.headers.get('Set-Cookie').split(';')[0];
  const seed=async({measured=false,marker=crypto.randomUUID(),hook=false}={})=>{
    if(hook)await db.prepare('INSERT INTO webhooks(id,name,url,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),'Synthetic hook','https://hooks.example.invalid',ago(0)).run();
    const visitor=crypto.randomUUID(),event=crypto.randomUUID();
    if(measured)await recordVisit(env,request,{event_id:event,visitor_id:visitor,analytics_consent:true,attribution_consent:true,path:'/',attribution:{gclid:'click-'+marker}},config);
    const body={idempotency_key:crypto.randomUUID(),form_name:'enquiry',form_data:{first_name:marker,last_name:'Synthetic',email:marker+'@example.invalid',phone:'+44 7700 900123',service:'Service one',contact_method:'Email'},attribution:{first_touch:{gclid:'click-'+marker},latest_touch:{gclid:'click-'+marker}},attribution_consent:true,landing_page:'/',...(measured?{analytics_consent:true,visitor_id:visitor,visit_event_id:event}:{})};
    const result=await createLead(env,request,body,config);return {id:result.lead_id,receipt:result.receipt_id,body,event,marker};
  };
  const erase=async ids=>{const preview=await previewErasure(env,{lead_ids:ids});const body={operation_id:crypto.randomUUID(),token:preview.token};return {preview,body,result:await beginErasure(env,body)};};
  const policy=async value=>{const preview=await previewRetention(env,{policy:{...disabled,...value}});await saveRetention(env,{policy:preview.policy,token:preview.token});return preview;};
  return {mf,db,env,request,call,seed,erase,policy};
}
const count=async(db,table)=>(await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
const report=f=>metrics(f.env,new URL('https://site.test/api/admin/metrics?start='+ago(0).slice(0,10)+'&end='+ago(0).slice(0,10)),config);

test('migration and unconfigured maintenance never delete contacts',async t=>{
  const f=await fixture(t);await f.seed();assert.equal((await retentionPolicy(f.env)).enabled,false);assert.deepEqual(await runRetention(f.env),{enabled:false});assert.equal(await count(f.db,'leads'),1);
});
test('data operations require authenticated access, same-origin writes and a valid preview',async t=>{
  const f=await fixture(t),lead=await f.seed();
  for(const path of ['/api/admin/data/retention','/api/admin/data/erasures','/api/admin/data/enquiries?q=Synthetic','/api/admin/data/erasure-records'])assert.equal((await f.call(path,{auth:false})).response.status,401);
  assert.equal((await f.call('/api/admin/data/erasures/preview',{method:'POST',body:{lead_ids:[lead.id]},headers:{Origin:'https://elsewhere.invalid'}})).response.status,403);
  assert.equal((await f.call('/api/admin/data/erasures',{method:'POST',body:{operation_id:crypto.randomUUID(),token:'forged'}})).response.status,400);assert.equal(await count(f.db,'leads'),1);
});
test('erasure removes every enquiry marker, preserves unrelated contacts, changes retained metrics and blocks old retries',async t=>{
  const f=await fixture(t),lead=await f.seed({measured:true,hook:true}),other=await f.seed();
  await addNote(f.env,lead.id,{body:'note-'+lead.marker});await f.db.prepare("UPDATE activity SET description=? WHERE lead_id=?").bind('history-'+lead.marker,lead.id).run();
  const before=await report(f);assert.equal(before.totals.conversions,1);assert.equal(before.totals.leads,2);
  const {preview,body,result}=await f.erase([lead.id]);assert.equal(result.status,'complete');assert.deepEqual(result.counts,{enquiries:1,notes:1,activity:2,deliveries:1});assert.equal(preview.counts.enquiries,1);
  for(const table of ['leads','notes','activity','webhook_outbox','erasure_operations','erasure_items','erased_submissions'])assert.ok(!JSON.stringify((await f.db.prepare(`SELECT * FROM ${table}`).all()).results).includes(lead.marker),table);
  assert.equal(await count(f.db,'leads'),1);assert.equal((await f.db.prepare('SELECT id FROM leads').first()).id,other.id);
  assert.deepEqual(await beginErasure(f.env,body),result);assert.equal(await count(f.db,'erasure_operations'),1);
  await assert.rejects(createLead(f.env,f.request,lead.body,config),error=>error.status===410);assert.equal(await count(f.db,'leads'),1);
  const after=await report(f);assert.equal(after.totals.visitors,1);assert.equal(after.totals.conversions,0);assert.equal(after.totals.leads,1);assert.ok(after.warnings.some(text=>text.includes('retained history')));
  const record=(await exportErasureLedger(f.env,new URL('https://site.test'))).entries[0];assert.deepEqual(Object.keys(record).sort(),['erased_at','key_hash','lead_id']);assert.equal(record.key_hash,await erasedKey(lead.body.idempotency_key));
  assert.equal((await f.db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
});
test('removed enquiries remain findable for erasure and disappear after completion',async t=>{
  const f=await fixture(t),lead=await f.seed();await deleteLead(f.env,lead.id);
  const url=new URL('https://site.test?q='+encodeURIComponent(lead.marker));const found=await findErasableLeads(f.env,url);assert.equal(found.total,1);assert.ok(found.enquiries[0].deleted_at);
  await f.erase([lead.id]);assert.equal((await findErasableLeads(f.env,url)).total,0);
});
test('changed selections, expired previews and altered tokens cannot erase data',async t=>{
  const f=await fixture(t),lead=await f.seed();const preview=await previewErasure(f.env,{lead_ids:[lead.id]});
  await changeStatus(f.env,lead.id,{status:'qualified',version:1});await assert.rejects(beginErasure(f.env,{operation_id:crypto.randomUUID(),token:preview.token}),e=>e.status===409);
  const expired=await previewErasure(f.env,{lead_ids:[lead.id]},new Date(Date.now()-11*60000));await assert.rejects(beginErasure(f.env,{operation_id:crypto.randomUUID(),token:expired.token}),e=>e.status===409);
  await assert.rejects(beginErasure(f.env,{operation_id:crypto.randomUUID(),token:preview.token+'0'}),e=>e.status===400);assert.equal(await count(f.db,'leads'),1);assert.equal(await count(f.db,'erased_submissions'),0);
});
test('a delivery already running delays completion, hides the enquiry and prevents replay until it finishes',async t=>{
  const f=await fixture(t),lead=await f.seed({hook:true});await f.db.prepare("UPDATE webhook_outbox SET status='sending',locked_until=?,claim_token='synthetic-claim' WHERE lead_id=?").bind(Math.floor(Date.now()/1000)+90,lead.id).run();
  const {body,result}=await f.erase([lead.id]);assert.equal(result.status,'waiting');assert.equal(result.active_deliveries,1);assert.equal(await count(f.db,'leads'),1);assert.ok((await f.db.prepare('SELECT deleted_at FROM leads').first()).deleted_at);
  await assert.rejects(createLead(f.env,f.request,lead.body,config),e=>e.status===410);assert.equal((await progressErasure(f.env,body.operation_id)).status,'waiting');
  await f.db.prepare("UPDATE webhook_outbox SET status='delivered',locked_until=NULL").run();
  // Completion recovery works even with automatic retention disabled.
  await runRetention(f.env);assert.equal((await progressErasure(f.env,body.operation_id)).status,'complete');assert.equal(await count(f.db,'leads'),0);
});
test('concurrent repeat erasures return one operation without recreating a contact',async t=>{
  const f=await fixture(t),lead=await f.seed();const preview=await previewErasure(f.env,{lead_ids:[lead.id]});const body={operation_id:crypto.randomUUID(),token:preview.token};
  const results=await Promise.all([beginErasure(f.env,body),beginErasure(f.env,body)]);assert.equal(results[0].id,results[1].id);assert.equal(await count(f.db,'erasure_operations'),1);assert.equal(await count(f.db,'erased_submissions'),1);assert.equal(await count(f.db,'leads'),0);
});
test('a failed D1 erasure transaction rolls back its suppression record and remains retryable',async t=>{
  const f=await fixture(t),lead=await f.seed();const preview=await previewErasure(f.env,{lead_ids:[lead.id]}),body={operation_id:crypto.randomUUID(),token:preview.token};
  const broken={...f.env,DB:{prepare:sql=>f.db.prepare(sql),batch:statements=>f.db.batch([...statements.slice(0,3),f.db.prepare('SELECT missing_erasure_column FROM leads'),...statements.slice(3)])}};
  await assert.rejects(beginErasure(broken,body));assert.equal(await count(f.db,'erasure_operations'),0);assert.equal(await count(f.db,'erased_submissions'),0);assert.equal((await f.db.prepare('SELECT deleted_at FROM leads').first()).deleted_at,null);
  assert.equal((await beginErasure(f.env,body)).status,'complete');
});
test('retention applies the reviewed removed-only scope and remains idempotent',async t=>{
  const f=await fixture(t),old=await f.seed(),recent=await f.seed(),active=await f.seed();
  await f.db.prepare('UPDATE leads SET created_at=?').bind(ago(100)).run();await f.db.prepare('UPDATE leads SET deleted_at=? WHERE id=?').bind(ago(40),old.id).run();await f.db.prepare('UPDATE leads SET deleted_at=? WHERE id=?').bind(ago(10),recent.id).run();
  const preview=await f.policy({enabled:true,leads_days:30});assert.equal(preview.counts.leads_days,1);await runRetention(f.env);await runRetention(f.env);
  assert.equal(await count(f.db,'leads'),2);const ids=(await f.db.prepare('SELECT id FROM leads').all()).results.map(x=>x.id);assert.ok(ids.includes(recent.id)&&ids.includes(active.id));await assert.rejects(createLead(f.env,f.request,old.body,config),e=>e.status===410);
});
test('retention settings reject unknown periods, preview changes and stale replacement',async t=>{
  const f=await fixture(t);await assert.rejects(previewRetention(f.env,{policy:{...disabled,enabled:true,leads_days:0}}),e=>e.status===400);
  const first=await previewRetention(f.env,{policy:{...disabled,enabled:true,leads_days:30}}),second=await previewRetention(f.env,{policy:{...disabled,enabled:true,leads_days:60}});
  await assert.rejects(saveRetention(f.env,{token:first.token,policy:second.policy}),e=>e.status===409);
  const body={policy:first.policy,token:first.token};await saveRetention(f.env,body);assert.equal((await saveRetention(f.env,body)).duplicate,true);
  await assert.rejects(saveRetention(f.env,{token:second.token,policy:second.policy}),e=>e.status===409);assert.equal((await retentionPolicy(f.env)).leads_days,30);
});
test('independent note and campaign expiry leaves contact fields and reporting categories intact',async t=>{
  const f=await fixture(t),lead=await f.seed();await addNote(f.env,lead.id,{body:'old-private-note'});
  for(const table of ['leads','notes','activity'])await f.db.prepare(`UPDATE ${table} SET created_at=?`).bind(ago(40)).run();
  await f.policy({enabled:true,notes_days:30,attribution_days:30});await runRetention(f.env);await runRetention(f.env);
  assert.equal(await count(f.db,'notes'),0);assert.equal(await count(f.db,'activity'),0);const row=await f.db.prepare('SELECT * FROM leads').first();assert.equal(row.email,lead.body.form_data.email);assert.equal(row.traffic_source,'google');assert.deepEqual(JSON.parse(row.attribution),{first_touch:{},latest_touch:{}});
});
test('visit retention removes event links and legacy rows without violating foreign keys',async t=>{
  const f=await fixture(t),lead=await f.seed({measured:true});await f.db.prepare('UPDATE visit_events SET created_at=?').bind(ago(40)).run();
  await f.db.prepare('INSERT INTO visits(reporting_day,path,visitor_hash,created_at) VALUES(?,?,?,?)').bind(ago(40).slice(0,10),'/',crypto.randomUUID(),ago(40)).run();
  await f.policy({enabled:true,visits_days:30});await runRetention(f.env);
  assert.equal(await count(f.db,'visit_events'),0);assert.equal(await count(f.db,'visits'),0);const row=await f.db.prepare('SELECT visit_event_id,visitor_hash,email FROM leads').first();assert.equal(row.visit_event_id,null);assert.equal(row.visitor_hash,null);assert.equal(row.email,lead.body.form_data.email);assert.equal((await f.db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
});
test('delivery history retention deletes only old terminal records',async t=>{
  const f=await fixture(t);await f.seed({hook:true});await f.seed();await f.seed();await f.seed();
  const rows=(await f.db.prepare('SELECT id FROM webhook_outbox ORDER BY id').all()).results;
  for(const [i,status]of ['delivered','failed','pending','sending'].entries())await f.db.prepare('UPDATE webhook_outbox SET status=?,created_at=? WHERE id=?').bind(status,ago(40),rows[i].id).run();
  await f.policy({enabled:true,delivery_history_days:30});await runRetention(f.env);assert.deepEqual((await f.db.prepare('SELECT status FROM webhook_outbox ORDER BY status').all()).results.map(x=>x.status),['pending','sending']);
});

test('soft removal cannot conceal an active delivery lease from permanent erasure',async t=>{
  const f=await fixture(t),lead=await f.seed({hook:true});await f.db.prepare("UPDATE webhook_outbox SET status='sending',claim_token='synthetic-running',locked_until=?").bind(Math.floor(Date.now()/1000)+90).run();
  await deleteLead(f.env,lead.id);assert.equal((await f.db.prepare('SELECT status FROM webhook_outbox').first()).status,'failed');
  const result=await f.erase([lead.id]);assert.equal(result.result.status,'waiting');
  assert.equal((await progressErasure(f.env,result.body.operation_id,new Date(Date.now()+91000))).status,'complete');
});

for(const [name,engine,width,height] of [['desktop',chromium,1440,900],['mobile',webkit,390,900],['short-mobile',webkit,320,568]])test(name+' owner can cancel/review/erase and configure retention using the real admin interface',async t=>{
  const f=await fixture(t),lead=await f.seed(),old=await f.seed(),keep=await f.seed();
  await f.db.prepare('UPDATE leads SET deleted_at=? WHERE id=?').bind(ago(40),old.id).run();let ip=0;
  const server=http.createServer(async(req,res)=>{try{const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);const response=await f.mf.dispatchFetch(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers:{...req.headers,'CF-Connecting-IP':`198.51.100.${++ip%240+1}`},...(body.length?{body}:{}),redirect:'manual'});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Fixture error');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await engine.launch({headless:true});const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(8000);
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
  await page.goto(`http://127.0.0.1:${server.address().port}/login.html`);await page.locator('[name=username]').fill('owner');await page.locator('[name=password]').fill(password);await page.locator('button[type=submit]').click();await page.waitForURL('**/admin/');
  await page.locator('[data-view=account]').click();await page.locator('[name=erasure-search]').fill(lead.marker);await page.locator('.data-finder button').click();await page.locator('.data-result button').click();
  const dialog=page.locator('#erasure-dialog');await dialog.waitFor({state:'visible'});assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
  if(height<600)assert.equal(await dialog.evaluate(el=>el.scrollTop),0,'Short screens begin with the selected enquiry details in view');
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<5;i++){await page.keyboard.press(key);assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
  if(process.env.LIFECYCLE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LIFECYCLE_SCREENSHOT_DIR,name+'-erase.png')});
  await page.keyboard.press('Escape');assert.equal(await count(f.db,'leads'),3);assert.equal(await page.locator('.data-result button').evaluate(el=>el===document.activeElement),true);
  await page.locator('.data-result button').click();await dialog.waitFor({state:'visible'});await changeStatus(f.env,lead.id,{status:'qualified',version:1});await page.locator('[name=confirm-erasure]').check();await dialog.getByRole('button',{name:'Erase permanently',exact:true}).click();
  await dialog.getByRole('button',{name:'Review current data',exact:true}).waitFor({state:'visible'});assert.equal(await count(f.db,'leads'),3);await dialog.getByRole('button',{name:'Review current data',exact:true}).click();await page.locator('[name=confirm-erasure]').waitFor({state:'visible'});assert.equal(await page.locator('[name=confirm-erasure]').isChecked(),false);
  await page.locator('[name=confirm-erasure]').check();await dialog.getByRole('button',{name:'Erase permanently',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.data-history').textContent.includes('erased'));
  assert.equal(await count(f.db,'leads'),2);assert.equal(await count(f.db,'erased_submissions'),1);assert.equal(await page.locator('#data-panel-title').evaluate(el=>el===document.activeElement),true);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download erasure record',exact:true}).click();const download=await downloadEvent;const ledger=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(ledger.complete,true);assert.equal(ledger.entries[0].lead_id,lead.id);assert.ok(!JSON.stringify(ledger).includes(lead.marker));
  await page.locator('.data-settings summary').click();await page.locator('[name=retention-enabled]').check();await page.locator('[name=leads_days]').fill('30');await page.getByRole('button',{name:'Preview retention settings',exact:true}).click();await page.locator('.data-preview').waitFor({state:'visible'});assert.match(await page.locator('.data-preview').textContent(),/Enquiries: 1 currently eligible/);
  await page.locator('[name=leads_days]').fill('60');assert.equal(await page.locator('.data-preview').isVisible(),false);assert.equal(await page.getByRole('button',{name:'Run one cleanup batch',exact:true}).isDisabled(),true);
  await page.locator('[name=leads_days]').fill('30');await page.getByRole('button',{name:'Preview retention settings',exact:true}).click();await page.locator('.data-preview').waitFor({state:'visible'});await page.locator('[name=confirm-retention]').check();await page.getByRole('button',{name:'Save retention settings',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.data-status').textContent.includes('settings saved'));
  assert.equal(await count(f.db,'leads'),2);await page.getByRole('button',{name:'Run one cleanup batch',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.data-status').textContent.includes('batch completed'));
  assert.equal(await count(f.db,'leads'),1);assert.equal((await f.db.prepare('SELECT id FROM leads').first()).id,keep.id);assert.equal((await retentionPolicy(f.env)).enabled,true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(process.env.LIFECYCLE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LIFECYCLE_SCREENSHOT_DIR,name+'-retention.png'),fullPage:true});
});

test('removing a connection cannot hide an actual in-flight delivery from erasure',async t=>{
  const f=await fixture(t),lead=await f.seed({hook:true});const hook=(await f.db.prepare('SELECT id FROM webhooks').first()).id;await f.db.prepare('UPDATE webhooks SET url=? WHERE id=?').bind('https://hooks.example.com/receive',hook).run();
  let release,started;const hold=new Promise(resolve=>release=resolve),sent=new Promise(resolve=>started=resolve),original=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{const url=String(input);if(url.startsWith('https://cloudflare-dns.com/'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});if(url==='https://hooks.example.com/receive'){started();await hold;return new Response('Synthetic delivered');}if(url.startsWith('http://127.0.0.1:'))return original(input,options);throw new Error('Unapproved outbound fixture request blocked');};
  let pending;
  try{
    pending=processOutbox(f.env,1);let timer;try{await Promise.race([sent,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Fixture did not reach its intercepted delivery')),5000))]);}finally{clearTimeout(timer);}
    const removed=await deleteWebhook(f.env,hook);assert.equal(removed.finishing_deliveries,1);assert.equal((await listWebhooks(f.env)).webhooks.length,0);assert.equal(await count(f.db,'webhook_outbox'),1);
    const erased=await f.erase([lead.id]);assert.equal(erased.result.status,'waiting');assert.equal(erased.preview.counts.active_deliveries,1);
    const get=(await f.call('/api/admin/data/erasures/'+erased.body.operation_id)).body;const recent=(await f.call('/api/admin/data/erasures')).body.operations[0];assert.equal(get.active_deliveries,1);assert.equal(recent.active_deliveries,1);
    release();await pending;assert.equal((await progressErasure(f.env,erased.body.operation_id)).status,'complete');await processOutbox(f.env,1);assert.equal(await count(f.db,'webhooks'),0);
  }finally{release();if(pending)await pending;globalThis.fetch=original;}
});

test('erasure-record pagination freezes its boundary while new erasures are recorded',async t=>{
  const f=await fixture(t);const rows=await Promise.all(Array.from({length:201},async()=>[await erasedKey(crypto.randomUUID()),crypto.randomUUID(),ago(0)]));
  await f.db.batch(rows.map(row=>f.db.prepare('INSERT INTO erased_submissions(key_hash,lead_id,erased_at) VALUES(?,?,?)').bind(...row)));
  const first=await exportErasureLedger(f.env,new URL('https://site.test'));assert.equal(first.entries.length,200);assert.equal(first.through,201);
  await f.db.prepare('INSERT INTO erased_submissions(key_hash,lead_id,erased_at) VALUES(?,?,?)').bind(await erasedKey(crypto.randomUUID()),crypto.randomUUID(),ago(0)).run();
  const last=await exportErasureLedger(f.env,new URL(`https://site.test?after=${first.next}&through=${first.through}`));assert.equal(last.entries.length,1);assert.equal(last.next,null);assert.equal((await exportErasureLedger(f.env,new URL('https://site.test'))).through,202);
});

test('a maintenance invocation bounds its D1 statement count and enquiry scope',async t=>{
  const f=await fixture(t),pendingLead=await f.seed({hook:true});await f.db.prepare("UPDATE webhook_outbox SET status='sending',claim_token='budget-fixture',locked_until=?").bind(Math.floor(Date.now()/1000)+90).run();assert.equal((await f.erase([pendingLead.id])).result.status,'waiting');await f.db.prepare("UPDATE webhook_outbox SET status='delivered',locked_until=NULL").run();for(let i=0;i<22;i++)await f.seed();await f.db.prepare('UPDATE leads SET deleted_at=?').bind(ago(40)).run();await f.policy({enabled:true,leads_days:30});
  let statements=0;const wrap=inner=>({bind(...args){return wrap(inner.bind(...args));},first(...args){statements++;return inner.first(...args);},all(...args){statements++;return inner.all(...args);},run(...args){statements++;return inner.run(...args);},inner});
  const env={...f.env,DB:{prepare:sql=>wrap(f.db.prepare(sql)),batch:rows=>{statements+=rows.length;return f.db.batch(rows.map(row=>row.inner));}}};
  const result=await runRetention(env);assert.equal(result.erasure.counts.enquiries,20);assert.equal(await count(f.db,'leads'),2);assert.ok(statements<=38,`${statements} statements must leave room for one delivery and session cleanup on the Free invocation budget`);
});


test('restored connections must be deliberately enabled and never restart old failed jobs',async t=>{
  const f=await fixture(t);await f.seed({hook:true});const hook=(await f.db.prepare('SELECT id FROM webhooks').first()).id;
  await f.db.prepare('UPDATE webhooks SET enabled=0,url=?').bind('https://hooks.example.com/receive').run();await f.db.prepare("UPDATE webhook_outbox SET status='failed'").run();await f.seed();assert.equal(await count(f.db,'webhook_outbox'),1);
  const original=globalThis.fetch;globalThis.fetch=async(input,options)=>{const url=String(input);if(url.startsWith('https://cloudflare-dns.com/'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});if(url.startsWith('http://127.0.0.1:'))return original(input,options);throw new Error('External delivery blocked');};
  try{assert.equal((await enableWebhook(f.env,hook)).previous_jobs_requeued,false);await f.seed();assert.deepEqual((await f.db.prepare('SELECT status FROM webhook_outbox ORDER BY status').all()).results.map(row=>row.status),['failed','pending']);await deleteWebhook(f.env,hook);await assert.rejects(enableWebhook(f.env,hook),e=>e.status===404);}
  finally{globalThis.fetch=original;}
});


test('interrupted final erasure rolls back its deletes and resumes the accepted operation',async t=>{
  const f=await fixture(t),lead=await f.seed({hook:true});await addNote(f.env,lead.id,{body:'Synthetic retained until completion'});
  const preview=await previewErasure(f.env,{lead_ids:[lead.id]}),body={operation_id:crypto.randomUUID(),token:preview.token};let batches=0;
  const interrupted={...f.env,DB:{prepare:sql=>f.db.prepare(sql),batch:statements=>f.db.batch(++batches===2?[statements[0],f.db.prepare('SELECT nonexistent_finalization_column FROM leads'),...statements.slice(1)]:statements)}};
  await assert.rejects(beginErasure(interrupted,body));assert.equal(await count(f.db,'leads'),1);assert.equal(await count(f.db,'notes'),1);assert.equal(await count(f.db,'webhook_outbox'),1);
  const status=(await f.call('/api/admin/data/erasures/'+body.operation_id)).body;assert.equal(status.status,'waiting');assert.equal(status.active_deliveries,0);
  const resumed=await beginErasure(f.env,body,new Date(Date.now()+20*60000));assert.equal(resumed.status,'complete');assert.equal(await count(f.db,'leads'),0);assert.equal(await count(f.db,'erasure_operations'),1);
});
