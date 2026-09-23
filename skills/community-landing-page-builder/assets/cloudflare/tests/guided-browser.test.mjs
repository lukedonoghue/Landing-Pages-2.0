import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const skill=fileURLToPath(new URL('../../../',import.meta.url));
function run(exe,args,{timeout=60000}={}){return new Promise((ok,fail)=>{const p=spawn(exe,args,{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);const timer=setTimeout(()=>p.kill('SIGTERM'),timeout);p.on('error',e=>{clearTimeout(timer);fail(e);});p.on('exit',code=>{clearTimeout(timer);code===0?ok(out):fail(Error(`${exe} failed (${code}): ${err}`));});});}
async function temp(t){const root=await mkdtemp(join(tmpdir(),'lp-guide-browser-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('control capture uses actual responsive pixels and blocks automatic mutations',async t=>{
 const root=await temp(t);await mkdir(join(root,'public'));
 await writeFile(join(root,'funnel.json'),JSON.stringify({backend:{provider:'none'}}));
 const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:18px sans-serif}main{min-height:1500px}h1{font-size:30px}section{content-visibility:auto}</style></head><body><main><h1>Find roof problems before they spread</h1><p>A synthetic inspection report helps homeowners choose a repair.</p><section><h2>Know exactly what needs attention</h2><p>Read the illustrated findings.</p></section></main><script>fetch("/must-not-send",{method:"POST",body:"synthetic"}).catch(()=>{});</script></body></html>';
 await writeFile(join(root,'public/index.html'),html);let mutations=0;
 const server=createServer((req,res)=>{if(req.method==='POST')mutations++;res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const helper=join(skill,'scripts/capture-control.mjs');
 await run(process.execPath,[helper,'--project',root,'--url',url,'--phase','initial']);
 const initial=JSON.parse(await readFile(join(root,'build/control-review/initial-capture.json'),'utf8'));
 assert.equal(mutations,0);assert.equal(initial.execution,'playwright');assert.deepEqual(initial.views.map(x=>x.width).sort((a,b)=>a-b),[390,1440]);
 for(const v of initial.views){assert.equal(v.overflow,false);assert.deepEqual(v.errors,[]);assert.match(v.text,/Know exactly/);const png=await readFile(join(root,v.screenshot));assert.equal(png.readUInt32BE(16),v.width);}
 await run(process.execPath,[helper,'--project',root,'--url',url,'--phase','final']);
 const final=JSON.parse(await readFile(join(root,'build/control-review/final-capture.json'),'utf8'));assert.notEqual(final.capture_id,initial.capture_id);
 await assert.rejects(run(process.execPath,[helper,'--project',root,'--url','https://example.com','--phase','final']),/local preview only/);
});

test('real loopback guide supports mobile answers, help, replay protection and safe missing-runner feedback',async t=>{
 const root=await temp(t);const guide=join(skill,'scripts/guide.py');
 await run('python3',[guide,'start',root,'--mode','guided','--goal','preview']);
 // The fixture must exercise the missing-CLI path even on a developer host
 // with a signed-in Codex installation. Keep Python explicit for the UI server.
 const python=execFileSync('which',['python3'],{encoding:'utf8'}).trim();
 const processUI=spawn(python,[join(skill,'scripts/guide_ui.py'),root,'--provider','codex'],{
   stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:'/usr/bin:/bin:/usr/sbin:/sbin'}
 });
 t.after(()=>{processUI.kill('SIGTERM');});
 const address=await new Promise((ok,fail)=>{let text='';const timer=setTimeout(()=>fail(Error('Guide did not start')),10000);processUI.stdout.on('data',b=>{text+=b;const m=text.match(/http:\/\/127\.0\.0\.1:\d+\/#token=[^\s]+/);if(m){clearTimeout(timer);ok(m[0]);}});processUI.on('error',fail);processUI.on('exit',code=>{clearTimeout(timer);if(code)fail(Error('Guide process exited'));});});
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(address);await page.getByRole('button',{name:'Save answers and continue'}).waitFor();
 assert.equal(new URL(page.url()).hash,'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByRole('button',{name:'Why does this matter?'}).first().click();
 await page.getByRole('textbox',{name:'What is the business called?',exact:true}).fill('Synthetic roof inspections');
 await page.getByRole('button',{name:'Save answers and continue'}).click();
 try { await page.waitForFunction(()=>document.querySelector('#step-title').textContent.includes('research')); }
 catch (error) { throw new Error(`Guide did not advance: ${await page.locator('body').innerText()}`,{cause:error}); }
 // No native CLI is provisioned by this test. A truthful blocker must surface rather than fake completion.
 try { await page.waitForFunction(()=>document.querySelector('#blockers').textContent.includes('not installed')); }
 catch (error) { throw new Error(`Guide did not report the expected runner blocker: ${await page.locator('body').innerText()}`,{cause:error}); }
 assert.deepEqual(errors,[]);
 const state=JSON.parse(await readFile(join(root,'build/guide-state.json'),'utf8'));assert.ok(state.answers.business_name);
 const response=await fetch(new URL('/api/status',address));assert.equal(response.status,403);
});
