/** Actual public UI, Worker policy and D1 storage using synthetic loopback data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { chromium, webkit } from 'playwright-core';
import { fillSteps } from '../scripts/browser-compat.mjs';
import { createLead, recordVisit, serializeLead } from '../src/repository.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const baseConfig=JSON.parse(readFileSync(path.join(root,'tests/fixtures/site-config.json')));
const form={first_name:'Privacy',last_name:'Synthetic',email:'privacy@example.invalid',phone:'+44 7700 900123',service:'Service one',contact_method:'Email'};
const fixture={fields:form,selectors:{step:'.wizard__step',next:'[data-next]',submit:'[data-submit]'}};
const lightbox=[path.join(root,'public/script.js'),path.join(root,'../multistep-lightbox.js')].find(existsSync);

async function site(t,{analyticsMode='consent',attributionMode='consent',engine=chromium,width=390,privacySignal=false,policyUnavailable=false}={}) {
  // These cases exercise the legacy built-in consent UI explicitly. The shared
  // fixture defaults to an external CMP for newly scaffolded sites.
  const config={...baseConfig,analyticsMode,attributionMode,consentUiMode:'internal'};let ip=0,dropLead=false;
  const bundle=await build({entryPoints:[path.join(root,'src/worker.js')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',plugins:[{name:'privacy-policy-fixture',setup(build){build.onLoad({filter:/site-config\.json$/},()=>({contents:JSON.stringify(config),loader:'json'}));}}]});
  const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-22',d1Databases:{DB:'privacy-tests'},bindings:{SESSION_SECRET:'synthetic-private-session-secret-32-characters'},outboundService:()=>new Response('No external calls',{status:503}),serviceBindings:{ASSETS:request=>{
    let pathname=new URL(request.url).pathname;
    if(pathname==='/assets/brochure/catalogue.pdf')return new Response('%PDF-1.7 Synthetic resource');
    const selected=pathname==='/'?'tests/fixtures/recovery-index.html':pathname==='/thank-you.html'?'tests/fixtures/recovery-thank-you.html':pathname==='/script.js'?null:'public'+pathname;
    const file=selected?path.join(root,selected):lightbox;
    if(!existsSync(file))return new Response('Missing',{status:404});
    return new Response(readFileSync(file),{headers:{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'}});
  }}});
  const db=await mf.getD1Database('DB');
  for(const name of readdirSync(path.join(root,'migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(readFileSync(path.join(root,'migrations',name),'utf8')).map(sql=>db.prepare(sql)));
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      requests.push({path:req.url.split('?')[0],method:req.method,...(body.length?{body:JSON.parse(body.toString())}:{})});
      if(policyUnavailable&&req.url==='/api/privacy-config'){res.writeHead(503);res.end('Settings unavailable');return;}
      const response=await mf.dispatchFetch(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers:{...req.headers,'CF-Connecting-IP':`198.51.100.${++ip%200+1}`},...(body.length?{body}:{}),redirect:'manual'});
      if(dropLead && req.method==='POST' && req.url==='/api/leads'){dropLead=false;await response.arrayBuffer();res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":');return;}
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(500);res.end('Fixture server error');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await engine.launch({headless:true});const context=await browser.newContext({viewport:{width,height:850}});
  if(privacySignal)await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
  const page=await context.newPage();page.setDefaultTimeout(6000);
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));await mf.dispose();});
  await page.goto(url+'/?utm_source=google&utm_medium=cpc&gclid=synthetic-click',{waitUntil:'networkidle'});
  await page.waitForFunction(expectChoices=>window.LeadFunnel?.privacyState().loading===false&&(!expectChoices||document.querySelector('[data-privacy-choices]')),!policyUnavailable);
  return {page,context,db,requests,url,config,env:{DB:db,SESSION_SECRET:'synthetic-private-session-secret-32-characters'},dropNextLead:()=>{dropLead=true;}};
}
const visitCount=f=>f.requests.filter(row=>row.path==='/api/visits').length;
async function openChoices(page){await page.locator('[data-privacy-choices]').click();await page.locator('[data-funnel-privacy-dialog]').waitFor({state:'visible'});}
async function submit(page){await page.locator('[data-open-modal]').first().click();await fillSteps(page,fixture);await page.locator('[data-submit]').click();}

for(const [name,engine,width] of [['Chromium desktop',chromium,1440],['WebKit mobile',webkit,390]]) {
  test(name+': decline, reopen, accept, withdraw, reload and submit without optional data',async t=>{
    const f=await site(t,{engine,width});const {page}=f;assert.equal(visitCount(f),0);assert.equal(await page.evaluate(()=>Object.values({...sessionStorage}).some(value=>value.includes('synthetic-click'))),false);
    await page.locator('[data-analytics-consent="decline"]').click();await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-consent-banner]').isVisible(),false);assert.equal(visitCount(f),0);
    await openChoices(page);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-privacy-choices]').evaluate(el=>el===document.activeElement),true);
    await openChoices(page);
    for(const key of ['Tab','Shift+Tab'])for(let i=0;i<10;i++){await page.keyboard.press(key);assert.equal(await page.locator('[data-funnel-privacy-dialog]').evaluate(el=>el.contains(document.activeElement)),true);}
    if(process.env.PRIVACY_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.PRIVACY_SCREENSHOT_DIR,name.split(' ')[0].toLowerCase()+'-privacy.png')});
    await page.locator('[data-privacy-allow]').click();await page.waitForFunction(async()=>!!(await LeadFunnel.context()).visit_event_id);
    const prior=await page.evaluate(()=>JSON.parse(localStorage.getItem('funnel_v2_visitor_id')));assert.ok(prior);
    await openChoices(page);await page.locator('[data-privacy-decline]').click();
    assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('funnel_v2_visitor_id'),sessionStorage.getItem('funnel_v2_first_touch'),sessionStorage.getItem('funnel_v2_latest_touch')]),[null,null,null]);
    await page.reload({waitUntil:'networkidle'});assert.equal(visitCount(f),1);
    await submit(page);await page.waitForURL('**/thank-you.html');
    const lead=await f.db.prepare('SELECT * FROM leads').first();assert.ok(lead);assert.deepEqual(JSON.parse(lead.attribution),{first_touch:{},latest_touch:{}});assert.equal(lead.traffic_source,'unknown');assert.equal(lead.visit_event_id,null);
    await page.goto(f.url+'/privacy.html',{waitUntil:'networkidle'});await openChoices(page);assert.equal(await page.locator('[data-privacy-decline]').isVisible(),true);assert.equal(visitCount(f),1);
  });
}

