import {writeFile} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={checks:[],viewports:[],limits:['Synthetic local receiver only, no live leads.','No required grouped field or shared inline form exists.','Visual, source and reference review is separate.']};
const check=(id,name,pass,detail)=>report.checks.push({id,name,pass:!!pass,detail});
const base='http://127.0.0.1:8787/';
const fill=async p=>{await p.locator('#name').fill('Synthetic Parent');await p.locator('#email').fill('qa@example.test');await p.locator('#phone').fill('+44 7700 900123 ext. 4');await p.locator('#message').fill('Synthetic local enquiry only.');};
try {
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]) {
    const p=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});
    await p.goto(base,{waitUntil:'networkidle'});
    const phone=await p.locator('.header-phone').evaluate(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,href:e.getAttribute('href'),visible:r.width>0&&r.top>=0&&r.bottom<=innerHeight};});
    check('R3-P03',`Top phone ${width}`,phone.visible&&phone.text.includes('07803 362187'),phone);
    const openers=p.locator('[data-open-modal]');
    for(let i=0;i<await openers.count();i++) {
      const opener=openers.nth(i);if(!await opener.isVisible())continue;
      await opener.scrollIntoViewIfNeeded();await p.waitForTimeout(150);
      const before=await p.evaluate(()=>({y:scrollY,hash:location.hash}));
      await opener.click();await p.waitForTimeout(150);
      const during=await p.evaluate(()=>({y:scrollY,hash:location.hash,open:document.querySelector('dialog').open}));
      await p.keyboard.press('Escape');await p.waitForTimeout(150);
      const after=await opener.evaluate(e=>({y:scrollY,focus:document.activeElement===e}));
      check('R3-P02',`CTA ${i+1} ${width}`,during.open&&during.hash===before.hash&&Math.abs(during.y-before.y)<=2&&after.focus&&Math.abs(after.y-before.y)<=2,{before,during,after});
    }
    await p.locator('.hero [data-open-modal]').click();
    const focus=[];
    for(let i=0;i<13;i++) {
      await p.waitForTimeout(60);
      focus.push(await p.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id||e.textContent.trim().slice(0,30),visible:r.top>=0&&r.bottom<=innerHeight&&(top===e||e.contains(top)),inside:!!e.closest('dialog')};}));
      await p.keyboard.press('Tab');
    }
    check('C05',`Natural tab focus visible and contained ${width}`,focus.every(f=>f.visible&&f.inside),focus);
    await p.locator('#submit-enquiry').click();await p.waitForTimeout(150);
    const validation=await p.locator('#error-summary').evaluate(e=>{const r=e.getBoundingClientRect(),clip=e.closest('.form-fields').getBoundingClientRect();return {focused:document.activeElement===e,top:r.top,bottom:r.bottom,clipTop:clip.top,clipBottom:clip.bottom};});
    check('C05',`Invalid summary framed ${width}`,validation.focused&&validation.top>=validation.clipTop-1&&validation.bottom<=validation.clipBottom+1,validation);
    await p.locator('#name').fill('Synthetic Parent');
    check('C05',`Partial correction ${width}`,await p.locator('#error-summary li').count()===2);
    await p.locator('#error-summary a[href="#email"]').focus();await p.keyboard.press('Enter');await p.waitForTimeout(100);
    check('C05',`Error link usable ${width}`,await p.locator('#email').evaluate(e=>document.activeElement===e));
    await p.keyboard.press('Escape');
    for(const img of await p.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode().catch(()=>{}));}
    const images=await p.locator('img').evaluateAll(a=>a.map(e=>({src:e.currentSrc,width:e.naturalWidth,render:e.getBoundingClientRect().width,loaded:e.complete&&e.naturalWidth>0})));
    check('C08/C10',`All responsive images decode ${width}`,images.every(i=>i.loaded),images);
    check('layout',`No overflow ${width}`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    report.viewports.push({width,height,phone,validation,images});await p.close();
  }
  const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto(base);await p.locator('.hero [data-open-modal]').click();
  await fill(p);await p.locator('#name').fill('   ');await p.locator('#email').fill('not-email');await p.locator('#phone').fill('junk1234567');await p.locator('#submit-enquiry').click();
  check('validation','Whitespace, malformed email and alphabetic phone rejected',await p.locator('[aria-invalid="true"]').count()===3);await fill(p);
  let requests=0,release;await p.route('**/__preview/enquiry',async route=>{requests++;await new Promise(r=>release=r);const data=route.request().postDataJSON();await route.fulfill({json:{confirmed:true,preview:true,requestId:data.requestId}});});
  await p.locator('#enquiry-form').evaluate(f=>{f.requestSubmit();f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await p.waitForTimeout(150);check('C01','Duplicate pending dispatch guarded',requests===1&&await p.locator('#name').isDisabled());
  await p.keyboard.press('Escape');await p.locator('.hero [data-open-modal]').click();
  check('C01','Pending close/reopen preserves locked snapshot',await p.locator('#name').isDisabled()&&await p.locator('#name').inputValue()==='Synthetic Parent');
  await p.keyboard.press('Escape');release();await p.waitForTimeout(150);await p.locator('.hero [data-open-modal]').click();
  check('C02','Receipt received while closed retained on reopen',await p.locator('#enquiry-success').isVisible());
  await p.locator('#enquiry-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  check('C02','Confirmed duplicate guarded',requests===1);const result=await p.locator('dialog').boundingBox();check('C07','Compact success',result.height<500,result);
  await p.screenshot({path:new URL('success.png',import.meta.url).pathname});
  await p.locator('#new-enquiry').click();check('C02','Deliberate reset clears fields',await p.locator('#name').inputValue()==='');await fill(p);
  await p.unroute('**/__preview/enquiry');await p.route('**/__preview/enquiry',r=>r.fulfill({status:503,json:{error:'Synthetic failure'}}));
  await p.locator('#submit-enquiry').click();await p.waitForFunction(()=>document.querySelector('#form-result').textContent.includes('could not'));
  check('C03','Failure retains values and permits retry',await p.locator('#name').inputValue()==='Synthetic Parent'&&await p.locator('#submit-enquiry').isEnabled());
  await p.unroute('**/__preview/enquiry');await p.locator('#submit-enquiry').click();await p.locator('#enquiry-success').waitFor({state:'visible'});
  check('C03','Same filled retry reaches actual local receiver',await p.locator('#enquiry-success').isVisible());
  await p.locator('#new-enquiry').click();await fill(p);
  await p.route('**/__preview/enquiry',r=>r.fulfill({json:{confirmed:true,preview:true,requestId:'wrong'}}));await p.locator('#submit-enquiry').click();await p.waitForFunction(()=>document.querySelector('#form-result').textContent.includes('could not'));
  check('receipt','Mismatched receipt rejected',await p.locator('#enquiry-success').isHidden());await p.unroute('**/__preview/enquiry');
  let late;await p.route('**/__preview/enquiry',r=>{late=r;});await p.locator('#submit-enquiry').click();await p.waitForTimeout(8250);
  check('C03','Real eight-second deadline is recoverable',await p.locator('#submit-enquiry').isEnabled()&&/could not be confirmed/.test(await p.locator('#form-result').innerText())&&await p.locator('#name').inputValue()==='Synthetic Parent');
  await p.unroute('**/__preview/enquiry');await p.locator('#submit-enquiry').click();await p.locator('#enquiry-success').waitFor({state:'visible'});
  const data=late.request().postDataJSON();await late.fulfill({json:{confirmed:true,preview:true,requestId:data.requestId}}).catch(()=>{});
  check('C03','Retry after timeout confirms locally',await p.locator('#enquiry-success').isVisible());await p.close();
} catch(e){report.error=e.stack;process.exitCode=1;}
finally {report.status=!report.error&&report.checks.every(c=>c.pass)?'pass':'blocked';await writeFile(new URL('parent-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,count:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));
