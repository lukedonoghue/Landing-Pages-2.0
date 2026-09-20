import {writeFile, mkdir} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out=new URL('./',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={checks:[],limits:['Local synthetic receiver only. No production submission, CRM or deployment proof.','No required grouped field or shared inline form is present.']};
const check=(name,pass,detail)=>report.checks.push({name,pass:!!pass,detail});
const base=process.argv[2];
const bounds=async (p,selector)=>p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,height:r.height,visible:r.top>=0&&r.bottom<=innerHeight&&r.width>0,uncovered:hit===e||e.contains(hit)};});
const fill=async p=>{await p.locator('#name').fill('Synthetic Audit');await p.locator('#email').fill('audit@example.test');await p.locator('#phone').fill('+44 7700 900123 ext. 4');await p.locator('#message').fill('Local synthetic test only.');};
try {
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]) {
    const p=await browser.newPage({viewport:{width,height}});await p.goto(base,{waitUntil:'networkidle'});
    const phone=await p.locator('.header-phone').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),text:e.textContent,href:e.getAttribute('href')}));
    check(`Readable top phone ${width}`,phone.size>=14&&(await bounds(p,'.header-phone')).visible&&phone.href==='tel:+447803362187',phone);
    await p.screenshot({path:new URL(`first-${width}.png`,out).pathname});
    const openers=p.locator('[data-open-modal]');
    for(let i=0;i<await openers.count();i++) {
      const e=openers.nth(i);if(!await e.isVisible())continue;
      await e.scrollIntoViewIfNeeded();await p.waitForTimeout(200);
      const before=await p.evaluate(()=>({y:scrollY,hash:location.hash}));await e.click();
      const during=await p.evaluate(()=>({y:scrollY,hash:location.hash,open:document.querySelector('dialog').open}));
      await p.keyboard.press('Escape');
      const after=await e.evaluate(e=>({y:scrollY,focused:e===document.activeElement}));
      check(`Popup CTA ${i} ${width}`,during.open&&before.hash===during.hash&&Math.abs(before.y-during.y)<2&&after.focused&&Math.abs(before.y-after.y)<2,{before,during,after});
    }
    await p.locator('.hero [data-open-modal]').click();await p.locator('#submit-enquiry').click();await p.waitForTimeout(100);
    const close=await bounds(p,'#dialog-close'),title=await bounds(p,'#dialog-title');
    check(`Validation close and title ${width}`,close.visible&&close.uncovered&&title.visible,{close,title});
    await p.screenshot({path:new URL(`validation-${width}.png`,out).pathname});
    await p.locator('#error-summary a[href="#email"]').focus();await p.keyboard.press('Enter');
    check(`Error-summary link ${width}`,await p.locator('#email').evaluate(e=>e===document.activeElement));
    const tabs=[];
    for(let i=0;i<13;i++){await p.keyboard.press('Tab');await p.waitForTimeout(50);tabs.push(await p.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id||e.textContent.trim().slice(0,30),visible:r.top>=0&&r.bottom<=innerHeight&&(hit===e||e.contains(hit)),inside:!!e.closest('dialog')};}));}
    check(`Keyboard containment and visibility ${width}`,tabs.every(x=>x.visible&&x.inside),tabs);
    await p.locator('#dialog-close').click();
    check(`Touch close after errors ${width}`,await p.locator('dialog').evaluate(e=>!e.open));
    const imgs=p.locator('img[data-image-role="proof"]');
    for(const e of await imgs.all()){await e.scrollIntoViewIfNeeded();await e.evaluate(e=>e.decode().catch(()=>{}));}
    const images=await imgs.evaluateAll(es=>es.map(e=>({src:e.currentSrc,key:e.getAttribute('src'),alt:e.alt,loaded:e.complete&&e.naturalWidth>0})));
    check(`At least four distinct loaded content assets ${width}`,images.length>=4&&new Set(images.map(i=>i.key)).size===images.length&&images.every(i=>i.loaded),images);
    check(`No horizontal overflow ${width}`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.close();
  }
  const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto(base);await p.locator('.hero [data-open-modal]').click();await fill(p);
  await p.locator('#name').fill('   ');await p.locator('#email').fill('invalid');await p.locator('#phone').fill('junk1234567');await p.locator('#submit-enquiry').click();
  check('Whitespace, email and phone rejection',await p.locator('[aria-invalid="true"]').count()===3);await fill(p);
  let requests=0,release;
  await p.route('**/api/enquiry',async route=>{requests++;await new Promise(r=>release=r);await route.fulfill({status:202,json:{localPreview:true,receipt:'synthetic-local'}});});
  await p.locator('#enquiry-form').evaluate(f=>{f.requestSubmit();f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await p.waitForTimeout(150);
  check('Pending duplicate guard',requests===1&&await p.locator('#name').isDisabled());
  await p.keyboard.press('Escape');await p.locator('.hero [data-open-modal]').click();check('Pending reopen locks snapshot',await p.locator('#name').isDisabled());
  await p.keyboard.press('Escape');release();await p.waitForTimeout(150);await p.locator('.hero [data-open-modal]').click();
  check('Confirmed while closed preserved',await p.locator('#confirmed-view').isVisible());
  await p.locator('#enquiry-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check('Confirmed duplicate guard',requests===1);
  const success=await bounds(p,'dialog');check('Compact success',success.height<500,success);await p.screenshot({path:new URL('success.png',out).pathname});
  await p.locator('#new-enquiry').click();check('Deliberate reset',await p.locator('#name').inputValue()==='');await fill(p);
  await p.unroute('**/api/enquiry');await p.route('**/api/enquiry',r=>r.fulfill({status:503,json:{error:'synthetic'}}));await p.locator('#submit-enquiry').click();await p.locator('#form-feedback').waitFor({state:'visible'});
  check('Failure preserves retry',await p.locator('#name').inputValue()==='Synthetic Audit'&&await p.locator('#submit-enquiry').isEnabled());
  await p.unroute('**/api/enquiry');await p.locator('#submit-enquiry').click();await p.locator('#confirmed-view').waitFor({state:'visible'});check('Actual local receiver retry',true);
  await p.locator('#new-enquiry').click();await fill(p);let late;await p.route('**/api/enquiry',r=>{late=r;});await p.locator('#submit-enquiry').click();await p.waitForTimeout(8250);
  check('Bounded timeout remains recoverable',await p.locator('#submit-enquiry').isEnabled()&&await p.locator('#form-feedback').isVisible()&&await p.locator('#name').inputValue()==='Synthetic Audit');
  await p.unroute('**/api/enquiry');await late.abort().catch(()=>{});await p.locator('#submit-enquiry').click();await p.locator('#confirmed-view').waitFor({state:'visible'});check('Timeout retry confirms locally',true);await p.close();
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{report.status=!report.error&&report.checks.every(c=>c.pass)?'pass':'blocked';await writeFile(new URL('parent-checks.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,count:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));
