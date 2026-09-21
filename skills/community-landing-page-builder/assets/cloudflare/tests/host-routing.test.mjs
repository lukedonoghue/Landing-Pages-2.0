import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const hosts={publicHost:'go.example.com',crmHost:'crm.example.com'};
let mf;

before(async () => {
  const bundle = await build({
    entryPoints: ['src/worker.js'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    plugins:[{name:'host-config-fixture',setup(build){build.onLoad({filter:/site-config\.json$/},()=>({contents:JSON.stringify(hosts),loader:'json'}));}}]
  });
  mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-07-22',
    d1Databases: { DB: 'host-routing-tests' },
    bindings: { ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:'not-used-by-host-routing-tests',SESSION_SECRET:'test-only-session-secret-with-at-least-32-bytes' },
    serviceBindings: { ASSETS: () => new Response('<!doctype html><title>Asset fixture</title>', { headers: { 'Content-Type': 'text/html' } }) }
  });
  await (await mf.getD1Database('DB')).prepare('CREATE TABLE leads (id TEXT PRIMARY KEY)').run();
});

after(async () => { await mf?.dispose(); });
const fetchAt = (origin, path, init = {}) => mf.dispatchFetch(origin + path, { redirect: 'manual', ...init });

test('public host keeps lead collection public and moves CRM pages without query data', async () => {
  const login=await fetchAt('https://go.example.com','/login.html?gclid=synthetic-click');
  assert.equal(login.status,302);assert.equal(login.headers.get('Location'),'https://crm.example.com/login.html');
  const admin=await fetchAt('https://go.example.com','/admin/?utm_source=synthetic');
  assert.equal(admin.status,302);assert.equal(admin.headers.get('Location'),'https://crm.example.com/admin/');
  assert.equal((await fetchAt('https://go.example.com','/api/admin/leads')).status,404);
});

test('CRM host isolates auth and routes the login return path to the public host', async () => {
  assert.equal((await fetchAt('https://crm.example.com','/login.html')).status,200);
  const landing=await fetchAt('https://crm.example.com','/index.html');
  assert.equal(landing.status,302);assert.equal(landing.headers.get('Location'),'https://go.example.com/index.html');
  assert.equal((await fetchAt('https://crm.example.com','/api/leads',{method:'POST',headers:{Origin:'https://crm.example.com','Content-Type':'application/json'},body:'{}'})).status,404);
});

test('workers.dev stays unified while unknown custom hosts fail closed', async () => {
  assert.equal((await fetchAt('https://fixture.account.workers.dev','/login.html')).status,200);
  const health=await fetchAt('https://go.example.com','/api/health');
  assert.equal((await health.json()).host_role,'public');
  assert.equal((await fetchAt('https://unknown.example.com','/')).status,421);
});