test('withdrawal propagates to another tab and no later optional events are emitted',async t=>{
  const f=await site(t);await f.page.locator('[data-analytics-consent="accept"]').click();const original=await f.page.evaluate(()=>LeadFunnel.context());
  const second=await f.context.newPage();await second.goto(f.url,{waitUntil:'networkidle'});await second.evaluate(()=>LeadFunnel.context());
  await openChoices(f.page);await f.page.locator('[data-privacy-decline]').click();
  await second.waitForFunction(()=>LeadFunnel.hasConsent()===false);
  const count=visitCount(f);await second.evaluate(()=>LeadFunnel.accepted({ok:true,lead_id:'synthetic',receipt_id:'synthetic'}));
  assert.equal(await second.evaluate(()=>window.dataLayer?.length||0),0);assert.equal(visitCount(f),count);
  assert.equal(await second.evaluate(()=>localStorage.getItem('funnel_v2_visitor_id')),null);
  await openChoices(f.page);await f.page.locator('[data-privacy-allow]').click();await second.waitForFunction(()=>LeadFunnel.hasConsent()===true);
  const firstContext=await f.page.evaluate(()=>LeadFunnel.context()),secondContext=await second.evaluate(()=>LeadFunnel.context());
  assert.equal(firstContext.visitor_id,secondContext.visitor_id,'Open tabs share the renewed browser identity');
  assert.notEqual(firstContext.visitor_id,original.visitor_id,'Regrant does not resurrect the withdrawn identity');
  assert.notEqual(firstContext.visit_event_id,secondContext.visit_event_id,'Each page visit retains its own event');
  await submit(f.page);await f.page.waitForURL('**/thank-you.html');await submit(second);await second.waitForURL('**/thank-you.html');
  const leads=await f.db.prepare('SELECT visit_event_id FROM leads').all();assert.deepEqual(leads.results.map(row=>row.visit_event_id).sort(),[firstContext.visit_event_id,secondContext.visit_event_id].sort());
  const visits=await f.db.prepare('SELECT COUNT(*) AS visits,COUNT(DISTINCT visitor_hash) AS browsers FROM visit_events').first();assert.deepEqual(visits,{visits:4,browsers:2});
});

