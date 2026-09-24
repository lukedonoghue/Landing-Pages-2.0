#!/usr/bin/env node
/** Current rendered-state evidence. All writes are intercepted, never sent.
 * Confirmed thank-you evidence comes ONLY from the authorized local journey.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args={};
for(let i=2;i<process.argv.length;i++){
  if(!process.argv[i].startsWith('--') || !process.argv[i+1])throw new Error('Use named options with values');
  args[process.argv[i].slice(2)]=process.argv[++i];
}
const root=path.resolve(args['project-root']||'.');
const url=new URL(args.url);
if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw new Error('Final-state capture is loopback-only');
const out=path.resolve(root,args.out||'build/layout/final-states');
if(!out.startsWith(root+path.sep+'build'+path.sep))throw new Error('Keep evidence under project build/');
for(let part=out;part!==root;part=path.dirname(part)){if(existsSync(part)&&lstatSync(part).isSymbolicLink())throw new Error('Evidence output may not follow a symlink');}
mkdirSync(out,{recursive:true});
const config=JSON.parse(readFileSync(path.join(root,'funnel.json'),'utf8'));
const snapshot=JSON.parse(readFileSync(path.join(root,'build/gate-snapshot.json'),'utf8'));
const scripts=path.dirname(fileURLToPath(import.meta.url));
const fingerprint=()=>{
 const run=spawnSync(args.python||'python3',['-c', 'import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);import check_gates;print(check_gates.source_snapshot(Path(sys.argv[2]))["source_fingerprint"])',scripts,root],{encoding:'utf8'});
 if(run.status!==0)throw new Error('Source identity could not be inspected');return run.stdout.trim();
};
if(fingerprint()!==snapshot.source_fingerprint)throw new Error('Take one current source snapshot before capturing states');
const require=createRequire(path.join(root,'package.json'));
const {chromium}=await import(pathToFileURL(require.resolve('playwright-core')).href);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={schema_version:1,status:'blocked',kind:'rendered_final_states',source_fingerprint:snapshot.source_fingerprint,
 executed_at:new Date().toISOString(),target:{mode:snapshot.mode,url:url.href},tool:{name:'capture-final-states',version:'1'},
 execution:{kind:'automated',command:process.argv.slice(1),exit_code:1},checks:[],artifacts:[],failures:[],warnings:[],
 limits:['Every write is intercepted. Error/pending states are controlled browser simulations, not backend persistence proof.',
 'Software-keyboard space is represented by a reduced viewport, not a physical phone keyboard.',
 'Screenshots and extracted text require actual critical review; they do not grant acceptance.']};
const test=(name,okay)=>{report.checks.push({name,status:okay?'pass':'blocked'});if(!okay)report.failures.push(name);};
let browser;
try{
 browser=await chromium.launch({headless:true,...(args['browser-executable']?{executablePath:args['browser-executable']}:{})});
 const formMode=config.conversion?.type==='enquire'||(config.backend?.provider!=='none'&&config.form_fields?.length);
 const fixture=formMode?JSON.parse(readFileSync(path.join(root,args.fixture||'test-fixture.json'),'utf8')):null;
 const helper=formMode?await import(pathToFileURL(path.join(root,'scripts/browser-compat.mjs')).href):null;
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:1024},{width:1024,height:800},{width:1280,height:600},{width:320,height:700},{width:390,height:420}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  let transport='blocked',releasePending=null;
  await context.route('**/*',async route=>{
   const request=route.request();
   if(['GET','HEAD','OPTIONS'].includes(request.method()))return route.continue();
   if(new URL(request.url()).origin===url.origin&&new URL(request.url()).pathname==='/api/leads'){
    if(transport==='rejected')return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({ok:false,error:'validation_error'})});
    if(transport==='pending')await new Promise(resolve=>{releasePending=resolve;});
   }
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const capture=async state=>{
   const filename=`${viewport.width}x${viewport.height}-${state}`;
   const file=path.join(out,filename+'.png');await page.screenshot({path:file,fullPage:state==='page'||state==='direct_thank_you'});
   const metadata={viewport:page.viewportSize(),device_pixel_ratio:await page.evaluate(()=>devicePixelRatio),engine:'chromium',browser_version:browser.version(),
     url:page.url(),source_fingerprint:snapshot.source_fingerprint,state,transport:state==='server_error'?'simulated_422':state==='pending'||state==='uncertain'?'blocked_read_only':null};
   const ref={path:path.relative(root,file).split(path.sep).join('/'),type:'screenshot',sha256:hash(readFileSync(file)),...metadata};report.artifacts.push(ref);
   const textFile=path.join(out,filename+'.txt');writeFileSync(textFile,await page.locator('body').innerText());
   report.artifacts.push({path:path.relative(root,textFile).split(path.sep).join('/'),sha256:hash(readFileSync(textFile)),type:'rendered_text',...metadata});
  };
  const header=async label=>{
   const okay=await page.locator(fixture.selectors.modal).evaluate(el=>{
    const title=el.querySelector('[data-modal-title],.modal__title,h2,h3');
    const close=el.querySelector('[data-close-modal],.modal__close');
    return [title,close].every(node=>{if(!node)return false;const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=-1&&r.bottom<=innerHeight+1;});
   });test(`${viewport.width}x${viewport.height} ${label} title and close stay visible`,okay);
  };
  try{
   const response=await page.goto(new URL(fixture?.path||'/',url).href,{waitUntil:'networkidle'});
   test('Page loads '+viewport.width+'x'+viewport.height,Boolean(response?.ok()));await capture('page');
   if(formMode && (viewport.width===1440||viewport.width===390||viewport.width===1280)){
    // Every primary selector must open the same dialog; no alternate easier CTA.
    const triggers=page.locator(fixture.selectors.openModal);
    for(let i=0;i<await triggers.count();i++){
     if(!await triggers.nth(i).isVisible())continue;
     await triggers.nth(i).click();test('Primary CTA '+i+' opens intended dialog',await page.locator(fixture.selectors.modal).isVisible());
     await page.locator(fixture.selectors.closeModal).first().click();
    }
    await triggers.first().click();await capture('modal_initial');await header('initial');
    const next=page.locator(fixture.selectors.next).first();
    await (await next.isVisible()?next:page.locator(fixture.selectors.submit).first()).click();
    const invalid=page.locator('[aria-invalid="true"]:visible');
    test('Invalid fields are visible',await invalid.count()>0);
    if(await invalid.count()){
     await invalid.first().focus();
     test('Invalid fields describe persistent errors',await invalid.first().evaluate(el=>(el.getAttribute('aria-describedby')||'').split(/\s+/).some(id=>{const node=document.getElementById(id);return node&&node.hasAttribute('data-field-error')&&!node.hidden&&node.textContent.trim();})));
    }
    await capture('invalid');await header('invalid');
    await helper.fillSteps(page,fixture);await capture('final_step');await header('final step');
    transport='rejected';await page.locator(fixture.selectors.submit).first().click();
    await page.locator(fixture.selectors.error).first().waitFor({state:'visible'});await capture('server_error');await header('server error');
    transport='pending';await page.locator('form').evaluate(el=>{el.dataset.webhookTimeout='10000';});
    await page.locator(fixture.selectors.submit).first().click();
    for(let i=0;!releasePending&&i<50;i++)await page.waitForTimeout(20);
    test('Pending submission reached blocked test transport',Boolean(releasePending));
    await capture('pending');await header('pending');releasePending?.();
    await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('could not confirm'),fixture.selectors.error);
    await capture('uncertain');await header('uncertain');
   }
   if(formMode){
    await page.goto(new URL(fixture.thank_you_path,url).href,{waitUntil:'networkidle'});await capture('direct_thank_you');
    const stateNode=page.locator('[data-receipt-state]');const receiptState=await stateNode.count()?await stateNode.first().getAttribute('data-receipt-state'):null;
    test('Direct thank-you does not have a confirmed receipt',receiptState!=='confirmed' && !(await page.locator('body').innerText()).includes('Your request has been received.'));
   }
  }finally{releasePending?.();await context.close();}
 }
 test('Product source stayed unchanged',fingerprint()===snapshot.source_fingerprint);
 report.status=report.failures.length?'blocked':'pass';report.execution.exit_code=report.failures.length?1:0;
}catch(error){report.failures.push(String(error.message));}
finally{await browser?.close();writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,report:path.join(out,'result.json'),failures:report.failures},null,2));
process.exitCode=report.status==='pass'?0:1;
