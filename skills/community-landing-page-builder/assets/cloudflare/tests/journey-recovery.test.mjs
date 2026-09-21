/** Real loopback browser/Worker/D1 interruptions. Only synthetic fixture contacts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, statSync, cpSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { runLiveVerify } from '../scripts/live-verify.mjs';
import { atomic, read, currentSourceFingerprint } from '../scripts/release-tools.mjs';

const template=fileURLToPath(new URL('../',import.meta.url));
const fixture={synthetic:true,path:'/',thank_you_path:'/thank-you.html',pdf_path:'/assets/brochure/catalogue.pdf',fields:{first_name:'Recovery',last_name:'Synthetic',email:'recovery@example.invalid',phone:'+44 7700 900123',service:'Service one',contact_method:'Email'},selectors:{openModal:'[data-open-modal]',modal:'#lead-modal',step:'.wizard__step',next:'[data-next]',submit:'[data-submit]',closeModal:'[data-close-modal]',error:'[data-form-error]',consentAccept:'[data-analytics-consent="accept"]'},query:{utm_source:'google',utm_medium:'cpc'},expected_dimensions:{source:'google',traffic:'paid',device:'desktop'}};
const password='private-synthetic-owner-password',salt='1'.repeat(32);
const encoded=`pbkdf2_sha256$100000$${salt}$${pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex')}`;
const lightbox=[path.join(template,'public/script.js'),path.join(template,'../multistep-lightbox.js')].find(existsSync);

async function site(t) {
  const root=mkdtempSync(path.join(os.tmpdir(),'real-journey-recovery-'));const requests=[];let ip=0,dropNote=false,dropStatus=false;
  cpSync(path.join(template,'src'),path.join(root,'src'),{recursive:true});copyFileSync(path.join(template,'tests/fixtures/site-config.json'),path.join(root,'src/site-config.json'));
  const recoveryConfig=JSON.parse(readFileSync(path.join(root,'src/site-config.json')));
  writeFileSync(path.join(root,'src/site-config.json'),JSON.stringify({...recoveryConfig,analyticsMode:'consent',attributionMode:'consent',consentUiMode:'internal'},null,2));
  mkdirSync(path.join(root,'public/admin'),{recursive:true});mkdirSync(path.join(root,'public/assets/brochure'),{recursive:true});
  for(const name of ['privacy.html','styles.css','login.html','login.js','login.css','funnel.js','privacy-controls.js','privacy-controls.css'])copyFileSync(path.join(template,'public',name),path.join(root,'public',name));
  for(const name of ['index.html','thank-you.html'])copyFileSync(path.join(template,'tests/fixtures/recovery-'+name),path.join(root,'public',name));
  copyFileSync(lightbox,path.join(root,'public/script.js'));
  writeFileSync(path.join(root,'public/admin/index.html'),'<!doctype html><title>Synthetic admin destination</title>');
  writeFileSync(path.join(root,'public/assets/brochure/catalogue.pdf'),'%PDF-1.7\nSynthetic network fixture only');
  const bundled=await build({entryPoints:[path.join(root,'src/worker.js')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-22',d1Databases:{DB:'journey-recovery'},bindings:{ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:encoded,SESSION_SECRET:'synthetic-session-secret-at-least-32-characters'},outboundService:()=>new Response('External requests disabled',{status:503}),serviceBindings:{ASSETS:request=>{
    const pathname=new URL(request.url).pathname;
    const relative=pathname==='/'?'index.html':pathname==='/admin/'?'admin/index.html':pathname.slice(1);
    const file=path.join(root,'public',relative);
    if(!file || !existsSync(file) || !statSync(file).isFile())return new Response('Missing',{status:404});
    return new Response(readFileSync(file),{headers:{'Content-Type':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html'}});
  }}});
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync(path.join(template,'migrations')).filter(name=>name.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(readFileSync(path.join(template,'migrations',file),'utf8')).map(sql=>db.prepare(sql)));
  const server=http.createServer(async(req,res)=>{
    try {
      const buffers=[];for await(const chunk of req)buffers.push(chunk);const body=Buffer.concat(buffers);
      requests.push({path:req.url.split('?')[0],method:req.method});
      const headers={...req.headers,'CF-Connecting-IP':`198.51.100.${++ip%200+1}`};
      const response=await mf.dispatchFetch(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers,...(body.length?{body}:{}),redirect:'manual'});
      if((dropNote && req.method==='POST' && /\/notes$/.test(req.url)) || (dropStatus && req.method==='PATCH')){dropNote=false;dropStatus=false;await response.arrayBuffer();res.destroy();return;}
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(500);res.end('Synthetic server failure');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await mf.dispose();rmSync(root,{recursive:true,force:true});});
  atomic(path.join(root,'build/gate-snapshot.json'),{schema_version:1,mode:'handoff',source_fingerprint:currentSourceFingerprint(root),created_at:new Date().toISOString()});
  atomic(path.join(root,'.secrets/admin.json'),{username:'owner',password});
  const out=path.join(root,'build/journey');
  const args={url:`http://127.0.0.1:${server.address().port}`,fixture,'allow-test-lead':true,'credentials-file':path.join(root,'.secrets/admin.json'),'project-root':root,out};
  const counts=async()=>{const rows=await db.batch(['SELECT COUNT(*) AS n FROM leads','SELECT COUNT(*) AS n FROM visit_events','SELECT COUNT(*) AS n FROM notes',"SELECT COUNT(*) AS n FROM activity WHERE event_type='created'","SELECT COUNT(*) AS n FROM activity WHERE event_type='note_added'"].map(sql=>db.prepare(sql)));return rows.map(value=>value.results[0].n);};
  return {root,out,args,requests,db,counts,dropNextNote:()=>{dropNote=true;},dropNextStatus:()=>{dropStatus=true;}};
}
const failAt=stage=>({checkpoint:async current=>{if(current===stage)throw Error('Synthetic interruption at '+stage);}});
const attempts=f=>read(path.join(f.out,'attempt.json'));
const posts=(f,route)=>f.requests.filter(row=>row.path===route && row.method==='POST').length;
function validateEvidence(f) {
  const source=[path.join(template,'scripts/check_gates.py'),path.join(template,'../../scripts/check_gates.py')].find(existsSync);
  const code='import sys,json;from pathlib import Path;sys.path.insert(0,sys.argv[1]);import check_gates as g;r=Path(sys.argv[2]).resolve();print(json.dumps(g.validate_report(r,json.loads(Path(sys.argv[3]).read_text()),json.loads((r/"build/gate-snapshot.json").read_text()),"local_journey")))';
  const result=spawnSync('python3',['-c',code,path.dirname(source),f.root,path.join(f.out,'local-journey.json')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[]);
}

test('lost acknowledgement retries the exact request and keeps one real lead/visit',async t=>{
  const f=await site(t);
  const failed=await runLiveVerify(f.args,failAt('before-acknowledgement'));assert.equal(failed.fully_verified,false);
  assert.equal(attempts(f).receipt,null);assert.deepEqual(await f.counts(),[1,1,0,1,0]);
  const key=attempts(f).request_key;
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});
  assert.equal(recovered.fully_verified,true,JSON.stringify(recovered.failures));assert.equal(attempts(f).request_key,key);
  assert.deepEqual(await f.counts(),[1,1,1,1,1]);assert.equal(posts(f,'/api/leads'),2);assert.equal(posts(f,'/api/visits'),1);
  assert.equal((await f.db.prepare('SELECT version,status FROM leads').first()).version,2);
  const publicFiles=[path.join(f.out,'attempt.json'),path.join(f.out,'result.json')];
  for(const file of publicFiles){const text=readFileSync(file,'utf8');assert.ok(!text.includes(fixture.fields.email));assert.ok(!text.includes(password));}
  const privateFile=path.join(f.root,'.secrets/journeys',attempts(f).id,'submission.json');assert.equal(statSync(privateFile).mode&0o777,0o600);
  assert.ok(existsSync(path.join(f.out,'runs/001/result.json')));assert.ok(existsSync(path.join(f.out,'runs/002/result.json')));
  validateEvidence(f);
});
test('a lost measured-visit response recovers the same event before the first lead',async t=>{
  const f=await site(t);const failed=await runLiveVerify(f.args,failAt('before-visit-acknowledgement'));
  assert.equal(failed.fully_verified,false);assert.deepEqual(await f.counts(),[0,1,0,0,0]);assert.equal(posts(f,'/api/leads'),0);
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});
  assert.equal(recovered.fully_verified,true,JSON.stringify(recovered.failures));assert.deepEqual(await f.counts(),[1,1,1,1,1]);
  assert.equal(posts(f,'/api/visits'),2);validateEvidence(f);
});
test('after browser completion recovery keeps the original redirect proof and does not resubmit',async t=>{
  const f=await site(t);await runLiveVerify(f.args,failAt('public-complete'));
  const original=attempts(f).public_complete;
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});
  assert.equal(recovered.fully_verified,true,JSON.stringify(recovered.failures));assert.deepEqual(attempts(f).public_complete,original);
  assert.equal(posts(f,'/api/leads'),1);assert.equal(posts(f,'/api/visits'),1);assert.deepEqual(await f.counts(),[1,1,1,1,1]);
  validateEvidence(f);
});
test('a lost committed note response recovers without adding another note or stage update',async t=>{
  const f=await site(t);f.dropNextNote();const failed=await runLiveVerify(f.args);
  assert.equal(failed.fully_verified,false);assert.deepEqual(await f.counts(),[1,1,1,1,1]);
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});
  assert.equal(recovered.fully_verified,true,JSON.stringify(recovered.failures));assert.deepEqual(await f.counts(),[1,1,1,1,1]);
  assert.equal(posts(f,'/api/leads'),1);assert.equal((await f.db.prepare('SELECT version FROM leads').first()).version,2);
  validateEvidence(f);
});
test('lost stage response is reconciled through persisted version without another PATCH',async t=>{
  const f=await site(t);f.dropNextStatus();assert.equal((await runLiveVerify(f.args)).fully_verified,false);
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});assert.equal(recovered.fully_verified,true,JSON.stringify(recovered.failures));
  assert.equal(f.requests.filter(row=>row.method==='PATCH').length,1);assert.deepEqual(await f.counts(),[1,1,1,1,1]);validateEvidence(f);
});
test('cleanup interruption resumes the retained completed journey without recreating a contact',async t=>{
  const f=await site(t);const args={...f.args,'cleanup-test-lead':true};
  const failed=await runLiveVerify(args,failAt('dashboard-complete'));assert.equal(failed.fully_verified,false);
  assert.ok((await f.db.prepare('SELECT deleted_at FROM leads').first()).deleted_at);
  const recovered=await runLiveVerify({...args,'resume-journey':true});assert.equal(recovered.fully_verified,true,JSON.stringify(recovered.failures));
  assert.equal(posts(f,'/api/leads'),1);assert.equal(f.requests.filter(row=>row.method==='DELETE').length,1);assert.deepEqual(await f.counts(),[1,1,1,1,1]);validateEvidence(f);
});
test('changed served source cannot inherit retained browser proof',async t=>{
  const f=await site(t);await runLiveVerify(f.args,failAt('public-complete'));const before=f.requests.length;
  writeFileSync(path.join(f.root,'public/thank-you.html'),'<h1>Changed source without its brochure</h1>');
  await assert.rejects(runLiveVerify({...f.args,'resume-journey':true}),/source changed/);assert.equal(f.requests.length,before);
});
test('concurrent CRM edits are retained and private payload tampering cannot resubmit',async t=>{
  const f=await site(t);await runLiveVerify(f.args,failAt('CRM-status-complete'));
  await f.db.prepare("UPDATE leads SET status='engaged',version=version+1").run();
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});assert.equal(recovered.fully_verified,false);
  assert.equal(recovered.recovery.code,'contact_changed');assert.match(recovered.recovery.instruction,/preserve those edits/);
  assert.equal((await f.db.prepare('SELECT status FROM leads').first()).status,'engaged');assert.equal(posts(f,'/api/leads'),1);
  await assert.rejects(runLiveVerify({...f.args,'read-only':true,'allow-test-lead':false}),/Preserve/);
  await assert.rejects(runLiveVerify({...f.args,fixture:{...fixture,query:{utm_source:'changed'}},'resume-journey':true}),/does not match/);
});
test('a changed private request is blocked before any retry reaches the lead endpoint',async t=>{
  const f=await site(t);await runLiveVerify(f.args,failAt('before-acknowledgement'));
  const file=path.join(f.root,'.secrets/journeys',attempts(f).id,'submission.json');const payload=read(file);payload.form_data.email='changed@example.invalid';atomic(file,payload);
  const recovered=await runLiveVerify({...f.args,'resume-journey':true});assert.equal(recovered.fully_verified,false);assert.equal(posts(f,'/api/leads'),1);assert.deepEqual(await f.counts(),[1,1,0,1,0]);
  assert.equal(recovered.recovery.code,'private_payload');
});
