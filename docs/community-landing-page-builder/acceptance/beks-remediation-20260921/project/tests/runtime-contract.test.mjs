import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('login return link works on workers.dev and preserves custom-host routing', async () => {
  const login=await text('public/login.html');
  assert.match(login,/<a href="\/index\.html" class="back-link">/);
  assert.doesNotMatch(login,/href="https:\/\/go\.netbean\.com\//);
  const worker=await text('src/worker.js');
  assert.match(worker,/host\.endsWith\('\.workers\.dev'\).*return 'unified'/);
  assert.match(worker,/siteConfig\.publicHost.*\$\{path\}/s);
});

test('scheduler contract matches the selected five-minute cron', async () => {
  const config=JSON.parse(await text('wrangler.jsonc'));
  const contract=await text('API-CONTRACT.md');
  assert.deepEqual(config.triggers.crons,['*/5 * * * *']);
  assert.match(contract,/configured five-minute cron/);
  assert.match(contract,/Account-action email delivery is at-least-once/);
  assert.doesNotMatch(contract,/cron trigger must run every minute/i);
});
