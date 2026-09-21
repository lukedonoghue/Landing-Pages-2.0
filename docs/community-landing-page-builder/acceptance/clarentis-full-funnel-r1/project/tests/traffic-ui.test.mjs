import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const chrome=[process.env.CHROME_BIN,chromium.executablePath()].find(p=>p&&existsSync(p));
let browser,server,origin;const requests=[];
const campaign = {utm_source:'google',utm_medium:'cpc',utm_campaign:'synthetic-private-campaign',utm_id:'campaign-123',utm_term:'test term',utm_content:'test content',utm_source_platform:'test-platform',utm_creative_format:'test-format',utm_marketing_tactic:'test-tactic',gclid:'synthetic-click-'+ 'x'.repeat(450),dclid:'display-test',gbraid:'gbraid-test',wbraid:'wbraid-test',fbclid:'meta-test',msclkid:'microsoft-test',ttclid:'tiktok-test'};
const fixtureLead = {id:'demo-lead',name:'Test Enquiry',email:'test@example.invalid',phone:'+44 7700 900123',status:'new',version:1,created_at:'2026-09-21T08:00:00Z',traffic_source:'google',traffic_type:'paid',...campaign,landing_page:'/paid-campaign/',form_data:{service:'Synthetic service'},attribution:{first_touch:{...campaign,utm_campaign:'first-test-campaign'},latest_touch:campaign}};
before(async()=>{
 if(!chrome)return;
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');res.setHeader('Content-Type','application/json');
  if(url.pathname==='/api/admin/config'){res.end(JSON.stringify({brand:{name:'Traffic filter fixture'},timezone:'UTC',earliest_date:'2026-09-01'}));return;}
  if(url.pathname==='/api/admin/metrics'){
   requests.push(new URL(url));const google=url.searchParams.get('source')==='google';const all=url.searchParams.get('visitor_mode')==='all';const visitors=google?(all?12:8):(all?30:20),conversions=google?4:5;
   res.end(JSON.stringify({days:[{date:'2026-09-08',visitors,conversions,leads:conversions,conversion_rate:conversions/visitors*100}],totals:{visitors,conversions,leads:conversions},lifetime_totals:{visitors:visitors*10,conversions:conversions*10,leads:conversions*10},definition:'Fixture cohort',coverage:{warnings:[]}}));return;
  }
  if(url.pathname==='/api/admin/leads'){requests.push(new URL(url));res.end(JSON.stringify({leads:[fixtureLead],total:1,page:1,limit:100}));return;}
  if(url.pathname==='/api/admin/leads/demo-lead'){res.end(JSON.stringify({lead:fixtureLead,notes:[],activity:[]}));return;}
  try{const file=url.pathname==='/'?'index.html':url.pathname.replace(/^\/admin\//,'');if(!/^[a-z.-]+$/.test(file))throw new Error();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL(`../public/admin/${file}`,import.meta.url)));}catch{res.statusCode=404;res.end('{}');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:chrome,headless:true});
});
after(async()=>{await browser?.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));});
const options={skip:!chrome?'Set CHROME_BIN to run filter interface checks.':false};
async function pageAt(width=1440){const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(5000);await page.goto(origin);await page.locator('#metric-cards').waitFor({state:'visible'});return page;}
test('combined traffic filters reach API together and update totals, table and selected summary',options,async()=>{
 const page=await pageAt();try{
  await page.locator('#filter-trigger').click();
  await page.locator('[data-filter=visitor_mode][data-value=all]').click();
  await page.locator('[data-filter=device][data-value=mobile]').click();
  await page.locator('[data-filter=traffic][data-value=paid]').click();
  const loaded=page.waitForResponse(r=>r.url().includes('/api/admin/metrics?')&&r.url().includes('source=google'));
  await page.locator('#traffic-source').selectOption('google');await loaded;await page.locator('#metric-cards').waitFor({state:'visible'});
  const sent=requests.filter(u=>u.pathname.endsWith('/metrics')).at(-1).searchParams;
  assert.equal(sent.get('source'),'google');assert.equal(sent.get('traffic'),'paid');assert.equal(sent.get('device'),'mobile');assert.equal(sent.get('visitor_mode'),'all');
  assert.match(await page.locator('#filter-summary').textContent(),/All visits.*Mobile.*Paid traffic.*Google/);
  assert.match(await page.locator('.metric-card').nth(2).textContent(),/33.3%/);
  assert.match(await page.locator('.metric-card').first().textContent(),/120 all time/);
  assert.equal(await page.locator('#filter-count').textContent(),'4');
  await page.locator('#reset-filters').click();await page.locator('#metric-cards').waitFor({state:'visible'});
  assert.equal(await page.locator('#filter-count').isHidden(),true);assert.equal(await page.locator('#traffic-source').inputValue(),'all');
 }finally{await page.close();}
});
test('Count/Rate toggle changes accessible chart without requerying and the tooltip is keyboard accessible',options,async()=>{
 const page=await pageAt();try{
  const count=requests.length;await page.locator('[data-chart-mode=rate]').click();
  assert.equal(await page.locator('[data-chart-mode=rate]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#activity-chart svg title').textContent(),/conversion rate/i);
  await page.locator('#activity-chart svg').focus();await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#activity-chart').textContent(),/25.0%/);assert.equal(requests.length,count);
  await page.locator('[data-chart-mode=count]').click();assert.match(await page.locator('#activity-chart svg title').textContent(),/visitors.*conversions/i);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#activity-chart svg').viewBox.baseVal.width <= 390);
  assert.ok(Number(await page.locator('#activity-chart svg text').first().evaluate(el=>getComputedStyle(el).fontSize.replace('px',''))) >= 10);
 }finally{await page.close();}
});
test('CRM lead source filtering is independent from performance filters',options,async()=>{
 const page=await pageAt();try{
  await page.locator('[data-view=leads]').click();await page.locator('#lead-table').waitFor({state:'visible'});
  const loaded=page.waitForResponse(r=>r.url().includes('/api/admin/leads?')&&r.url().includes('source=facebook'));
  await page.locator('#lead-source').selectOption('facebook');await loaded;
  assert.equal(requests.filter(u=>u.pathname.endsWith('/leads')).at(-1).searchParams.get('source'),'facebook');
  await page.locator('[data-view=overview]').click();assert.equal(await page.locator('#traffic-source').inputValue(),'all');
 }finally{await page.close();}
});
test('filter and date popovers remain usable at narrow mobile widths, with Escape and outside dismissal',options,async()=>{
 const page=await pageAt(360);try{
  await page.locator('#filter-trigger').click();let box=await page.locator('#filter-popover').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360&&box.y+box.height<=900);
  await page.locator('#traffic-source').selectOption('facebook');assert.equal(await page.locator('#filter-popover').isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#filter-popover').isHidden(),true);assert.equal(await page.locator('#filter-trigger').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-range-trigger]').click();box=await page.locator('[data-range-popover]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360);
  await page.locator('#filter-trigger').click();assert.equal(await page.locator('[data-range-popover]').isHidden(),true);
  await page.locator('#page-title').click();assert.equal(await page.locator('#filter-popover').isHidden(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await page.close();}
});
test('source labels keep paid and organic meanings without guessing Meta clicks are ads',options,async()=>{
 const page=await pageAt();try{
  const cases=[['google','paid','cpc','Google CPC'],['google','paid','','Google Paid'],['google','organic','organic','Google Organic'],['facebook','paid','paid_social','Meta Paid Social'],['facebook','unknown','','Meta'],['microsoft','paid','cpc','Microsoft CPC'],['direct','other','','Direct'],['unknown','unknown','','Unknown']];
  await page.route('**/api/admin/leads?*',route=>route.fulfill({json:{leads:cases.map(([source,type,medium],i)=>({...fixtureLead,id:String(i),traffic_source:source,traffic_type:type,utm_medium:medium,attribution:{latest_touch:{utm_source:source,utm_medium:medium}}})),total:cases.length,page:1,limit:100}}));
  await page.locator('[data-view=leads]').click();await page.locator('#lead-table tbody tr').nth(cases.length-1).waitFor();
  assert.deepEqual(await page.locator('#lead-table tbody tr td:nth-child(4)').allTextContents(),cases.map(row=>row[3]));
 }finally{await page.close();}
});
test('lead list shows one source while full campaign fields remain in expandable submission details',options,async()=>{
 for(const width of [1440,390,320]){
  const page=await pageAt(width);try{
   await page.locator('[data-view=leads]').click();await page.locator('#lead-table tbody tr').waitFor();
   assert.deepEqual(await page.locator('#lead-table th').allTextContents(),['Contact','Phone','Stage','Source','Received']);
   assert.equal(await page.locator('#lead-table tbody td').nth(3).textContent(),'Google CPC');
   const table=await page.locator('#lead-table').textContent();
   for(const value of [campaign.utm_campaign,campaign.gclid,fixtureLead.landing_page,fixtureLead.form_data.service])assert.ok(!table.includes(value));
   if(process.env.QA_ARTIFACT_DIR){await mkdir(process.env.QA_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:join(process.env.QA_ARTIFACT_DIR,`crm-leads-${width}.png`)});}
   await page.locator('#lead-table [data-open-lead]').click();
   await page.locator('#lead-dialog .attribution-group').first().waitFor();
   assert.equal(await page.locator('.attribution-group[open]').count(),0);
   const latest=page.locator('.attribution-group').filter({has:page.locator('summary',{hasText:'Latest touch'})});
   await latest.locator('summary').focus();await page.keyboard.press('Enter');
   assert.equal(await latest.getAttribute('open'),'');
   for(const [key,value]of Object.entries(campaign)){
    const row=latest.locator('.detail-fields>div').filter({has:page.locator('dt',{hasText:new RegExp(`^${key}$`)})});
    assert.equal(await row.locator('dd').textContent(),value);
   }
   assert.equal(await page.locator('#lead-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   const box=await page.locator('#lead-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
   if(process.env.QA_ARTIFACT_DIR){await mkdir(process.env.QA_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:join(process.env.QA_ARTIFACT_DIR,`crm-attribution-${width}.png`)});}
   await latest.locator('dt').filter({hasText:/^gclid$/}).scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#lead-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   if(process.env.QA_ARTIFACT_DIR)await page.screenshot({path:join(process.env.QA_ARTIFACT_DIR,`crm-click-ids-${width}.png`)});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#lead-dialog').isVisible(),false);
  }finally{await page.close();}
 }
});
