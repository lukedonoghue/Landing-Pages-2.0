import {writeFile} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={checks:[],limits:['Email intent intercepted before OS dispatch. No messages or calls.','No form exists; modal/grouped-field cases remain not exercised.','Caption hit tests are supplemented by readable pixels; transparent containers are not automatically occlusion.']};
const check=(name,pass,detail)=>report.checks.push({name,pass:!!pass,detail});
try {
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]){
  const p=await b.newPage({viewport:{width,height}});await p.goto('http://127.0.0.1:43192/',{waitUntil:'networkidle'});
  await p.evaluate(()=>{window.__intents=[];document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&/^(mailto|tel):/.test(a.getAttribute('href')||'')){e.preventDefault();window.__intents.push(a.getAttribute('href'));}},true);});
  check(`No overflow ${width}`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`Early readable phone ${width}`,await p.locator('.header-phone').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width>0&&e.textContent.includes('07467 474356');}));
  for(const a of await p.locator('[data-primary-action]').all()){
   if(!await a.isVisible())continue;await a.scrollIntoViewIfNeeded();await a.focus();await p.keyboard.press('Enter');
   check(`Quote email activation ${width}`,await p.evaluate(()=>{const u=new URL(window.__intents.at(-1));return u.protocol==='mailto:'&&u.pathname==='info@clarentis.co.uk'&&u.searchParams.get('subject')==='Fixed-fee quote enquiry'&&u.searchParams.get('body').includes('My business type is:');}));
  }
  for(const s of await p.locator('.faq-list summary').all()){
   await s.scrollIntoViewIfNeeded();await s.focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);
   check(`FAQ ${await s.innerText()} ${width}`,await s.evaluate(e=>e.parentElement.open&&document.activeElement===e));await p.keyboard.press('Enter');
  }
  const captions=[];
  for(const f of await p.locator('figure').all()){
   await f.scrollIntoViewIfNeeded();await p.waitForTimeout(150);await f.locator('img').evaluate(e=>e.decode().catch(()=>{}));
   const c=f.locator('figcaption');await c.scrollIntoViewIfNeeded();
   captions.push(await c.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:e.textContent,top:t?.tagName,className:t?.className,inViewport:r.top>=0&&r.bottom<=innerHeight,width:r.width,height:r.height,paintedStyle:s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0,imageCover:t?.tagName==='IMG'};}));
  }
  check(`Disclosure not hidden by photograph ${width}`,captions.every(c=>c.inViewport&&c.paintedStyle&&!c.imageCover&&c.width>0&&c.height>0),captions);
  check(`All images decode ${width}`,await p.locator('img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)));
  check(`Only local resource requests ${width}`,await p.evaluate(()=>performance.getEntriesByType('resource').every(e=>new URL(e.name).origin===location.origin)));
  await p.close();
 }
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{report.status=!report.error&&report.checks.every(c=>c.pass)?'pass':'blocked';await writeFile(new URL('parent-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await b.close();}
console.log(JSON.stringify({status:report.status,count:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));
