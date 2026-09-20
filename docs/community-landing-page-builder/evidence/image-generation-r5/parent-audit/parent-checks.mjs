import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = '/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r5/project';
const report = {checks: [], limits: ['Email/phone clicks intercepted before OS dispatch. No messages sent.', 'No form exists: modal/error/grouped-field cases are not validated by this run.', 'Visual relevance and composition assessed separately from these assertions.']};
const check = (name, pass, detail) => report.checks.push({name, pass: Boolean(pass), detail});
const hash = data => createHash('sha256').update(data).digest('hex');
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  for (const file of ['index.html', 'styles.css', ...((await readdir(`${root}/dist/assets`)).map(f => `assets/${f}`))]) {
    check(`Published bytes match ${file}`, hash(await readFile(`${root}/${file}`)) === hash(await readFile(`${root}/dist/${file}`)));
  }
  for (const [width,height] of [[320,700],[390,844],[768,1024],[1024,800],[1280,600],[1440,900]]) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:53621/', {waitUntil:'networkidle'});
    await page.evaluate(() => {
      window.__intents = [];
      document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (link && /^(mailto|tel):/.test(link.getAttribute('href') || '')) {
          event.preventDefault(); window.__intents.push(link.getAttribute('href'));
        }
      }, true);
    });
    check(`No overflow ${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(`Early phone ${width}`, await page.locator('.header-phone').evaluate(e => {
      const r = e.getBoundingClientRect();return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && e.textContent.includes('07467 474356');
    }));
    check(`Hero email expectation ${width}`, await page.locator('.action-note').isVisible() && (await page.locator('.action-note').innerText()).includes('Opens your email app'));
    for (const link of await page.locator('[data-primary-action]').all()) {
      if (!await link.isVisible()) continue;
      await link.scrollIntoViewIfNeeded();await link.focus();await page.keyboard.press('Enter');
      check(`Keyboard quote action ${width}`, await page.evaluate(() => {
        const url = new URL(window.__intents.at(-1));return url.protocol === 'mailto:' && url.pathname === 'info@clarentis.co.uk' && url.searchParams.get('subject') === 'Fixed-fee quote enquiry';
      }));
    }
    for (const summary of await page.locator('.faq-list summary').all()) {
      await summary.scrollIntoViewIfNeeded();await summary.focus();await page.keyboard.press('Enter');
      check(`Keyboard FAQ ${await summary.innerText()} ${width}`, await summary.evaluate(e => e.parentElement.open && document.activeElement === e));
      await page.keyboard.press('Enter');
    }
    const captions=[];
    for (const figure of await page.locator('figure').all()) {
      await figure.scrollIntoViewIfNeeded();await figure.locator('img').evaluate(e => e.decode());
      const caption = figure.locator('figcaption');await caption.scrollIntoViewIfNeeded();
      captions.push(await caption.evaluate(e => {
        const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);const s=getComputedStyle(e);
        return {text:e.textContent, visible:r.top>=0&&r.bottom<=innerHeight&&r.width>0&&s.visibility!=='hidden'&&s.display!=='none',coveredByImage:top?.tagName==='IMG'};
      }));
    }
    check(`Visible illustrative captions ${width}`, captions.every(c => c.visible && !c.coveredByImage && /illustrative/i.test(c.text)), captions);
    check(`Images decoded ${width}`, await page.locator('img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)));
    check(`Four distinct image placements ${width}`, await page.locator('figure img').evaluateAll(es => es.length >= 4 && new Set(es.map(e => e.currentSrc.replace(/-(800|1440)\.webp$/,'.webp'))).size === es.length));
    check(`No page errors ${width}`, errors.length===0, errors);
    check(`Only local loaded resources ${width}`,await page.evaluate(()=>performance.getEntriesByType('resource').every(e=>new URL(e.name).origin===location.origin)));
    await page.close();
  }
} catch (error) {report.error=error.stack;process.exitCode=1;}
finally {
  report.status=!report.error&&report.checks.every(c=>c.pass)?'pass':'blocked';
  await writeFile(new URL('parent-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify({status:report.status,count:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));
