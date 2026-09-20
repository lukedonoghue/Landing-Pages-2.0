import {writeFile} from 'node:fs/promises';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out=new URL('./final/',import.meta.url),report=[];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const [width,height]of [[320,700],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]){
  const p=await browser.newPage({viewport:{width,height}});await p.goto('http://127.0.0.1:50525/',{waitUntil:'networkidle'});const row={width,height};
  if(await p.locator('#menu-toggle').isVisible()){
    await p.locator('#menu-toggle').press('Enter');await p.screenshot({path:new URL(`menu-${width}.png`,out).pathname});
    row.menuOpen=await p.locator('#main-nav').isVisible();await p.locator('#main-nav a').first().focus();await p.keyboard.press('Escape');
    row.afterEscape=await p.evaluate(()=>{const a=document.activeElement,r=a.getBoundingClientRect();return{tag:a.tagName,id:a.id,text:a.textContent.trim().slice(0,50),visible:r.width>0&&r.height>0,expanded:document.querySelector('#menu-toggle').getAttribute('aria-expanded')};});
  }
  const details=p.locator('.faq-list details');for(let i=0;i<await details.count();i++){const s=details.nth(i).locator('summary');await s.focus();await s.press('Enter');}
  await p.locator('#questions').scrollIntoViewIfNeeded();await p.screenshot({path:new URL(`faq-${width}.png`,out).pathname});
  row.faq=await details.evaluateAll(es=>es.map(e=>({open:e.open,text:e.querySelector('p').textContent,overflows:e.scrollWidth>e.clientWidth})));
  row.pageOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);report.push(row);await p.close();
}}finally{await browser.close();await writeFile(new URL('disclosures.json',out),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report.map(({width,menuOpen,afterEscape,faq,pageOverflow})=>({width,menuOpen,afterEscape,faqOpen:faq.every(x=>x.open&&!x.overflows),pageOverflow}))));
