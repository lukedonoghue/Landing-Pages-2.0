import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { inside, renderedText, runCopyCapture } from '../scripts/capture-rendered-copy.mjs';
const fixture = { synthetic: true, path: '/', thank_you_path: '/thank-you.html', pdf_path: '/guide.pdf', fields: { email: 'test@example.invalid' }, selectors: { openModal: '[data-open-modal]', modal: '#lead-modal', step: '.step', next: '[data-next]', submit: '[data-submit]', closeModal: '[data-close-modal]', error: '[data-error]' } };
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>.mobile-hidden{display:block}.submission-error[hidden]{display:none}@media(max-width:500px){.mobile-hidden{display:none}}</style>
<h1>Plan <em>your</em> project.</h1><p class="mobile-hidden">An estimate follows a site review.</p>
<details><summary>How do quotes work?</summary><p>Discuss the project before committing.</p></details>
<button data-open-modal>Request guide</button><div id="lead-modal" hidden><button data-close-modal>×</button><h2>Your guide</h2>
<div class="step"><p>Tell us how to reach you.</p><label>Email<input name="email"></label></div>
<div class="step" hidden><p>We discuss your project next.</p></div><p class="submission-error" data-error hidden>We could not save your request.</p><button data-next>Continue</button><button data-submit hidden>Request guide</button></div>
<script>const modal=document.querySelector('#lead-modal');document.querySelector('[data-open-modal]').onclick=()=>modal.hidden=false;document.querySelector('[data-close-modal]').onclick=()=>modal.hidden=true;document.querySelector('[data-next]').onclick=()=>{let s=document.querySelectorAll('.step');s[0].hidden=true;s[1].hidden=false;document.querySelector('[data-next]').hidden=true;document.querySelector('[data-submit]').hidden=false};document.querySelector('[data-submit]').onclick=async()=>{try{await fetch('/api/leads',{method:'POST',body:'{}'});throw new Error('fixture rejects success')}catch{document.querySelector('[data-error]').hidden=false}};fetch('/api/visits',{method:'POST',body:'{}'}).catch(()=>{});</script>`;
async function project(t, { catalogue = false, pdfMismatch = false } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(),'copy-capture-'))), requests=[];
  mkdirSync(path.join(root,'build'));mkdirSync(path.join(root,'public'));
  writeFileSync(path.join(root,'build/page-copy.json'),'{}');
  writeFileSync(path.join(root,'build/gate-snapshot.json'),JSON.stringify({source_fingerprint:'test',mode:'handoff'}));
  writeFileSync(path.join(root,'funnel.json'),JSON.stringify({catalogue:{enabled:catalogue}}));
  writeFileSync(path.join(root,'test-fixture.json'),JSON.stringify(fixture));
  writeFileSync(path.join(root,'public/guide.pdf'),'%PDF-local');
  const server=http.createServer((req,res)=>{ requests.push({method:req.method,path:req.url});res.setHeader('Content-Type','text/html');
    res.end(req.url==='/guide.pdf' ? (pdfMismatch?'%PDF-different':'%PDF-local') : req.url==='/thank-you.html' ? '<h1>Your enquiry is saved.</h1><a href="/guide.pdf">Download guide</a>' : html);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});});
  return {root,requests,args:{url:`http://127.0.0.1:${server.address().port}`,fixture:'test-fixture.json','project-root':root}};
}
test('actual browser capture covers disclosures and form steps without sending POSTs',async t=>{
  const p=await project(t),report=await runCopyCapture(p.args);
  assert.equal(report.status,'pass',JSON.stringify(report.failures));assert.equal(report.synthetic_submissions_attempted,0);
  assert.ok(report.execution.command.includes('test-fixture.json'));
  assert.equal(p.requests.some(r=>r.method==='POST'),false);
  for(const width of [390,1440]){
    const docs=report.documents.filter(d=>d.width===width);
    assert.ok(docs.some(d=>d.text.includes('Plan your project.')));
    assert.ok(docs.some(d=>d.surface==='landing'&&d.text.includes('Discuss the project before committing.')));
    assert.ok(docs.some(d=>d.surface==='modal'&&d.text.includes('Tell us how to reach you.')));
    assert.ok(docs.some(d=>d.surface==='modal'&&d.text.includes('We discuss your project next.')));
    const initial=docs.find(d=>d.surface==='modal'&&d.state==='step-0');
    assert.ok(initial);assert.equal(initial.text.includes('We could not save your request.'),false);
    assert.ok(docs.some(d=>d.surface==='modal'&&d.state==='submission-error'&&d.text.includes('We could not save your request.')));
    assert.ok(docs.some(d=>d.surface==='thank_you'&&d.text.includes('Your enquiry is saved.')));
    assert.equal(docs.some(d=>d.text.includes('An estimate follows a site review.')),width===1440);
  }
});
test('DOM capture preserves inline wording and excludes hidden or clipped substitutes',async()=>{
  const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.setContent(`<p>Review <b>the site</b> first.</p><p hidden>hidden qualifier</p><p style="opacity:0">transparent qualifier</p><p style="position:absolute;left:-9999px">offscreen qualifier</p><p style="height:1px;overflow:hidden">clipped qualifier</p><p style="position:absolute;width:1px;height:1px;clip-path:inset(50%)">screen reader qualifier</p>`);
    assert.equal(await renderedText(page),'Review the site first.');
  }finally{await browser.close();}
});
test('scroll-reachable inline wording is captured without accepting a clipped scroll port',async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent(`<div style="height:40px;overflow:hidden"><div style="height:40px;overflow-y:auto"><p style="margin-top:80px">Reachable <a href="#privacy">privacy wording</a>.</p></div></div><div style="height:1px;overflow:hidden"><div style="height:40px;overflow-y:auto"><p style="margin-top:80px">Unreachable qualifier.</p></div></div>`);
    assert.equal(await renderedText(page),'Reachable privacy wording.');
  }finally{await browser.close();}
});
test('served/local PDF mismatch blocks even when the public browser flow works',async t=>{
  const p=await project(t,{catalogue:true,pdfMismatch:true}),report=await runCopyCapture(p.args);
  assert.equal(report.status,'blocked');assert.ok(report.checks.some(c=>c.detail?.includes('brochure')));
});
test('authored placeholders and dropdown labels are checked without entered values',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<label>Email<input placeholder="Your work email" value="do-not-capture@example.invalid"></label><select><option>Select a service</option><option>Site review</option></select><textarea placeholder="Describe your project">private entered text</textarea>');
    const text=await renderedText(page);
    for(const value of ['Your work email','Select a service','Site review','Describe your project'])assert.ok(text.includes(value));
    assert.ok(!text.includes('do-not-capture'));assert.ok(!text.includes('private entered text'));
  } finally {await browser.close();}
});
test('capture inputs cannot escape the project or follow an internal symlink',async t=>{
  const p=await project(t);assert.throws(()=>inside(p.root,'../other'));assert.throws(()=>inside(p.root,'.secrets/password'));
  symlinkSync(path.join(p.root,'public'),path.join(p.root,'alias'));assert.throws(()=>inside(p.root,'alias/guide.pdf'));
  await assert.rejects(runCopyCapture({...p.args,password:'never-record-this'}));
});