test('a lost accepted response retries after withdrawal without new contact or optional payload',async t=>{
  const f=await site(t);await f.page.locator('[data-analytics-consent="accept"]').click();await f.page.evaluate(()=>LeadFunnel.context());f.dropNextLead();
  await submit(f.page);await f.page.locator('[data-form-error]').waitFor({state:'visible'});
  await f.page.locator('[data-close-modal]').click();await openChoices(f.page);await f.page.locator('[data-privacy-decline]').click();
  await f.page.locator('[data-open-modal]').first().click();await f.page.locator('[data-submit]').click();await f.page.waitForURL('**/thank-you.html');
  const sent=f.requests.filter(row=>row.path==='/api/leads');assert.equal(sent.length,2);assert.equal(sent[0].body.idempotency_key,sent[1].body.idempotency_key);
  assert.equal(sent[1].body.analytics_consent,false);assert.equal(sent[1].body.attribution_consent,false);assert.equal(sent[1].body.visitor_id,'');assert.deepEqual(sent[1].body.attribution,{first_touch:{},latest_touch:{}});
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);assert.equal(visitCount(f),1);
});

test('browser privacy signals override both modes and forms still deliver',async t=>{
  const f=await site(t,{analyticsMode:'essential',attributionMode:'lead',privacySignal:true});assert.equal(visitCount(f),0);await openChoices(f.page);
  assert.equal(await f.page.locator('[data-privacy-allow]').isEnabled(),false);await f.page.keyboard.press('Escape');await submit(f.page);await f.page.waitForURL('**/thank-you.html');
  const lead=await f.db.prepare('SELECT * FROM leads').first();assert.equal(lead.traffic_source,'unknown');assert.deepEqual(JSON.parse(lead.attribution),{first_touch:{},latest_touch:{}});
});

test('configured independent lead attribution is visible and retained without optional measurement',async t=>{
  const f=await site(t,{attributionMode:'lead'});await f.page.locator('[data-analytics-consent="decline"]').click();await openChoices(f.page);
  assert.match(await f.page.locator('.funnel-privacy-detail').first().textContent(),/independently/);await f.page.keyboard.press('Escape');await submit(f.page);await f.page.waitForURL('**/thank-you.html');
  const lead=await f.db.prepare('SELECT * FROM leads').first();assert.equal(lead.gclid,undefined);assert.equal(JSON.parse(lead.attribution).latest_touch.gclid,'synthetic-click');assert.equal(lead.traffic_source,'google');assert.equal(lead.visit_event_id,null);assert.equal(visitCount(f),0);
});

