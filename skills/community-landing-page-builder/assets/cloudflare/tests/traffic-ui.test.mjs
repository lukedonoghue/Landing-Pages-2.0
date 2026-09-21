import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const chrome=[process.env.CHROME_BIN,chromium.executablePath()].find(p=>p&&existsSync(p));
let browser,server,origin;const requests=[];
before(async()=>{
 if(!chrome)return;
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');res.setHeader('Content-Type','application/json');
  if(url.pathname==='/api/admin/config'){res.end(JSON.stringify({brand:{name:'Traffic filter fixture'},timezone:'UTC',earliest_date:'2026-09-01'}));return;}
  if(url.pathname==='/api/admin/metrics'){
   requests.push(new URL(url));const google=url.searchParams.get('source')==='google';const all=url.searchParams.get('visitor_mode')==='all';const visitors=google?(all?12:8):(all?30:20),conversions=google?4:5;
   res.end(JSON.stringify({days:[{date:'2026-09-08',visitors,conversions,leads:conversions,conversion_rate:conversions/visitors*100}],totals:{visitors,conversions,leads:conversions},lifetime_totals:{visitors:visitors*10,conversions:conversions*10,leads:conversions*10},definition:'Fixture cohort',coverage:{warnings:[]}}));return;
  }
  if(url.pathname==='/api/admin/leads'){requests.push(new URL(url));res.end(JSON.stringify({leads:[],total:0,page:1,limit:100}));return;}
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
