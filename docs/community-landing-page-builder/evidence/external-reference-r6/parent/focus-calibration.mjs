import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output=new URL('./final/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={cases:[],limits:['Desktop Chrome emulated viewports, not physical mobile keyboard or other browser engines.','No page edits or production submissions.']};
const state=async p=>p.evaluate(()=>{const a=document.activeElement,d=document.querySelector('dialog'),r=a.getBoundingClientRect();return {id:a.id||a.tagName,tag:a.tagName,hasFocus:document.hasFocus(),inside:d.contains(a),dialogOpen:d.open,control:a.matches('button,input,textarea,a[href],select,[tabindex]'),top:r.top,bottom:r.bottom,visible:r.top>=0&&r.bottom<=innerHeight};});
try{
  for(const [width,height] of [[320,700],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]){
    const p=await browser.newPage({viewport:{width,height}});await p.goto('http://127.0.0.1:50525/',{waitUntil:'networkidle'});
    await p.locator('.hero [data-open-modal]').click();await p.locator('#submit-enquiry').click();
    await p.locator('#error-summary a[href="#email"]').focus();await p.keyboard.press('Enter');
    const forward=[],backward=[];
    for(let i=0;i<27;i++){await p.keyboard.press('Tab');await p.waitForTimeout(45);forward.push(await state(p));}
    for(let i=0;i<27;i++){await p.keyboard.press('Shift+Tab');await p.waitForTimeout(45);backward.push(await state(p));}
    const previous=await state(p);await p.locator('.header-phone').evaluate(e=>e.focus());const forced=await state(p);
    const boundaries=[...forward,...backward].filter(x=>!x.inside);
    const reachableOutside=boundaries.filter(x=>x.control||x.tag!=='BODY'||x.hasFocus);
    report.cases.push({width,height,forward,backward,boundaries,reachableOutside,forcedOutsideFocusBlocked:forced.inside&&previous.id===forced.id});
    await p.locator('#dialog-close').click();await p.screenshot({path:new URL(`first-${width}.png`,output).pathname});await p.close();
  }
}finally{await browser.close();await writeFile(new URL('focus-calibration.json',output),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report.cases.map(c=>({width:c.width,boundaries:c.boundaries,reachableOutside:c.reachableOutside,forcedOutsideFocusBlocked:c.forcedOutsideFocusBlocked}))));
