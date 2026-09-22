import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import gateway from '../pages-gateway/_worker.js';
import { buildPagesGateway } from '../scripts/build-pages-gateway.mjs';

const options = { project: 'synthetic-gateway', pagesHost: 'synthetic-gateway.pages.dev', accountId: '1'.repeat(32), publicHost: 'go.example.invalid', crmHost: 'crm.example.invalid' };
const vars = { GATEWAY_PROJECT: options.project, GATEWAY_PAGES_HOST: options.pagesHost, GATEWAY_PUBLIC_HOST: options.publicHost, GATEWAY_CRM_HOST: options.crmHost };
const worker = { name: 'synthetic-funnel', main: 'src/worker.js', account_id: options.accountId, vars: { SECRET: 'must-not-be-copied' }, d1_databases: [{ binding: 'DB' }], triggers: { crons: ['* * * * *'] } };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pages-gateway-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'wrangler.jsonc'), JSON.stringify(worker));
  return root;
}

test('all three exact hosts pass the original Request and Response objects unchanged', async () => {
  for (const host of [options.publicHost, options.crmHost, options.pagesHost]) {
    const request = new Request(`https://${host}/api/auth/login?a=1&a=2&next=https%3A%2F%2Fevil.invalid`, { method: 'POST', headers: { Origin: `https://${host}`, Cookie: 'session=synthetic' }, body: 'original-body' });
    const response = new Response('original-response', { status: 409, headers: { 'Set-Cookie': 'session=new; HttpOnly; Secure', 'X-Backend': 'intact' } });
    let calls = 0;
    const result = await gateway.fetch(request, { ...vars, FUNNEL: { async fetch(received) { calls++; assert.equal(received, request); assert.equal(await received.text(), 'original-body'); return response; } } });
    assert.equal(result, response);
    assert.equal(calls, 1);
  }
});

test('preview, unknown, suffix attacks, ports and insecure URLs never reach the binding', async () => {
  const urls = ['https://preview.synthetic-gateway.pages.dev/', 'https://abc123.synthetic-gateway.pages.dev/', 'https://other.pages.dev/', 'https://go.example.invalid.evil.invalid/', 'https://unknown.example.invalid/', 'https://go.example.invalid:8443/', 'http://go.example.invalid/', 'https://go.example.invalid./'];
  for (const url of urls) {
    const result = await gateway.fetch(new Request(url, { headers: { Host: options.publicHost, 'X-Forwarded-Host': options.crmHost } }), { ...vars, FUNNEL: { fetch() { assert.fail('Unapproved host reached backend'); } } });
    assert.equal(result.status, 421, url);
  }
});

test('invalid configuration and absent or failed service binding fail closed without retries', async () => {
  const request = new Request(`https://${options.publicHost}/`);
  for (const env of [{}, { ...vars }, { ...vars, FUNNEL: {} }, { ...vars, GATEWAY_PUBLIC_HOST: '*.example.invalid' }, { ...vars, GATEWAY_PAGES_HOST: 'preview.synthetic-gateway.pages.dev' }]) {
    assert.equal((await gateway.fetch(request, env)).status, 503);
  }
  let calls = 0;
  const result = await gateway.fetch(request, { ...vars, FUNNEL: { fetch() { calls++; throw new Error('private backend detail'); } } });
  assert.equal(result.status, 502);
  assert.equal(calls, 1);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.doesNotMatch(await result.text(), /private backend detail/);
});

test('builder emits only the gateway, all-routes manifest and isolated Pages configuration', async t => {
  const root = await fixture(t);
  const { output, config } = await buildPagesGateway(options, root);
  assert.deepEqual((await readdir(output)).sort(), ['public', 'wrangler.jsonc']);
  assert.deepEqual((await readdir(join(output, 'public'))).sort(), ['_routes.json', '_worker.js']);
  assert.deepEqual(config.services, [{ binding: 'FUNNEL', service: worker.name }]);
  assert.deepEqual(config.vars, vars);
  assert.deepEqual(Object.keys(config).sort(), ['compatibility_date', 'name', 'pages_build_output_dir', 'services', 'vars']);
  assert.equal(config.pages_build_output_dir, './public');
  assert.deepEqual(JSON.parse(await readFile(join(output, 'public/_routes.json'), 'utf8')), { version: 1, include: ['/*'], exclude: [] });
  assert.equal(await readFile(join(output, 'public/_worker.js'), 'utf8'), await readFile(new URL('../pages-gateway/_worker.js', import.meta.url), 'utf8'));
  assert.doesNotMatch(await readFile(join(output, 'wrangler.jsonc'), 'utf8'), /must-not-be-copied|d1_databases|crons/);
  assert.doesNotMatch(await readFile(join(output, 'wrangler.jsonc'), 'utf8'), /account_id/);
  await buildPagesGateway(options, root);
  await writeFile(join(output, 'public', 'unexpected.txt'), 'do not publish me');
  await assert.rejects(buildPagesGateway(options, root), /unexpected files/);
});

