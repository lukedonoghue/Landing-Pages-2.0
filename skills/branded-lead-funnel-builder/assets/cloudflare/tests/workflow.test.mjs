/** Isolated publishing workflow regressions. No GitHub/Cloudflare connection is made. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const template = dirname(here);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const node = process.execPath;
const write = (root, name, value) => { const path = join(root, name); mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'funnel-workflow-test-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  write(root, 'package.json', {type:'module'});
  for (const name of ['setup','preflight','publish','publish-driver','release-tools','journey-state','browser-compat','live-verify','github']) {
    mkdirSync(join(root, 'scripts'), {recursive:true});
    copyFileSync(join(template, 'scripts', `${name}.mjs`), join(root, 'scripts', `${name}.mjs`));
  }
  // In a generated project, check_gates.py is beside these scripts; in the skill source it is outside the template.
  const checker = [join(template, 'scripts/check_gates.py'), fileURLToPath(new URL('../../../scripts/check_gates.py', import.meta.url))].find(existsSync);
  assert.ok(checker, 'Evidence checker source exists');
  copyFileSync(checker, join(root, 'scripts/check_gates.py'));
  for (const name of ['release_state','workflow','workflow_storage','workflow_progress','copy_library','image_workflow','copy_parity']) {
    const source=[join(template, 'scripts', name+'.py'),fileURLToPath(new URL('../../../scripts/'+name+'.py',import.meta.url))].find(existsSync);
    assert.ok(source);copyFileSync(source,join(root,'scripts',name+'.py'));
  }
  write(root, 'wrangler.jsonc', {name:'workflow-fixture', account_id:'a'.repeat(32), assets:{directory:'public',run_worker_first:true}, version_metadata:{binding:'CF_VERSION_METADATA'}, d1_databases:[{binding:'DB',database_name:'workflow-fixture-crm',database_id:'11111111-1111-4111-8111-111111111111'}]});
  write(root, 'src/site-config.json', {name:'Workflow fixture'});
  write(root, 'funnel.json', {catalogue:{enabled:false}});
  write(root, 'public/index.html', '<!doctype html><title>Workflow fixture</title><script src="funnel.js" defer></script><h1>Fixture</h1>');
  write(root, 'public/thank-you.html', '<!doctype html><title>Thank you</title><script src="funnel.js" data-measure="false" defer></script>');
  write(root,'public/privacy.html','<!doctype html><title>Privacy fixture</title><script src="funnel.js" data-measure="false" defer></script>');
  for(const name of ['funnel.js','privacy-controls.js','privacy-controls.css'])copyFileSync(join(template,'public',name),join(root,'public',name));
  // This executable logs requests instead of using the network or mutating Cloudflare.
  write(root, 'node_modules/wrangler/bin/wrangler.js', `import {appendFileSync} from 'node:fs';appendFileSync('wrangler-calls.log',JSON.stringify(process.argv.slice(2))+'\\n');if(process.argv.includes('list'))console.log('[]');`);
  return root;
}
function execute(root, script, args=[], env={}) {
  return spawnSync(node, [`scripts/${script}.mjs`, ...args], {cwd:root, encoding:'utf8', env:{...process.env, CI:'', ...env}});
}
function setupScope(root, copyApproved=true) {
  write(root,'build/setup-request.txt','Synthetic regression scope only: set up the fixture Cloudflare project.');
  write(root,'scripts/workflow.py',`import sys\nprint('Synthetic approval plumbing fixture, not real approval')\nsys.exit(${copyApproved ? 0 : 1})\n`);
  return ['--authorization-file','build/setup-request.txt','--authorization-message-id','synthetic-test-only'];
}
function evidence(root) {
  const snap = spawnSync('python3', ['scripts/check_gates.py','snapshot','.', '--mode','handoff'], {cwd:root,encoding:'utf8'});
  assert.equal(snap.status, 0, snap.stderr + snap.stdout);
  const snapshot = JSON.parse(readFileSync(join(root, 'build/gate-snapshot.json')));
  const image = 'SYNTHETIC test artifact, never production visual evidence';
  write(root, 'build/test-image.png', image);
  const artifact = {path:'build/test-image.png',type:'screenshot',sha256:digest(image)};
  const manifest = {schema_version:1,snapshot,gates:{}};
  for (const gate of ['static','browser','visual']) {
    const report = {schema_version:1,gate,status:'pass',source_fingerprint:snapshot.source_fingerprint,executed_at:new Date().toISOString(),tool:{name:'synthetic workflow regression fixture',version:'1'},target:{mode:'handoff'},checks:[{name:'synthetic test fixture',status:'pass',detail:'Tests preflight integrity plumbing, not a client build'}]};
    if(gate==='browser')Object.assign(report,{execution:{kind:'automated'},viewports:[360,390,768,1024,1180,1280,1440].map(width=>({width,height:600})),artifacts:[artifact]});
    if(gate==='visual')Object.assign(report,{reviewer:'synthetic workflow test',observations:['Synthetic fixture only'],artifacts:[artifact]});
    const text = JSON.stringify(report);
    write(root, `build/${gate}.json`, text);
    manifest.gates[gate]={status:'pass',report:`build/${gate}.json`,report_sha256:digest(text)};
  }
  write(root, 'build/gates.json', manifest);
}

test('preflight accepts a complete integrity fixture and blocks a changed artifact', t => {
  const root=fixture(t);evidence(root);
  let result=execute(root,'preflight');
  assert.equal(result.status,0,result.stderr+result.stdout);
  write(root,'build/test-image.png','changed screenshot');
  result=execute(root,'preflight');
  assert.notEqual(result.status,0);
  assert.match(result.stdout+result.stderr,/Artifact hash mismatch|stale/i);
});

test('fictional demos reject remote setup before configuration or Cloudflare changes', t => {
  const root = fixture(t);
  write(root, 'funnel.json', { development_fixture: true });
  const before = readFileSync(join(root, 'wrangler.jsonc'), 'utf8');
  const result = execute(root, 'setup', ['--cloudflare', '--site', 'must-not-create', ...setupScope(root)]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Fictional development fixtures/);
  assert.equal(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'), before);
  assert.equal(existsSync(join(root, 'wrangler-calls.log')), false);
  assert.equal(existsSync(join(root, '.secrets/production.json')), false);
});

test('remote setup rejects the shared starter name before any Cloudflare command', t => {
  const root=fixture(t);
  const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc')));config.name='branded-lead-funnel';write(root,'wrangler.jsonc',config);
  const result=execute(root,'setup',['--cloudflare','--account-id','a'.repeat(32)]);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/unique|starter/i);
  assert.equal(existsSync(join(root,'wrangler-calls.log')),false);
});

test('existing exact-name database is not silently adopted', t => {
  const root=fixture(t);
  const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc')));config.d1_databases[0].database_id='00000000-0000-0000-0000-000000000000';write(root,'wrangler.jsonc',config);
  write(root,'node_modules/wrangler/bin/wrangler.js',`if(process.argv.includes('list'))console.log(JSON.stringify([{name:'workflow-fixture-crm',uuid:'11111111-1111-4111-8111-111111111111'}]));`);
  const result=execute(root,'setup',['--cloudflare','--account-id','a'.repeat(32),...setupScope(root)]);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/database-id/);
  assert.equal(JSON.parse(readFileSync(join(root,'wrangler.jsonc'))).d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');
});

test('publish refuses missing production credentials before remote mutations', t => {
  const root=fixture(t);
  const result=execute(root,'publish');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/credentials|secrets/i);
  assert.equal(existsSync(join(root,'wrangler-calls.log')),false);
});

for (const filename of ['public/.env.local','public/private-key.pem','public/credentials.json','public/production-admin-password.txt','public/erasure-record.json']) {
  test(`preflight rejects ${filename} even without secret variable names`, t=>{
    const root=fixture(t);
    write(root,filename,'synthetic-sensitive-fixture-value');evidence(root);
    const result=execute(root,'preflight');
    assert.notEqual(result.status,0,result.stdout);
    assert.match(result.stderr,/secret|credential|password|private/i);
  });
}

test('preflight detects the generated production password copied under an innocent public name',t=>{
  const root=fixture(t);
  write(root,'.secrets/production-admin-password.txt','synthetic-password-from-setup\n');
  write(root,'public/note.txt','synthetic-password-from-setup');evidence(root);
  const result=execute(root,'preflight');
  assert.notEqual(result.status,0,result.stdout);
  assert.match(result.stderr,/secret|credential|password/i);
});

test('GitHub publishing rejects a same-path origin at another host before stage or push', t=>{
  const root=fixture(t);mkdirSync(join(root,'.git'));
  const binary=join(root,'fake-bin/git');
  write(root,'fake-bin/git',`#!${node}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync('git-calls.log',JSON.stringify(args)+'\\n');if(args[0]==='remote')console.log('https://unrelated.example/owner/repository.git');`);
  // Extensionless executable runs as CommonJS outside a package declaration in its own directory.
  write(root,'fake-bin/package.json',{type:'commonjs'});chmodSync(binary,0o755);
  evidence(root);
  const result=execute(root,'github',['--repo','owner/repository'],{PATH:join(root,'fake-bin')+':'+process.env.PATH});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/requested github.com|origin/i);
  const calls=readFileSync(join(root,'git-calls.log'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.some(args=>['add','commit','push'].includes(args[0])),false);
});

test('remote setup cannot contact Cloudflare without explicit existing scope and current copy approval', t => {
  for (const mode of ['missing-scope','copy-not-approved']) {
    const root=fixture(t);
    const extra=mode==='copy-not-approved'?setupScope(root,false):[];
    const result=execute(root,'setup',['--cloudflare',...extra]);
    assert.notEqual(result.status,0);
    assert.equal(existsSync(join(root,'wrangler-calls.log')),false,mode);
    assert.equal(existsSync(join(root,'build/setup-authorization.json')),false,mode);
  }
});

test('publish never sends credentials to an unrelated verification URL', t => {
  const root=fixture(t);
  write(root,'.secrets/production.json',{ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:'synthetic-hash-not-valid-login',SESSION_SECRET:'synthetic-session-secret-long-value'});
  write(root,'.secrets/production-admin-password.txt','synthetic-password');
  write(root,'scripts/workflow.py',"print('Synthetic approval/check plumbing fixture only')\n");
  write(root,'build/workflow.json',{approvals:{publish:{allow_test_lead:true}}});
  write(root,'scripts/preflight.mjs',"// The URL-target test stubs prior checks; it is not production approval.\n");
  write(root,'tests/backend.test.mjs',"import test from 'node:test';test('synthetic prior-check fixture',()=>{});\n");
  write(root,'test-fixture.json',{});
  write(root,'node_modules/wrangler/bin/wrangler.js',"import {appendFileSync} from 'node:fs';appendFileSync('wrangler-calls.log',JSON.stringify(process.argv.slice(2)));if(process.argv[2]==='deploy')console.log('https://workflow-fixture.account.workers.dev');");
  const result=execute(root,'publish',['--url','https://unrelated.example']);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/not a reviewed custom domain|No credentials were sent/);
  assert.equal(existsSync(join(root,'verification-contacted.txt')),false);
  assert.equal(existsSync(join(root,'wrangler-calls.log')),false);
});


test('preflight blocks a removed persistent privacy control before publishing',t=>{
  const root=fixture(t);write(root,'public/privacy.html','<!doctype html><title>Privacy</title>');evidence(root);
  const result=execute(root,'preflight');assert.notEqual(result.status,0);assert.match(result.stderr,/privacy.html must load funnel.js/);assert.equal(existsSync(join(root,'wrangler-calls.log')),false);
});
