/** Read rendered public copy. Optional form writes require explicit synthetic-test scope. */
import { readFileSync, mkdirSync, realpathSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs, checkedTarget, sameOriginUrl, loadFixture, makeReport, fillSteps, finish, writeReport, check } from './browser-compat.mjs';
import { testRunOptions } from './live-verify.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function inside(root, value) {
  const target = path.resolve(root, value);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) ||
      relative.split(path.sep).some(part => ['.secrets', '.git', '.wrangler', 'node_modules'].includes(part))) {
    throw new Error('Copy evidence must stay inside the project and outside private/runtime folders.');
  }
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('Copy evidence paths cannot use symlinks.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

export async function renderedText(page, selector = 'body') {
  return page.locator(selector).first().evaluate(root => {
    const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
    function textVisible(node) {
      if (!node.textContent.trim()) return true;
      const parent = node.parentElement;
      if (getComputedStyle(parent).visibility === 'hidden') return false;
      const range = document.createRange(); range.selectNodeContents(node);
      const rectangles = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      if (!rectangles.length) return false;
      for (const rectangle of rectangles) {
        if (rectangle.right <= 0 || rectangle.left >= document.documentElement.scrollWidth) return false;
        let scrollPortX = null, scrollPortY = null;
        for (let ancestor = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
          if (style.clip !== 'auto' && /rect\(0(?:px)?,?\s*0(?:px)?,?\s*0(?:px)?,?\s*0(?:px)?\)/.test(style.clip)) return false;
          if (style.clipPath === 'inset(50%)') return false;
          const reachableX = scrollPortX && scrollPortX.left >= box.left - 1 && scrollPortX.right <= box.right + 1;
          const reachableY = scrollPortY && scrollPortY.top >= box.top - 1 && scrollPortY.bottom <= box.bottom + 1;
          if (['hidden', 'clip'].includes(style.overflowX) && !reachableX && (rectangle.left < box.left - 1 || rectangle.right > box.right + 1)) return false;
          if (['hidden', 'clip'].includes(style.overflowY) && !reachableY && (rectangle.top < box.top - 1 || rectangle.bottom > box.bottom + 1)) return false;
          if (['auto', 'scroll'].includes(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth) scrollPortX = box;
          if (['auto', 'scroll'].includes(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight) scrollPortY = box;
        }
      }
      return true;
    }
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return textVisible(node) ? node.textContent : '';
      if (node.nodeType !== Node.ELEMENT_NODE || ignored.has(node.tagName)) return '';
      const style = getComputedStyle(node);
      if (style.display === 'none' || Number(style.opacity) === 0) return '';
      // Capture authored controls, never the entered synthetic/contact values.
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)) {
        if (style.visibility === 'hidden' || !node.getClientRects().length) return '';
        if (node.tagName === 'SELECT') return '\n' + [...node.options].filter(option => !option.hidden).map(option => option.label).join('\n') + '\n';
        if (['submit', 'button', 'reset'].includes(node.type)) return '\n' + node.value + '\n';
        return '\n' + (node.getAttribute('placeholder') || '') + '\n';
      }
      if (node.tagName === 'BR') return '\n';
      const value = [...node.childNodes].map(walk).join('');
      return /^(inline|contents)/.test(style.display) ? value : '\n' + value + '\n';
    }
    return walk(root).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  });
}