test('server policy strips forbidden metadata and withdrawal cookies override stale consent bodies',async t=>{
  const f=await site(t,{analyticsMode:'essential'});
  const body=()=>({idempotency_key:crypto.randomUUID(),form_name:'enquiry',form_data:form,landing_page:'/',referrer:'https://referrer.example/path',attribution:{first_touch:{gclid:'synthetic-click'},latest_touch:{gclid:'synthetic-click'}},visitor_id:crypto.randomUUID(),analytics_consent:true,attribution_consent:true});
  for(const [policy,headers,expected] of [['consent',{},'google'],['consent',{'Cookie':'funnel_privacy_choice=deny'},'unknown'],['lead',{'DNT':'1'},'unknown'],['lead',{'Sec-GPC':'1'},'unknown'],['disabled',{},'unknown']]) {
    const config={...f.config,attributionMode:policy},request=new Request(f.url+'/api/leads',{headers:{'User-Agent':'Desktop Chrome',...headers}});
    const result=await createLead(f.env,request,body(),config);const row=await f.db.prepare('SELECT * FROM leads WHERE id=?').bind(result.lead_id).first();assert.equal(row.traffic_source,expected);
    if(expected==='unknown'){assert.equal(serializeLead(row).source,'unknown');assert.deepEqual(JSON.parse(row.attribution),{first_touch:{},latest_touch:{}});assert.equal(row.referrer,'');}
  }
  const denied=new Request(f.url+'/api/visits',{headers:{Cookie:'funnel_privacy_choice=deny'}});
  assert.equal((await recordVisit(f.env,denied,{event_id:crypto.randomUUID(),visitor_id:crypto.randomUUID(),analytics_consent:true,path:'/'},f.config)).measured,false);
});


test('legacy submission fingerprints retain the original receipt after withdrawal but reject edited contact fields',async t=>{
  const f=await site(t,{attributionMode:'lead'});
  const request=new Request(f.url+'/api/leads');const body={idempotency_key:crypto.randomUUID(),form_name:'enquiry',form_data:form,landing_page:'/',attribution:{first_touch:{gclid:'old-click'},latest_touch:{gclid:'old-click'}},attribution_consent:true};
  const original=await createLead(f.env,request,body,f.config);
  // Existing releases used a different hash that included optional attribution.
  await f.db.prepare('UPDATE leads SET payload_hash=? WHERE id=?').bind('a'.repeat(64),original.lead_id).run();
  const retry={...body,attribution_consent:false,attribution:{first_touch:{},latest_touch:{}},referrer:''};
  const saved=await createLead(f.env,request,retry,f.config);assert.equal(saved.receipt_id,original.receipt_id);assert.equal(saved.duplicate,true);
  const row=await f.db.prepare('SELECT attribution FROM leads WHERE id=?').bind(original.lead_id).first();assert.equal(JSON.parse(row.attribution).latest_touch.gclid,'old-click');
  await assert.rejects(createLead(f.env,request,{...retry,form_data:{...form,first_name:'Changed'}},f.config),error=>error.status===409);
});


test('unavailable privacy settings do not prevent real lead delivery',async t=>{
  const f=await site(t,{policyUnavailable:true});
  assert.equal(await f.page.locator('[data-consent-banner]').isVisible(),false);
  assert.equal(await f.page.locator('[data-privacy-choices]').isVisible(),false);
  await submit(f.page);await f.page.waitForURL('**/thank-you.html');
  assert.equal(visitCount(f),0);const row=await f.db.prepare('SELECT attribution,traffic_source FROM leads').first();assert.equal(row.traffic_source,'unknown');assert.deepEqual(JSON.parse(row.attribution),{first_touch:{},latest_touch:{}});
});


test('banner describes measurement already enabled by policy and does not offer disabled campaign capture',async t=>{
  const enabled=await site(t,{analyticsMode:'essential'});
  assert.match(await enabled.page.locator('[data-consent-banner]').textContent(),/measurement is on/);
  const context=await enabled.page.evaluate(()=>LeadFunnel.context());assert.equal(context.analytics_consent,true);assert.equal(context.attribution_consent,false);
  await enabled.page.locator('[data-analytics-consent="decline"]').click();await enabled.page.reload({waitUntil:'networkidle'});assert.equal(visitCount(enabled),1);
  const disabled=await site(t,{attributionMode:'disabled'});assert.match(await disabled.page.locator('[data-consent-banner]').textContent(),/Campaign details are not saved/);
});
