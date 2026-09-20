import {writeFile} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={checks:[],limits:['Email and phone intent activation intercepted before OS dispatch; no message sent or call placed.','No form exists; previous modal/grouped-field lifecycle checks are not applicable here.','Physical mobile mail handlers and delivery remain untested.']};
const check=(name,pass,detail)=>report.checks.push({name,pass:!!pass,detail});
try {
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]) {
    const p=await browser.newPage({viewport:{width,height}});
    await p.goto('http://127.0.0.1:53187/',{waitUntil:'networkidle'});
    await p.evaluate(()=>{window.__intents=[];document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&/^(mailto|tel):/.test(a.getAttribute('href'))){e.preventDefault();window.__intents.push(a.getAttribute('href'));}},true);});
    check(`No overflow ${width}`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const phones=await p.locator('header a[href^="tel:"],.hero a[href^="tel:"]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,visible:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight};}));
    check(`Verified phone visible early ${width}`,phones.some(x=>x.visible&&x.text.includes('07467 474356')),phones);
    const ctas=p.locator('[data-primary-action]');
    for(let i=0;i<await ctas.count();i++){
      const a=ctas.nth(i);if(!await a.isVisible())continue;
      await a.scrollIntoViewIfNeeded();await a.focus();await p.keyboard.press('Enter');
      check(`CTA ${i+1} email intent ${width}`,await p.evaluate(()=>window.__intents.at(-1)==='mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20enquiry'));
    }
    const summary=p.locator('.mobile-menu summary');
    if(await summary.isVisible()){
      await summary.scrollIntoViewIfNeeded();await summary.focus();await p.keyboard.press('Enter');
      check(`Native menu keyboard opening ${width}`,await p.locator('.mobile-menu').getAttribute('open')!==null);
      await p.keyboard.press('Tab');check(`Menu first link reached ${width}`,await p.evaluate(()=>document.activeElement.matches('.mobile-menu nav a')));
      await summary.focus();await p.keyboard.press('Enter');
    }
    for(const s of await p.locator('.faq-list summary').all()) {
      await s.scrollIntoViewIfNeeded();await s.focus();await p.keyboard.press('Enter');await p.waitForTimeout(100);
      check(`FAQ ${await s.innerText()} ${width}`,await s.evaluate(e=>e.parentElement.open&&document.activeElement===e));
      await p.keyboard.press('Enter');
    }
    for(const img of await p.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode().catch(()=>{}));}
    const images=await p.locator('img').evaluateAll(es=>es.map(e=>({src:e.currentSrc,role:e.dataset.imageRole,loaded:e.complete&&e.naturalWidth>0,alt:e.alt})));
    check(`All images load and generated images identified ${width}`,images.every(i=>i.loaded)&&images.filter(i=>i.role==='illustrative').every(i=>/illustrative/i.test(i.alt)),images);
    check(`No tracking or third-party resource requests ${width}`,await p.evaluate(()=>performance.getEntriesByType('resource').every(r=>new URL(r.name).origin===location.origin)));
    await p.close();
  }
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{report.status=!report.error&&report.checks.every(c=>c.pass)?'pass':'blocked';await writeFile(new URL('parent-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,count:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));