export async function runCopyCapture(args) {
  const allowed = new Set(['url', 'fixture', 'project-root', 'out', 'allow-remote', 'allow-test-lead', 'browser-executable']);
  if (Object.keys(args).some(key => !allowed.has(key))) throw new Error('Unsupported copy-capture option.');
  if (!args['project-root'] || !args.fixture) throw new Error('Copy capture needs the project root and a reviewed fixture.');
  const root = realpathSync(path.resolve(args['project-root']));
  const target = checkedTarget(args.url, args['allow-remote'] === true);
  const fixturePath = inside(root, args.fixture), fixture = loadFixture(fixturePath);
  if (fixture.synthetic !== true) throw new Error('Use synthetic form values for public copy capture.');
  const allowWrites = args['allow-test-lead'] === true;
  if (allowWrites) testRunOptions({ 'allow-test-lead': true }, fixture);
  const out = inside(root, args.out || 'build/rendered-copy');
  if (!path.relative(root, out).startsWith('build' + path.sep)) throw new Error('Keep rendered copy captures under build/.');
  inside(root, path.join(out, 'capture.json'));
  const masterPath = inside(root, 'build/page-copy.json');
  const masterHash = hash(readFileSync(masterPath));
  const funnel = JSON.parse(readFileSync(inside(root, 'funnel.json'), 'utf8'));
  const report = makeReport('rendered_copy_capture', target, args);
  report.tool = { name: 'capture_rendered_copy', version: '1.0.0' };
  report.execution.command = ['node', 'scripts/capture-rendered-copy.mjs', '--url', target.url.href,
    '--project-root', '.', '--fixture', path.relative(root, fixturePath), '--out', path.relative(root, out),
    ...(args['allow-remote'] === true ? ['--allow-remote'] : []), ...(allowWrites ? ['--allow-test-lead'] : []),
    ...(args['browser-executable'] ? ['--browser-executable', args['browser-executable']] : [])];
  report.execution.cwd = 'project root';
  report.copy_sha256 = masterHash;
  report.documents = [];
  report.viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }];
  report.synthetic_submissions_attempted = 0;
  report.limits = [
    'Rendered DOM/PDF wording does not prove contrast, raster-image text or editorial truth; actual visual/editorial review remains required.',
    allowWrites ? 'Explicit synthetic submissions can trigger configured notifications and affect metrics.' : 'Mutating requests are blocked. A receipt-protected thank-you page needs an explicitly authorized public-flow capture.'
  ];
  mkdirSync(out, { recursive: true });
  const { chromium } = await import('playwright-core');
  let browser, phase = 'browser';
  try {
    browser = await chromium.launch({ headless: true, ...(args['browser-executable'] ? { executablePath: args['browser-executable'] } : {}) });
    for (const viewport of report.viewports) {
      const context = await browser.newContext({ viewport });
      try {
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url());
          const permittedWrite = allowWrites && url.origin === target.url.origin && ['/api/leads', '/api/visits'].includes(url.pathname) && request.method() === 'POST';
          return ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || permittedWrite ? route.continue() : route.abort('blockedbyclient');
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        const capture = async (surface, state, selector = 'body') => {
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          if (new URL(page.url()).origin !== target.url.origin) throw new Error('Capture navigated off the reviewed origin.');
          report.documents.push({ surface, state, width: viewport.width, path: new URL(page.url()).pathname, text: await renderedText(page, selector) });
          if ((surface === 'landing' && state === 'initial') || state === 'submission-error' || surface === 'thank_you') {
            const file = path.join(out, `${viewport.width}-${surface}-${state}.png`);
            await page.screenshot({ path: file, fullPage: surface !== 'modal' });
            report.artifacts.push({ path: path.relative(root, file).split(path.sep).join('/'), type: 'screenshot', sha256: hash(readFileSync(file)),
              viewport: page.viewportSize(), device_pixel_ratio: await page.evaluate(() => devicePixelRatio),
              state: surface === 'landing' ? 'page' : surface === 'thank_you' ? 'thank_you' : 'server_error',
              failure_transport: state === 'submission-error' ? 'blocked_by_client_read_only' : null });
          }
        };
        phase = 'landing';
        const landing = await page.goto(sameOriginUrl(fixture.path, target.url).href, { waitUntil: 'networkidle' });
        if (!landing?.ok() || new URL(page.url()).pathname !== fixture.path) throw new Error('The configured landing page did not load.');
        await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))]); });
        await capture('landing', 'initial');
        const disclosures = page.locator('details > summary');
        for (let i = 0; i < await disclosures.count(); i++) {
          const disclosure = disclosures.nth(i);
          if (!await disclosure.isVisible()) continue;
          if (!await disclosure.evaluate(el => el.parentElement.open)) await disclosure.click();
          await capture('landing', 'disclosure-' + i);
        }
        for (const [index, selector] of (fixture.copy_interactions || []).entries()) {
          if (typeof selector !== 'string' || !selector.trim()) throw new Error('Review exact CSS selectors for custom copy disclosures.');
          await page.locator(selector).first().click();
          if (new URL(page.url()).pathname !== fixture.path) throw new Error('A disclosure navigated away from the page.');
          await capture('landing', 'custom-disclosure-' + index);
        }
        phase = 'modal';
        await page.locator(fixture.selectors.openModal).first().click();
        await page.locator(fixture.selectors.modal).waitFor({ state: 'visible' });
        await fillSteps(page, fixture, { onStep: async (_, step) => capture('modal', 'step-' + step, fixture.selectors.modal) });
        await capture('modal', 'final', fixture.selectors.modal);
        if (!allowWrites) {
          phase = 'modal-failure';
          await page.locator(fixture.selectors.submit).first().click();
          await page.locator(fixture.selectors.error).first().waitFor({ state: 'visible' });
          if (new URL(page.url()).pathname !== fixture.path) throw new Error('A failed read-only submission left the reviewed form.');
          await capture('modal', 'submission-error', fixture.selectors.modal);
        }
        phase = 'thank-you';
        if (allowWrites) {
          const accepted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/leads' && response.request().method() === 'POST');
          report.synthetic_submissions_attempted++;
          await page.locator(fixture.selectors.submit).first().click();
          const response = await accepted;
          if (!response.ok()) throw new Error('The authorized synthetic submission was not accepted.');
          await page.waitForURL(url => url.pathname === fixture.thank_you_path || url.pathname === fixture.thank_you_path.replace(/\.html$/, ''));
        } else {
          await page.locator(fixture.selectors.closeModal).first().click();
          const response = await page.goto(sameOriginUrl(fixture.thank_you_path, target.url).href, { waitUntil: 'networkidle' });
          if (!response?.ok()) throw new Error('The thank-you page did not load.');
        }
        if (![fixture.thank_you_path, fixture.thank_you_path.replace(/\.html$/, '')].includes(new URL(page.url()).pathname)) throw new Error('The configured thank-you path redirected; use an authorized real-flow capture if it requires a receipt.');
        await capture('thank_you', 'confirmation');
        if (!allowWrites && await page.locator('[data-confirmed-only]').count()) {
          // Read-only runs cannot submit, so preview the confirmed state with an obviously
          // synthetic receipt held only in this browser context. No lead, POST or conversion occurs.
          await page.evaluate(() => sessionStorage.setItem('funnel_v2_receipt', JSON.stringify({ receipt_id: 'synthetic-read-only-preview', created_at: Date.now() })));
          await page.reload({ waitUntil: 'networkidle' });
          await capture('thank_you', 'confirmation-preview');
        }
        if (funnel.catalogue?.enabled !== false) {
          let linked = false;
          for (const link of await page.locator('a[href]').all()) {
            if (!await link.isVisible()) continue;
            const url = new URL(await link.getAttribute('href'), page.url());
            if (url.origin === target.url.origin && url.pathname === fixture.pdf_path && !url.search && !url.hash) linked = true;
          }
          if (!linked) throw new Error('The visible thank-you page does not link to the reviewed brochure.');
        }
        if (funnel.catalogue?.enabled !== false && !report.pdf) {
          phase = 'brochure';
          const response = await context.request.get(sameOriginUrl(fixture.pdf_path, target.url).href);
          if (!response.ok() || new URL(response.url()).origin !== target.url.origin) throw new Error('Brochure download failed or left the reviewed origin.');
          const served = await response.body();
          const local = inside(root, 'public/' + decodeURIComponent(new URL(fixture.pdf_path, target.url).pathname).replace(/^\/+/, ''));
          if (path.extname(local).toLowerCase() !== '.pdf') throw new Error('The brochure path must identify a PDF.');
          const bytes = readFileSync(local);
          if (bytes.subarray(0, 5).toString() !== '%PDF-' || hash(bytes) !== hash(served)) throw new Error('The served brochure differs from the checked local PDF.');
          const extracted = spawnSync('pdftotext', ['-raw', local, '-'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
          if (extracted.status !== 0) throw new Error('PDF text extraction failed; check Poppler and the inspected PDF.');
          const pages = extracted.stdout.split('\f'); if (pages.length && !pages.at(-1).trim()) pages.pop();
          report.pdf = { path: path.relative(root, local).split(path.sep).join('/'), sha256: hash(bytes), served_sha256: hash(served), page_count: pages.length, text: extracted.stdout };
        }
      } finally { await context.close(); }
    }
    check(report, 'The canonical copy stayed unchanged during capture', hash(readFileSync(masterPath)) === masterHash);
    check(report, 'Desktop/mobile landing, modal and thank-you text were captured', report.documents.length >= 6);
  } catch {
    check(report, 'Complete rendered-copy capture', false, 'Stage: ' + phase + '. Check the running page, fixture, disclosures and local PDF; no private details are included.');
  } finally { await browser?.close(); }
  return writeReport(finish(report), out, 'capture.json');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = await runCopyCapture(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: result.status, failures: result.failures, documents: result.documents.length, synthetic_submissions_attempted: result.synthetic_submissions_attempted })); process.exitCode = result.execution.exit_code; }
  catch { console.error('Rendered-copy capture blocked: check project, source snapshot, canonical copy, fixture and local tool setup.'); process.exitCode = 1; }
}
