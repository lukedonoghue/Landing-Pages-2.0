/** Real browser/controller UI checks with explicitly stubbed provider operations.
 * This proves navigation and UI security, not a live deployment. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright-core';
for(const [name,engine] of Object.entries({chromium,webkit})){
 test(`guided publisher runs from inputs to receipt in ${name}`,{timeout:90000},async t=>{
  if(!existsSync(engine.executablePath())){t.skip('Install supported browsers before release validation');return;}
  const server=spawn(process.env.PYTHON||'python3',[fileURLToPath(new URL('./fixtures/ship-ui-server.py',import.meta.url))],{stdio:['ignore','pipe','pipe']});
  let browser;const errors=[],outside=[];
  const dir=fileURLToPath(new URL(`../build/ship-ui-review/${name}/`,import.meta.url));
  try{
   const start=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Wizard fixture did not start')),20000);const lines=createInterface({input:server.stdout});lines.once('line',line=>{clearTimeout(timer);try{resolve(JSON.parse(line));}catch{reject(new Error('Invalid wizard response'));}});server.once('error',reject);server.once('exit',()=>{clearTimeout(timer);reject(new Error('Wizard fixture exited'));});});
   assert.equal(start.scope,'UI test only; provider calls stubbed; no deployment');
   const parsed=new URL(start.url),token=parsed.hash.slice(1);browser=await engine.launch({headless:true});
   const page=await browser.newPage({viewport:{width:390,height:844}});
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(parsed.origin+'/'))outside.push(r.url());});
   await mkdir(dir,{recursive:true});await page.goto(start.url);await page.getByLabel('Your website domain').waitFor();
   assert.equal(page.url(),parsed.origin+'/');assert.equal(await page.getByLabel('Also send enquiries to Google Sheets (optional)').isChecked(),false);
   await page.getByLabel('Your website domain').fill('landing.example.org');await page.getByLabel('CRM owner email').fill('owner@example.org');
   for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:dir+`inputs-${width}.png`,fullPage:true});}
   await page.getByRole('button',{name:'Check my setup',exact:true}).click();await page.getByRole('button',{name:'Prepare this site',exact:true}).waitFor();
   await page.reload();await page.getByRole('button',{name:'Prepare this site',exact:true}).waitFor();
   await page.getByRole('button',{name:'Prepare this site',exact:true}).click();await page.getByRole('button',{name:'Confirm and continue',exact:true}).waitFor();
   await page.getByRole('button',{name:'Confirm and continue',exact:true}).click();await page.getByRole('alert').waitFor({state:'visible'});assert.match(await page.getByRole('alert').innerText(),/confirm/);
   for(const id of ['mfa','privacy','trusted_host'])await page.locator('#'+id).check();
   await page.getByRole('button',{name:'Confirm and continue',exact:true}).click();await page.getByRole('button',{name:'Publish and verify',exact:true}).waitFor();
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:dir+'approval-390.png',fullPage:true});
   await page.getByRole('button',{name:'Publish and verify',exact:true}).click();await page.getByRole('heading',{name:'Your published page is verified',exact:true}).waitFor();
   await page.screenshot({path:dir+'receipt-390.png',fullPage:true});
   const status=await page.request.get(parsed.origin+'/api/status',{headers:{Authorization:'Bearer '+token}});assert.equal(status.status(),200);const result=await status.json();
   assert.equal(result.workflow.stage,'ready');assert.equal(result.workflow.receipt.intent.sheets,false);assert.equal(result.workflow.receipt.requirements.find(x=>x.id==='account_mfa').automatically_verified,false);
   assert.equal((await page.request.get(parsed.origin+'/api/status')).status(),403);
   assert.equal((await page.request.get(parsed.origin+'/.secrets/production.json',{headers:{Authorization:'Bearer '+token}})).status(),404);
   assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
   await writeFile(dir+'result.json',JSON.stringify({status:'pass',scope:start.scope,engine:name,viewports:[320,390,1440],resume_verified:true,unconfirmed_approval_rejected:true,receipt_verified:true,no_external_requests:true,page_errors:errors},null,2));
  }finally{await browser?.close();server.kill('SIGTERM');}
 });
}
