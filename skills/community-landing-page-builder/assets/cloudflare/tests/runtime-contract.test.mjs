import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('login return link works on a unified workers.dev host', async () => {
  const login=await text('public/login.html');
  assert.match(login,/<a href="\/index\.html" class="back-link">/);
  assert.doesNotMatch(login,/href="https:\/\//);
});

test('scheduler contract matches the selected five-minute cron', async () => {
  const config=JSON.parse(await text('wrangler.jsonc'));
  const contract=await text('API-CONTRACT.md');
  assert.deepEqual(config.triggers.crons,['*/5 * * * *']);
  assert.match(contract,/configured five-minute cron/);
  assert.match(contract,/Account-action email delivery is at-least-once/);
  assert.doesNotMatch(contract,/cron trigger must run every minute/i);
});

test('contract states the analytics default that new builds actually ship', async () => {
  const [contract, config, sync, page] = await Promise.all(['API-CONTRACT.md', 'src/site-config.json', 'scripts/sync-config.mjs', 'public/index.html'].map(text));
  const shipped = JSON.parse(config).analyticsMode;
  assert.equal(shipped, 'disabled');
  assert.match(sync, /const mode=funnel\.analytics\?\.mode\|\|'disabled';/);
  assert.match(page, /data-analytics-mode="disabled"/);
  assert.match(contract, new RegExp(`New builds default to \`analytics\\.mode: "${shipped}"\``));
  assert.doesNotMatch(contract, /Analytics mode is `consent` by default|`essential` permits measurement without that flag/);
});
