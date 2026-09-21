import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

let mf;

before(async () => {
  const bundle = await build({
    entryPoints: ['src/worker.js'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022'
  });
  mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-07-22',
    d1Databases: { DB: 'host-routing-tests' },
    bindings: {
      ADMIN_USERNAME: 'owner',
      ADMIN_PASSWORD_HASH: 'not-used-by-host-routing-tests',
      SESSION_SECRET: 'test-only-session-secret-with-at-least-32-bytes'
    },
    serviceBindings: {
      ASSETS: () => new Response('<!doctype html><title>Asset fixture</title>', { headers: { 'Content-Type': 'text/html' } })
    }
  });
  await (await mf.getD1Database('DB')).prepare('CREATE TABLE leads (id TEXT PRIMARY KEY)').run();
});

after(async () => { await mf?.dispose(); });

const fetchAt = (origin, path, init = {}) => mf.dispatchFetch(origin + path, { redirect: 'manual', ...init });

test('public host keeps lead collection public and moves CRM pages without forwarding query data', async () => {
  const login = await fetchAt('https://go.netbean.com', '/login.html?gclid=synthetic-click');
  assert.equal(login.status, 302);
  assert.equal(login.headers.get('Location'), 'https://crm.netbean.com/login.html');
  const admin = await fetchAt('https://go.netbean.com', '/admin/?utm_source=synthetic');
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get('Location'), 'https://crm.netbean.com/admin/');
  assert.equal((await fetchAt('https://go.netbean.com', '/api/admin/leads')).status, 404);
});

test('CRM host serves only auth/admin surfaces and keeps public lead writes on go', async () => {
  const root = await fetchAt('https://crm.netbean.com', '/');
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('Location'), 'https://crm.netbean.com/login.html');
  assert.equal((await fetchAt('https://crm.netbean.com', '/login.html')).status, 200);
  const admin = await fetchAt('https://crm.netbean.com', '/admin/');
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get('Location'), 'https://crm.netbean.com/login.html');
  assert.equal((await fetchAt('https://crm.netbean.com', '/api/leads', {
    method: 'POST', headers: { Origin: 'https://crm.netbean.com', 'Content-Type': 'application/json' }, body: '{}'
  })).status, 404);
  const publicPage = await fetchAt('https://crm.netbean.com', '/privacy.html?utm_source=synthetic');
  assert.equal(publicPage.status, 302);
  assert.equal(publicPage.headers.get('Location'), 'https://go.netbean.com/privacy.html');
  const loginReturn = await fetchAt('https://crm.netbean.com', '/index.html');
  assert.equal(loginReturn.status, 302);
  assert.equal(loginReturn.headers.get('Location'), 'https://go.netbean.com/index.html');
});

test('health identifies each configured host and unconfigured custom hosts fail closed', async () => {
  const publicHealth = await fetchAt('https://go.netbean.com', '/api/health');
  const crmHealth = await fetchAt('https://crm.netbean.com', '/api/health');
  assert.equal((await publicHealth.json()).host_role, 'public');
  assert.equal((await crmHealth.json()).host_role, 'crm');
  assert.equal((await fetchAt('https://bookkeeping-by-beks-demo.account.workers.dev', '/login.html')).status, 200);
  assert.equal((await fetchAt('https://unconfigured.netbean.com', '/')).status, 421);
});
