/** Offline fixtures exercise test logging with real child processes, without browsers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applicationRegressions, APPLICATION_TEST_TIMEOUT_MS } from '../scripts/publish-driver.mjs';
import { localRunner } from '../scripts/release-tools.mjs';

test('application regression diagnostics survive failures and only complete passes replace TAP',async t=>{
  const root=mkdtempSync(path.join(tmpdir(),'publish-test-diagnostics-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(path.join(root,'tests'));mkdirSync(path.join(root,'build'));
  const tap=path.join(root,'build/full-regression-publish.tap');
  const previous='# previously successful regression evidence\n';
  writeFileSync(tap,previous);
  writeFileSync(path.join(root,'tests/other.test.mjs'),"import test from 'node:test'; test('other fixture',()=>{});\n");
  writeFileSync(path.join(root,'tests/ignored.mjs'),"throw Error('Not a test file');\n");
  const runner=localRunner(root);
  const logs=[];
  const run=async(command,args,options)=>{
    assert.equal(command,process.execPath);
    assert.deepEqual(args,['--test','--test-concurrency=1','--test-reporter=tap','tests/backend.test.mjs','tests/other.test.mjs']);
    assert.deepEqual(Object.keys(options).sort(),['log','timeout']);
    assert.equal(options.timeout,APPLICATION_TEST_TIMEOUT_MS);
    assert.equal(path.dirname(options.log),path.join(root,'.secrets'));
    logs.push(options.log);
    // The synthetic suite runs as a standalone publish invocation, outside this test harness.
    return runner(command,args,{...options,env:{NODE_TEST_CONTEXT:undefined}});
  };
  for(const scenario of ['failure','skipped','pass']) {
    const body=scenario==='failure'?"throw Error('private assertion detail')":"";
    writeFileSync(path.join(root,'tests/backend.test.mjs'),
      `import test from 'node:test'; console.log('private stdout detail'); console.error('private stderr detail'); test('backend fixture',{skip:${scenario==='skipped'}},()=>{${body}});\n`);
    if(scenario==='pass') {
      await applicationRegressions(root,run);
      assert.match(readFileSync(tap,'utf8'),/^# pass 2$/m);
    } else {
      await assert.rejects(applicationRegressions(root,run),error=>{
        const diagnostic=logs.at(-1);
        assert.ok(error.message.includes(diagnostic));
        assert.doesNotMatch(error.message,/private (?:stdout|stderr|assertion) detail/);
        const saved=readFileSync(diagnostic,'utf8');
        assert.match(saved,/private stdout detail/);assert.match(saved,/private stderr detail/);
        assert.match(saved,scenario==='failure'?/private assertion detail/:/^# skipped 1$/m);
        return true;
      });
      assert.equal(readFileSync(tap,'utf8'),previous);
    }
    assert.equal(statSync(logs.at(-1)).mode&0o777,0o600);
  }
  assert.equal(new Set(logs).size,3);
  assert.equal(statSync(path.join(root,'.secrets')).mode&0o777,0o700);
  assert.deepEqual(readdirSync(path.join(root,'build')),['full-regression-publish.tap']);
  assert.match(readFileSync(logs[0],'utf8'),/private assertion detail/);
});

test('projects without a test suite publish only when application code matches the tested template',async t=>{
  const { createHash } = await import('node:crypto');
  const { templateIntegrity } = await import('../scripts/publish-driver.mjs');
  const root=mkdtempSync(path.join(tmpdir(),'publish-template-integrity-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const template={'src/worker.js':'export default {};\n','src/site-config.json':'{}\n','migrations/0001_crm.sql':'CREATE TABLE leads(id TEXT);\n',
    'public/admin/app.js':'console.log(1);\n','public/admin/index.html':'<h1>CRM</h1>\n','public/login.html':'<form>Sign in</form>\n','public/index.html':'<h1>Your business</h1>\n'};
  const put=(file,body)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),body);};
  const files={};
  for(const [name,body] of Object.entries(template)){put('.community-builder/assets/cloudflare/'+name,body);put(name,body);files['assets/cloudflare/'+name]=createHash('sha256').update(body).digest('hex');}
  put('.community-builder/runtime-manifest.json',JSON.stringify({schema_version:1,files}));
  mkdirSync(path.join(root,'build'));
  // Project content may differ: the site config and landing pages are the client's own.
  put('src/site-config.json','{"name":"Client"}\n'); put('public/index.html','<h1>Client</h1>\n');
  const run=()=>{throw new Error('No test suite should run for a project without tests');};
  assert.equal(await applicationRegressions(root,run),'template-integrity-verified');
  assert.deepEqual(JSON.parse(readFileSync(path.join(root,'build/template-integrity.json'),'utf8')),{status:'passed',template_files:5});
  // The CRM shells are template-owned: an edited shell, or a new file anywhere under
  // admin/, could load unreviewed script under the CRM's own origin.
  for(const [file,body] of [['public/admin/index.html','<script src="lib/x.js"></script>\n'],['public/login.html','<script src="/login-helper.js"></script>\n']]){
    put(file,body);assert.throws(()=>templateIntegrity(root),new RegExp('differs from the tested template.*'+file.replace(/[./]/g,'\\$&')));put(file,template[file]);
  }
  for(const file of ['public/admin/lib/x.js','public/admin/extra.mjs']){
    put(file,'export {};\n');assert.throws(()=>templateIntegrity(root),new RegExp(file.replace(/[./]/g,'\\$&')));rmSync(path.join(root,file));
  }
  assert.equal(templateIntegrity(root),5);
  put('src/worker.js','export default { fetch(){} };\n');
  assert.throws(()=>templateIntegrity(root),/differs from the tested template.*src\/worker\.js/);
  put('src/worker.js',template['src/worker.js']); put('src/extra.js','export const x=1;\n');
  assert.throws(()=>templateIntegrity(root),/src\/extra\.js/);
  rmSync(path.join(root,'src/extra.js')); put('.community-builder/assets/cloudflare/migrations/0001_crm.sql','DROP TABLE leads;\n');
  assert.throws(()=>templateIntegrity(root),/bundle was modified/);
  rmSync(path.join(root,'.community-builder/runtime-manifest.json'));
  assert.throws(()=>templateIntegrity(root),/bundle is missing/);
});

test('a tests folder cannot replace the template check; only an exact legacy suite runs',async t=>{
  const { createHash } = await import('node:crypto');
  const { regressionMode } = await import('../scripts/publish-driver.mjs');
  const root=mkdtempSync(path.join(tmpdir(),'publish-regression-mode-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const put=(file,body)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),body);};
  const sha=body=>createHash('sha256').update(body).digest('hex');
  const worker='export default {};\n',suite="import test from 'node:test'; test('backend',()=>{});\n";
  put('.community-builder/assets/cloudflare/src/worker.js',worker);put('src/worker.js',worker);mkdirSync(path.join(root,'build'));
  const manifest=files=>put('.community-builder/runtime-manifest.json',JSON.stringify({schema_version:1,files:{'assets/cloudflare/src/worker.js':sha(worker),...files}}));
  // Current bundle: a trivial tests/ suite beside modified Worker code is still refused.
  manifest({});put('tests/backend.test.mjs',"import test from 'node:test'; test('ok',()=>{});\n");put('src/worker.js','export default {fetch(){return new Response("modified")}};\n');
  assert.equal(regressionMode(root),'integrity');
  await assert.rejects(applicationRegressions(root,()=>{throw new Error('The project suite must not run');}),/differs from the tested template.*src\/worker\.js/);
  put('src/worker.js',worker);
  // Legacy bundle (it still hashes the template tests): only that exact suite may run.
  manifest({'assets/cloudflare/tests/backend.test.mjs':sha(suite)});
  assert.throws(()=>regressionMode(root),/differs from the template suite.*tests\/backend\.test\.mjs/);
  put('tests/backend.test.mjs',suite);assert.equal(regressionMode(root),'suite');
  put('tests/extra.test.mjs',"import test from 'node:test'; test('extra',()=>{});\n");
  assert.throws(()=>regressionMode(root),/tests\/extra\.test\.mjs/);
  rmSync(path.join(root,'tests/extra.test.mjs'));rmSync(path.join(root,'tests/backend.test.mjs'));
  assert.throws(()=>regressionMode(root),/tests\/backend\.test\.mjs/);
  // No bundle at all is the template's own CI, which runs its suite.
  rmSync(path.join(root,'.community-builder'),{recursive:true});put('tests/backend.test.mjs',suite);
  assert.equal(regressionMode(root),'suite');
});
