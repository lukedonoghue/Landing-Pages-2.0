// Local-only functional proof: browser -> Worker -> D1 -> CRM -> daily metrics.
import {chromium} from 'playwright-core';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const args=process.argv.slice(2), opt=k=>args[args.indexOf(k)+1];
for(const key of ['--url','--fixture','--password-file','--browser-executable'])if(!args.includes(key))throw new Error(`Missing ${key}`);
const base=new URL(opt('--url'));
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw new Error('This test creates synthetic leads and is restricted to a local development database.');
const fixture=JSON.parse(readFileSync(opt('--fixture'),'utf8'));
const out=path.resolve(args.includes('--out')?opt('--out'):'build/functional');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:opt('--browser-executable'),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const failures=[];page.on('pageerror',error=>failures.push(error.message));
let receipt;
await page.route("**/api/leads", async route => { const response=await route.fetch(); const body=await response.body(); receipt=JSON.parse(body.toString()); await route.fulfill({response,body}); });
try{
  const unauthorized=await context.request.get(new URL('/api/admin/leads',base).href);assert.equal(unauthorized.status(),401);
  await page.goto(base.href,{waitUntil:'networkidle'});
  const consent=page.locator('[data-analytics-consent="accept"]');if(await consent.isVisible())await consent.click();
  await page.locator('[data-open-modal]').first().click();
  for(let step=0;step<20;step++){
    const current=page.locator('.wizard__step:not([hidden])');
    for(const field of await current.locator('input[name],select[name],textarea[name]').all()){
      const name=await field.getAttribute('name');if(!(name in fixture))continue;
      const type=await field.getAttribute('type');const tag=await field.evaluate(el=>el.tagName);
      if(tag==='SELECT')await field.selectOption(String(fixture[name]));
      else if(type==='radio'){if(await field.getAttribute('value')===String(fixture[name]))await field.check();}
      else if(type==='checkbox')await field.setChecked(Boolean(fixture[name]));
      else await field.fill(String(fixture[name]));
    }
    const next=page.locator('[data-next]');if(!await next.isVisible())break;await next.click();
  }
  await page.screenshot({path:path.join(out,'modal.png')});
  const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/leads',{timeout:20000});
  await page.locator('[data-submit]').click();const response=await submitted;
  assert.ok(response.ok(),`Lead API rejected fixture: ${JSON.stringify(receipt)}`);assert.equal(receipt.ok,true);assert.ok(receipt.receipt_id);assert.ok(receipt.lead_id);
  await page.waitForURL('**/thank-you*');await page.screenshot({path:path.join(out,'thank-you.png')});
  const pdfLink=page.locator('a[href$=".pdf"]').first();
  const pdf=await context.request.get(new URL(await pdfLink.getAttribute('href'),page.url()).href);
  assert.ok(pdf.ok());assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
  await page.goto(new URL('/login.html',base).href);
  if(await page.locator('#username').count())await page.locator('#username').fill(args.includes('--username')?opt('--username'):'owner');
  await page.locator('#password').fill(readFileSync(opt('--password-file'),'utf8').trim());
  await page.locator('#login-form').evaluate(form=>form.requestSubmit());
  await page.waitForURL('**/admin/');await page.locator('#metric-cards').waitFor({state:'visible'});
  const detail=(await (await context.request.get(new URL('/api/admin/leads/'+receipt.lead_id,base).href)).json());
  assert.equal(detail.lead.id,receipt.lead_id);assert.equal(detail.lead.receipt_id,receipt.receipt_id);
  const metrics=await (await context.request.get(new URL('/api/admin/metrics',base).href)).json();
  assert.ok(metrics.totals.leads>=1);assert.ok(metrics.totals.visitors>=1);assert.ok(metrics.totals.conversions>=1);assert.ok(metrics.totals.conversion_rate<=100);
  await page.screenshot({path:path.join(out,'crm-overview-desktop.png'),fullPage:true});
  await page.locator('[data-view="pipeline"]').click();
  const stage=page.locator(`[data-lead-stage="${receipt.lead_id}"]`).first();await stage.waitFor();
  const moved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/leads/'+receipt.lead_id&&r.request().method()==='PATCH');
  await stage.selectOption('qualified');assert.ok((await moved).ok());
  await page.locator(`[data-open-lead="${receipt.lead_id}"]`).first().click();
  await page.locator('#new-note').fill('Local verification: discussed scope and next steps.');
  const noted=page.waitForResponse(r=>r.url().endsWith('/notes')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save note',exact:true}).click();assert.ok((await noted).ok());
  const updated=await (await context.request.get(new URL('/api/admin/leads/'+receipt.lead_id,base).href)).json();
  assert.equal(updated.lead.status,'qualified');assert.ok(updated.notes.some(n=>n.body.includes('Local verification')));
  await page.screenshot({path:path.join(out,'crm-detail.png')});await page.locator('#close-detail').click();
  await page.screenshot({path:path.join(out,'crm-pipeline-desktop.png'),fullPage:true});
  await page.locator('[data-view=leads]').click();
  await page.locator('#lead-table').waitFor({state:'visible'});
  assert.ok((await page.locator('#lead-table th').allTextContents()).includes('Landing page'));
  await page.screenshot({path:path.join(out,'crm-table-desktop.png'),fullPage:true});
  await page.locator('[data-view=pipeline]').click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'crm-pipeline-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'CRM has page-level mobile overflow');
  await page.locator('[data-view="overview"]').click();await page.screenshot({path:path.join(out,'crm-overview-mobile.png'),fullPage:true});
  await page.locator('#logout').click();await page.waitForURL(url => /^\/login(?:\.html)?\/?$/.test(url.pathname));
  assert.equal((await context.request.get(new URL('/api/admin/leads',base).href)).status(),401);
  assert.deepEqual(failures,[]);
  const report={status:'pass',tested_at:new Date().toISOString(),url:base.href,mode:'local-d1',receipt_id:receipt.receipt_id,lead_id:receipt.lead_id,checks:['unauthorized access','browser form','stored receipt','brochure response','login','CRM status','note persistence','visitor/conversion metrics','responsive admin','logout revocation'],metrics:metrics.totals};
  writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
