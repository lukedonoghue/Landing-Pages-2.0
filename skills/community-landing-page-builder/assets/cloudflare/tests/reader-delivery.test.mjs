import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright-core';

const exec = promisify(execFile);
const scripts = fileURLToPath(existsSync(new URL('../scripts/build_guide.py', import.meta.url))
  ? new URL('../scripts/', import.meta.url) : new URL('../../../scripts/', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/reader_guide_fixture.py', import.meta.url));

for (const [engineName, engine] of Object.entries({chromium, webkit})) {
  test(`${engineName}: actual PDF and full shared confirmation have honest receipt states`, {timeout: 120000}, async () => {
    const root = await mkdtemp(join(tmpdir(), 'reader-delivery-'));
    const evidence = fileURLToPath(new URL(`../build/reader-delivery-review/${engineName}/`, import.meta.url));
    let server, browser;
    const requests = [], errors = [];
    try {
      await exec(process.env.PYTHON || 'python3', [fixture, root, scripts], {timeout: 60000});
      const publicRoot = resolve(root, 'public');
      server = http.createServer(async (request, response) => {
        requests.push({method: request.method, path: request.url});
        if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405);response.end();return;}
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        if (pathname === '/favicon.ico') {response.writeHead(204);response.end();return;}
        const file = resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(publicRoot + sep)) {response.writeHead(403);response.end();return;}
        try {
          const bytes = await readFile(file);
          const type = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.pdf':'application/pdf','.png':'image/png'}[extname(file)] || 'application/octet-stream';
          response.writeHead(200, {'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store'});
          response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch {response.writeHead(404);response.end('Not found');}
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      browser = await engine.launch({headless:true});
      await mkdir(evidence, {recursive:true});
      for (const [state, receipt, accepted] of [
        ['direct', null, false],
        ['accepted', {receipt_id:'synthetic-server-accepted-receipt', created_at:Date.now()}, true],
        ['expired', {receipt_id:'old-receipt', created_at:Date.now()-7200000}, false],
        ['malformed', {receipt_id:{private:'wrong shape'}, created_at:'never'}, false]
      ]) {
        const context = await browser.newContext({viewport:{width:390,height:844}});
        try {
          await context.addInitScript(value => {
            if(value) sessionStorage.setItem('funnel_v2_receipt', JSON.stringify(value));
          }, receipt);
          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(origin+'/thank-you.html', {waitUntil:'networkidle'});
          assert.equal(await page.locator('[data-confirmed-only]').first().isVisible(), accepted, state);
          assert.equal(await page.locator('[data-unconfirmed-only]').first().isVisible(), !accepted, state);
          assert.equal(await page.locator('h1:visible').count(),1);
          assert.equal(await page.locator('form,[data-open-modal]').count(),0);
          for(const id of ['benefits','proof','process','questions'])assert.equal(await page.locator('#'+id).count(),1);
          assert.equal(await page.locator('header a[href="tel:02079460000"]').count(),1);
          const cover=page.locator('[data-guide-cover]');
          assert.equal(await cover.evaluate(image=>image.complete && image.naturalWidth>0),true);
          const pdf=await page.request.get(origin+await page.locator('[data-guide-download]').first().getAttribute('href'));
          assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
          await page.locator('[data-guide-reader] summary').click();
          assert.equal(await page.locator('[data-guide-embed]').isVisible(),true);
          if(state==='accepted') {
            for(const [width,height] of [[320,740],[390,844],[1440,900]]) {
              await page.setViewportSize({width,height});
              assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
              await page.locator('[data-guide-reader] details').evaluate(node=>node.open=false);
              await page.screenshot({path:join(evidence,`thank-you-${width}.png`),fullPage:true});
            }
          }
        } finally {await context.close();}
      }
      assert.deepEqual(errors,[]);
      assert.equal(requests.some(request=>!['GET','HEAD'].includes(request.method)),false,'No new lead or conversion POST');
      await copyFile(join(root,'public/assets/brochure/service-guide.pdf'),join(evidence,'synthetic-reader-guide.pdf'));
      await copyFile(join(root,'public/assets/brochure/service-guide-cover.png'),join(evidence,'synthetic-guide-cover.png'));
      await writeFile(join(evidence,'result.json'),JSON.stringify({status:'pass',engine:engineName,scope:'Actual Python PDF and derived HTML; synthetic copy, supplied graphics and receipt fixture. No real customer/provider/model operation.',states:['direct','accepted','expired','malformed'],viewports:[320,390,1440],page_errors:errors,non_read_requests:0},null,2));
    } finally {
      await browser?.close();
      if(server)await new Promise(resolve=>server.close(resolve));
      await rm(root,{recursive:true,force:true});
    }
  });
}
