import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright-core';

// The UI/controller/runner are real. Only the research worker is synthetic;
// this is not a signed-in Codex/Claude or cloud-publication acceptance test.
const scripts = fileURLToPath(existsSync(new URL('../scripts/guide.py', import.meta.url))
  ? new URL('../scripts/', import.meta.url) : new URL('../../../scripts/', import.meta.url));
const fixture = String.raw`
import json,sys
from pathlib import Path
sys.path.insert(0,sys.argv[2])
import guide,guide_ui,workflow_runner as runner,workflow_storage as storage
root=Path(sys.argv[1]);guide.start(root,name='Synthetic Cleaning')
class SyntheticBridge:
 def __init__(self):self.last=None
 def worker(self,root,packet,route):
  storage.write(root,'build/discovery.json',{'schema_version':1,'input_fingerprint':guide.research_fingerprint(root),'suggestions':[]})
  return {'status':'done','summary':'Synthetic research fixture only; no external sources contacted.','outputs':['build/discovery.json'],'blockers':[]}
 def wake(self):self.last=runner.drive(root,executor=self.worker);return {'running':False}
 def status(self):return {'running':False,'last':self.last,'next':guide.next_action(root)}
bridge=SyntheticBridge();bridge.wake()
http,token,_=guide_ui.server(root,bridge=bridge)
print(json.dumps({'port':http.server_port,'token':token}),flush=True)
try:http.serve_forever()
finally:http.server_close()
`;

async function startGuide(root) {
  const child = spawn(process.env.PYTHON || 'python3', ['-u', '-c', fixture, root, scripts], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '', stdout = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  try {
    const address = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Guide startup timed out: ' + stderr)), 30000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Guide exited (${code}): ${stderr}`)); });
      child.stdout.on('data', chunk => {
        stdout += chunk;
        for (const line of stdout.split('\n')) {
          try {
            const value = JSON.parse(line);
            if (Number.isInteger(value.port) && typeof value.token === 'string') {
              clearTimeout(timer); resolve(value); return;
            }
          } catch { /* The Python helpers may emit harmless status lines. */ }
        }
      });
    });
    return { child, ...address };
  } catch (error) { child.kill('SIGTERM'); throw error; }
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  test(`${engineName}: guided screen advances actual state, preserves help input and resumes safely`, { timeout: 90000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'community-guide-ui-'));
    const output = fileURLToPath(new URL(`../build/guide-ui-review/${engineName}/`, import.meta.url));
    let server, browser;
    const errors = [], viewports = [];
    try {
      await mkdir(output, { recursive: true });
      server = await startGuide(root);
      browser = await engine.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on('pageerror', error => errors.push(error.message));
      const origin = `http://127.0.0.1:${server.port}`;
      const headers = { Authorization: 'Bearer ' + server.token };
      const status = async () => (await page.request.get(origin + '/api/status', { headers })).json();
      await page.goto(origin + '/#token=' + server.token, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Save answers and continue', exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, '', 'Private link token must leave browser history');
      assert.equal(await page.locator('#questions fieldset').count(), 3);
      for (const [width, height] of [[320, 740], [390, 844], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engineName} overflow at ${width}`);
        await page.screenshot({ path: join(output, `guide-${width}.png`), fullPage: true });
        viewports.push({ width, height, horizontal_overflow: false });
      }
      const service = page.getByLabel('Which service or product should this page promote?', { exact: true });
      await service.fill('Commercial cleaning');
      const before = await status();
      await page.getByRole('button', { name: 'Why does this matter?', exact: true }).first().click();
      await page.waitForTimeout(200);
      assert.equal(await service.inputValue(), 'Commercial cleaning', 'Help must not erase unsaved answers');
      assert.equal((await status()).next.revision, before.next.revision, 'Help must not approve or advance');
      await page.getByLabel('Who is the page for?', { exact: true }).fill('Office managers');
      await page.getByLabel('Where do you serve customers?', { exact: true }).fill('Synthetic service region');
      await page.getByRole('button', { name: 'Save answers and continue', exact: true }).click();
      await page.getByLabel('What are you offering this customer?', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Who is the page for?', { exact: true }).count(), 0, 'Known answer must not be asked again');
      assert.ok(JSON.stringify((await status()).next.summary).includes('Office managers'));
      await page.getByRole('button', { name: 'Save and pause', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#step-title').textContent === 'paused');
      await page.getByRole('button', { name: 'Resume work', exact: true }).click();
      await page.getByLabel('What are you offering this customer?', { exact: true }).waitFor();
      assert.ok(JSON.stringify((await status()).next.summary).includes('Office managers'));
      assert.equal((await page.request.get(origin + '/api/status')).status(), 403);
      assert.equal((await page.request.post(origin + '/api/run', { headers: { ...headers, Origin: 'https://untrusted.invalid' }, data: {} })).status(), 403);
      assert.deepEqual(errors, []);
      await writeFile(join(output, 'result.json'), JSON.stringify({ status: 'pass', engine: engineName, scope: 'Actual loopback wizard/controller/runner; synthetic research only. No native model, email, lead or cloud operation.', viewports, page_errors: errors, answer_advance: true, help_preserves_input: true, pause_resume: true, anonymous_and_cross_origin_denied: true }, null, 2) + '\n');
    } finally {
      await browser?.close();
      await stop(server?.child);
      await rm(root, { recursive: true, force: true });
    }
  });
}