test('builder validates account, project, backend and hosts before generating files', async t => {
  const root = await fixture(t);
  for (const change of [
    { project: '../escape' }, { project: '-bad' }, { project: 'A'.repeat(64) },
    { pagesHost: 'different.pages.dev' }, { pagesHost: 'preview.synthetic-gateway.pages.dev' },
    { accountId: 'wrong' }, { accountId: '2'.repeat(32) },
    { publicHost: 'https://go.example.invalid' }, { publicHost: '*.example.invalid' },
    { publicHost: 'example.invalid' }, { publicHost: 'go.example.invalid:443' },
    { publicHost: '127.0.0.1' }, { publicHost: options.crmHost },
    { crmHost: 'preview.other.pages.dev' }
  ]) await assert.rejects(buildPagesGateway({ ...options, ...change }, root));
  assert.deepEqual(await readdir(root), ['wrangler.jsonc']);
  for (const change of [{ name: 'https://evil.invalid' }, { account_id: undefined }, { env: { production: {} } }, { pages_build_output_dir: './public' }]) {
    await writeFile(join(root, 'wrangler.jsonc'), JSON.stringify({ ...worker, ...change }));
    await assert.rejects(buildPagesGateway(options, root));
  }
  await writeFile(join(root, 'wrangler.jsonc'), JSON.stringify(worker));
  const outside = await mkdtemp(join(tmpdir(), 'gateway-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(root, 'build'));
  await assert.rejects(buildPagesGateway(options, root), /real directory/);
  assert.deepEqual(await readdir(outside), []);
});

test('two real Miniflare Workers preserve URL, Origin, cookies, bodies, redirects and static responses', async t => {
  const root = await fixture(t);
  const { output, config } = await buildPagesGateway(options, root);
  const script = await readFile(join(output, 'public/_worker.js'), 'utf8');
  const backend = `export default { async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return new Response('CSRF blocked', { status:403 });
    const headers = new Headers({ 'X-Backend':'intact', 'Cache-Control':'private, no-store' });
    headers.append('Set-Cookie', 'session=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('Set-Cookie', 'second=synthetic; Path=/; Secure');
    if (url.pathname === '/redirect') { headers.set('Location', url.origin + '/admin/?keep=1'); return new Response(null, {status:302, headers}); }
    if (url.pathname === '/assets/pixel.bin') { headers.set('ETag', '"synthetic"'); return new Response(new Uint8Array([0,255,3,128]), {status:206,headers}); }
    return new Response(JSON.stringify({ url:request.url, method:request.method, origin:request.headers.get('Origin'), cookie:request.headers.get('Cookie'), body:Array.from(new Uint8Array(await request.arrayBuffer())) }), {status:207,headers});
  } };`;
  const mf = new Miniflare({ workers: [
    { name: 'gateway', modules: true, script, compatibilityDate: config.compatibility_date, bindings: config.vars, serviceBindings: { FUNNEL: worker.name } },
    { name: worker.name, modules: true, script: backend, compatibilityDate: config.compatibility_date }
  ] });
  t.after(() => mf.dispose());
  for (const host of [options.publicHost, options.crmHost, options.pagesHost]) {
    const url = `https://${host}/api/auth/login?a=1&a=2&encoded=%2F%3F`;
    const response = await mf.dispatchFetch(url, { method: 'POST', headers: { Origin: `https://${host}`, Cookie: 'session=incoming' }, body: new Uint8Array([0, 255, 10, 128]), redirect: 'manual' });
    assert.equal(response.status, 207);
    assert.deepEqual(await response.json(), { url, method: 'POST', origin: `https://${host}`, cookie: 'session=incoming', body: [0, 255, 10, 128] });
    assert.deepEqual(response.headers.getSetCookie(), ['session=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax', 'second=synthetic; Path=/; Secure']);
    assert.equal(response.headers.get('X-Backend'), 'intact');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
  assert.equal((await mf.dispatchFetch(`https://${options.crmHost}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://attacker.invalid' }, body: 'original' })).status, 403);
  const redirect = await mf.dispatchFetch(`https://${options.crmHost}/redirect`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('Location'), `https://${options.crmHost}/admin/?keep=1`);
  const asset = await mf.dispatchFetch(`https://${options.publicHost}/assets/pixel.bin`);
  assert.equal(asset.status, 206);
  assert.equal(asset.headers.get('ETag'), '"synthetic"');
  assert.deepEqual([...new Uint8Array(await asset.arrayBuffer())], [0, 255, 3, 128]);
  assert.equal((await mf.dispatchFetch('https://preview.synthetic-gateway.pages.dev/')).status, 421);
});
