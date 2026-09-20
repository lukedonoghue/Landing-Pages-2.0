import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base = 'http://127.0.0.1:4176/';
const report = {status:'running',mode:'synthetic browser adapter only, no live leads',checks:[],viewports:[]};
const check = (id,name,value,detail) => {report.checks.push({id,name,pass:!!value,detail});};
const viewports = [{width:390,height:844},{width:768,height:1024},{width:1024,height:800},{width:1280,height:600},{width:1440,height:900}];
async function fill(page, name='Synthetic Parent') {
  await page.locator('#enquiry-name').fill(name);
  await page.locator('#enquiry-email').fill('qa@example.test');
  await page.locator('#enquiry-phone').fill('+44 7700 900123 ext. 4');
  await page.locator('#enquiry-message').fill('Synthetic local enquiry. Nothing to send.');
}
try {
  for(const viewport of viewports) {
    const page=await browser.newPage({viewport,reducedMotion:'no-preference'});
    await page.goto(base,{waitUntil:'networkidle'});
    const phone=await page.locator('header a[href^="tel:"]').evaluateAll(items=>items.filter(e=>{
      const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight;
    }).map(e=>({text:e.innerText,href:e.getAttribute('href'),fontSize:getComputedStyle(e).fontSize})));
    check('R3-P03',`Phone near top ${viewport.width}`,phone.some(p=>p.text.includes('07803 362187')),phone);
    const openers=page.locator('[data-open-modal]');
    const count=await openers.count();
    for(let i=0;i<count;i++) {
      const opener=openers.nth(i);await opener.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
      const before=await page.evaluate(()=>({y:scrollY,hash:location.hash}));
      await opener.click();await page.waitForTimeout(100);
      const during=await page.evaluate(()=>({y:scrollY,hash:location.hash,open:document.querySelector('#enquiry-dialog').open}));
      await page.keyboard.press('Escape');await page.waitForTimeout(100);
      const after=await opener.evaluate(e=>({focus:document.activeElement===e,y:scrollY,hash:location.hash}));
      check('R3-P02',`CTA ${i+1} opens without jump and restores focus ${viewport.width}`,during.open&&during.hash===before.hash&&Math.abs(during.y-before.y)<=2&&after.focus&&Math.abs(after.y-before.y)<=2,{before,during,after});
    }
    await openers.first().click();
    await page.locator('#enquiry-message').focus();await page.locator('#submit-enquiry').click();await page.waitForTimeout(300);
    const validation=await page.locator('[data-field="name"]').evaluate(e=>{
      const r=e.getBoundingClientRect(),clip=e.closest('.form-scroll').getBoundingClientRect();
      return {focused:document.activeElement.id,top:r.top,bottom:r.bottom,clipTop:clip.top,clipBottom:clip.bottom};
    });
    check('C05',`Validation reveals full field context ${viewport.width}`,validation.focused==='enquiry-name'&&validation.top>=validation.clipTop&&validation.bottom<=validation.clipBottom,validation);
    await page.locator('#enquiry-name').fill('Synthetic Parent');
    check('C05',`Partial correction updates summary ${viewport.width}`,await page.locator('#error-summary li').count()===2);
    await page.locator('#error-summary a[href="#enquiry-email"]').focus();await page.keyboard.press('Enter');
    check('C05',`Error link focuses usable control ${viewport.width}`,await page.locator('#enquiry-email').evaluate(e=>document.activeElement===e));
    await page.keyboard.press('Escape');
    for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode().catch(()=>{}));}
    const images=await page.locator('img').evaluateAll(items=>items.map(e=>({src:e.currentSrc,loaded:e.complete&&e.naturalWidth>0,naturalWidth:e.naturalWidth,renderWidth:e.getBoundingClientRect().width})));
    check('C10',`All placed images decode ${viewport.width}`,images.every(i=>i.loaded),images);
    report.viewports.push({viewport,phone,validation,images});await page.close();
  }
  const page=await browser.newPage({viewport:viewports[0]});await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('.hero [data-open-modal]').click();await fill(page);
  await page.locator('#enquiry-phone').fill('garbage1234567');await page.locator('#submit-enquiry').click();
  check('C06','Mixed phone junk rejected',await page.locator('#enquiry-phone').getAttribute('aria-invalid')==='true');
  await page.locator('#enquiry-phone').fill('+44 7700 900123 ext. 4');
  await page.evaluate(()=>{window.__calls=0;window.GRC_LEAD_ADAPTER=data=>{window.__calls++;window.__submitted=data;return new Promise(resolve=>window.__resolve=resolve);};});
  await page.locator('#enquiry-form').evaluate(f=>{f.requestSubmit();f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>window.__calls===1);
  check('C01','One pending call and snapshot locked',await page.evaluate(()=>window.__calls===1&&document.querySelector('#form-fields').disabled&&window.__submitted.phone==='+44 7700 900123 ext. 4'));
  await page.keyboard.press('Escape');await page.locator('.hero [data-open-modal]').click();
  check('C01','Pending state retained on reopen',await page.locator('#enquiry-name').isDisabled());
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__resolve({ok:true}));await page.waitForTimeout(100);
  await page.locator('.hero [data-open-modal]').click();
  check('C02','Confirmation received while closed retained on reopen',await page.locator('#result-panel').isVisible());
  await page.locator('#enquiry-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  check('C02','Confirmed duplicate submit ignored',await page.evaluate(()=>window.__calls===1));
  const result=await page.locator('#enquiry-dialog').boundingBox();check('C07','Result panel compact',result.height<500,result);
  await page.screenshot({path:new URL('success.png',import.meta.url).pathname});
  await page.locator('#new-enquiry').click();check('C02','Deliberate new enquiry resets fields',await page.locator('#enquiry-name').inputValue()==='');
  await fill(page,'Synthetic Retry');
  await page.evaluate(()=>{window.GRC_LEAD_ADAPTER=()=>{window.__calls++;return Promise.reject(Error('synthetic'));};});
  await page.locator('#submit-enquiry').click();await page.locator('#form-status').waitFor({state:'visible'});
  check('C03','Failure retains entries and enables retry',await page.locator('#enquiry-name').inputValue()==='Synthetic Retry'&&await page.locator('#submit-enquiry').isEnabled());
  await page.evaluate(()=>{window.GRC_PREVIEW_TIMEOUT_MS=150;window.GRC_LEAD_ADAPTER=()=>{window.__calls++;return new Promise(resolve=>window.__late=resolve);};});
  await page.locator('#submit-enquiry').click();await page.locator('#form-status').waitFor({state:'visible'});
  check('C03','Deadline is recoverable uncertainty without auto retry',await page.evaluate(()=>window.__calls===3)&&/couldn't confirm/.test(await page.locator('#form-status').innerText()));
  await page.evaluate(()=>{window.GRC_LEAD_ADAPTER=()=>{window.__calls++;return new Promise(resolve=>window.__new=resolve);};window.GRC_PREVIEW_TIMEOUT_MS=8000;});
  await page.locator('#submit-enquiry').click();await page.evaluate(()=>window.__late({ok:true}));await page.waitForTimeout(100);
  check('C01','Late old result cannot confirm a new pending request',await page.locator('#result-panel').isHidden()&&await page.locator('#enquiry-name').isDisabled());
  await page.evaluate(()=>window.__new({ok:true}));await page.locator('#result-panel').waitFor({state:'visible'});
  check('C03','Deliberate same-filled retry confirms',await page.evaluate(()=>window.__calls===4));
  await page.close();
  report.status=report.checks.every(c=>c.pass)?'pass':'blocked';
  report.limits=['No required radio group or inline form is present.','All confirmation tests used a local injected adapter; production delivery is disabled.','Product depth, visual evidence and contact readability require separate review.'];
} catch(error) {report.status='blocked';report.error=error.stack;process.exitCode=1;}
finally {await writeFile(new URL('parent-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));
