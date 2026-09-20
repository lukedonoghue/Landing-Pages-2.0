import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={status:'running',mode:'intercepted synthetic requests only',checks:[],validation:[],images:[]};
const check=(id,name,value)=>{assert.ok(value,name);report.checks.push({id,name,pass:true});};
const base='http://127.0.0.1:4175/';
let calls=0,mode='held',held,sent;
const receipt=route=>({status:'preview-confirmed',requestId:route.request().postDataJSON().requestId});
try {
  const p=await browser.newPage({viewport:{width:390,height:844}});
  await p.route('**/api/enquiries',async route=>{
    calls++;sent=route.request().postDataJSON();
    if(mode==='held'||mode==='timeout'){held=route;return;}
    if(mode==='failure')return route.fulfill({status:503,body:'{}'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(receipt(route))});
  });
  await p.goto(base,{waitUntil:'networkidle'});
  await p.locator('#name').fill('  Synthetic Parent  ');await p.locator('#email').fill('parent@example.test');await p.locator('#message').fill('A synthetic garden office enquiry.');await p.locator('#phone').fill('garbage1234567');
  await p.locator('#submit-button').click();
  check('C06','Mixed phone junk rejected without a request',calls===0&&await p.locator('#phone').getAttribute('aria-invalid')==='true');
  await p.locator('#validation-summary a').focus();await p.keyboard.press('Enter');
  check('C05','Keyboard error link reaches actual phone control',await p.evaluate(()=>document.activeElement.id==='phone'));
  await p.locator('#phone').fill('+44 7700 900123 ext. 4');
  await p.evaluate(()=>{const f=document.querySelector('#enquiry-form');f.requestSubmit();f.requestSubmit();});await p.waitForTimeout(200);
  check('C01','One pending request with trimmed submitted snapshot',calls===1&&sent.name==='Synthetic Parent'&&sent.phone==='+44 7700 900123 ext. 4');
  check('C01','Pending fields locked',await p.locator('#name').isDisabled());
  await p.locator('.hero [data-primary-action]').click();
  check('C01','Returning via CTA retains pending state',await p.locator('#name').isDisabled()&&calls===1);
  await held.fulfill({status:200,contentType:'application/json',body:JSON.stringify(receipt(held))});await p.locator('#form-success').waitFor({state:'visible'});
  await p.locator('.hero [data-primary-action]').click();
  check('C02','Confirmed state retained on CTA return',await p.locator('#enquiry-form').isHidden()&&calls===1);
  await p.locator('#enquiry-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await p.waitForTimeout(100);
  check('C02','Confirmed handler rejects a repeated submit event',calls===1);
  const panel=await p.locator('#form-success').boundingBox();
  check('C07','Compact and plain preview confirmation',panel.height<350&&(await p.locator('#form-success').innerText()).includes('Your details were not sent'));
  await p.locator('#form-success').screenshot({path:new URL('success.png',import.meta.url).pathname});
  await p.locator('#new-enquiry').click();check('C02','Deliberate reset clears prior details',await p.locator('#name').inputValue()==='');
  await p.locator('#name').fill('Synthetic Retry');await p.locator('#email').fill('retry@example.test');await p.locator('#message').fill('Synthetic retry context.');
  mode='failure';await p.locator('#submit-button').click();await p.locator('#form-status').waitFor({state:'visible'});
  check('C03','Failure preserves entries and permits deliberate recovery',await p.locator('#name').inputValue()==='Synthetic Retry'&&await p.locator('#submit-button').isEnabled());
  mode='timeout';await p.locator('#submit-button').click();await p.locator('#form-status').waitFor({state:'visible',timeout:10000});
  check('C03','Actual deadline produces uncertainty without auto retry',calls===3&&(await p.locator('#form-status').innerText()).includes('could not confirm what happened'));
  await held.fulfill({status:200,contentType:'application/json',body:JSON.stringify(receipt(held))}).catch(()=>{});await p.waitForTimeout(100);
  check('C01','Late aborted response cannot confirm',await p.locator('#form-success').isHidden());
  mode='success';await p.locator('#submit-button').click();await p.locator('#form-success').waitFor({state:'visible'});
  check('C03','Same-filled retry confirms only its own request',calls===4&&sent.name==='Synthetic Retry');
  await p.close();
  for(const viewport of [{width:390,height:844},{width:1280,height:600},{width:1440,height:900}])for(const fromCTA of [false,true]){
    const page=await browser.newPage({viewport});await page.goto(base,{waitUntil:'networkidle'});
    if(fromCTA){await page.locator('.hero [data-primary-action]').click();await page.waitForTimeout(1800);}
    await page.locator('#submit-button').click();await page.waitForTimeout(2200);
    const state=await page.evaluate(()=>({focus:document.activeElement.id,summary:document.querySelector('#validation-summary').getBoundingClientRect().toJSON(),label:document.querySelector('label[for=name]').getBoundingClientRect().toJSON()}));
    report.validation.push({viewport,fromCTA,...state});
    check('R2-01',`Visible settled summary ${viewport.width}px ${fromCTA?'CTA':'direct'}`,state.focus==='validation-summary'&&state.summary.top>=7&&state.summary.bottom<=viewport.height-7);
    if(viewport.width===1440&&!fromCTA)await page.screenshot({path:new URL('desktop-validation.png',import.meta.url).pathname});
    await page.locator('#validation-summary a[href="#name"]').focus();await page.keyboard.press('Enter');await page.waitForTimeout(150);
    check('R2-01',`Name group context visible after error link ${viewport.width}px`,await page.locator('#name').evaluate(e=>{const b=e.closest('.field').getBoundingClientRect();return document.activeElement===e&&b.top>=7&&b.bottom<=innerHeight-7;}));
    await page.close();
  }
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:800},{width:1280,height:600},{width:1440,height:900}]){
    const page=await browser.newPage({viewport});await page.goto(base,{waitUntil:'networkidle'});
    for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode().catch(()=>{}));}
    const images=await page.locator('img').evaluateAll(items=>items.map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0,naturalWidth:i.naturalWidth,width:i.getBoundingClientRect().width})));
    report.images.push({viewport,images});check('C08/C10',`All placements loaded ${viewport.width}px`,images.every(i=>i.loaded));await page.close();
  }
  report.limits=['No modal or required grouped field: exact Stayclean variants remain untested.','No production storage/delivery/idempotency verified.'];report.status='pass';
}catch(error){report.status='blocked';report.error=error.stack;process.exitCode=1;}
finally{await writeFile(new URL('parent-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}));
