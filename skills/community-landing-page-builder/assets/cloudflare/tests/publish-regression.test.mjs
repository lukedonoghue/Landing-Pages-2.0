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
