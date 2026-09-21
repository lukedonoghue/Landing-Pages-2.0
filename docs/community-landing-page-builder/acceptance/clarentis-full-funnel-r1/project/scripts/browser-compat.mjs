/** Cross-engine interaction checks. No form, analytics, or admin writes are sent. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const VERSION = '2.2.0';
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error('Expected a named option.');
    const key = argv[i].slice(2);
    args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return args;
}
export function checkedTarget(raw, allowRemote = false) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) URL without credentials, query parameters, or fragments.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local && (!allowRemote || url.protocol !== 'https:')) throw new Error('Remote verification needs an HTTPS URL and explicit --allow-remote.');
  return { url, local };
}
export function sameOriginUrl(value, base) {
  const url = new URL(value, base);
  if (url.origin !== base.origin || url.username || url.password || url.hash) throw new Error('Fixture resources must stay on the verified origin.');
  return url;
}
export function loadFixture(file) {
  const data = typeof file === 'string' ? JSON.parse(readFileSync(file, 'utf8')) : file;
  if (!data || !data.fields || !Object.keys(data.fields).length || !data.selectors) throw new Error('Supply a reviewed site-specific fixture with fields and selectors.');
  for (const key of ['openModal', 'modal', 'step', 'next', 'submit', 'closeModal', 'error']) {
    if (typeof data.selectors[key] !== 'string' || !data.selectors[key]) throw new Error(`Fixture selector missing: ${key}`);
  }
  for (const key of ['path', 'thank_you_path']) {
    if (typeof data[key] !== 'string' || !data[key].startsWith('/') || data[key].startsWith('//') || data[key].includes('?') || data[key].includes('#')) throw new Error(`Fixture requires an origin-relative ${key} without a query or fragment.`);
  }
  if (data.pdf_path !== undefined && (typeof data.pdf_path !== 'string' || !data.pdf_path.startsWith('/') || data.pdf_path.startsWith('//') || data.pdf_path.includes('?') || data.pdf_path.includes('#'))) throw new Error('When supplied, pdf_path must be origin-relative without a query or fragment.');
  return data;
}
export function makeReport(gate, target, args = {}) {
  let snapshot;
  if (args['project-root']) {
    const root = path.resolve(args['project-root']);
    const file = path.resolve(root, args.snapshot || 'build/gate-snapshot.json');
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('build' + path.sep)) throw new Error('Snapshot must be inside project build/.');
    if (!existsSync(file)) throw new Error('Create a current gate snapshot before using --project-root.');
    snapshot = JSON.parse(readFileSync(file, 'utf8'));
  }
  return { schema_version: 1, gate, status: 'blocked', executed_at: new Date().toISOString(),
    source_fingerprint: snapshot?.source_fingerprint || null,
    target: { mode: snapshot?.mode || (target.local ? 'handoff' : 'live'), url: target.url.href },
    tool: { name: gate, version: VERSION }, execution: { kind: 'automated', command: `node scripts/${gate === 'performance' ? 'performance-audit' : gate === 'browser_compat' ? 'browser-compat' : 'live-verify'}.mjs`, exit_code: 1 },
    checks: [], artifacts: [], failures: [], warnings: [] };
}
export function artifact(file, type, projectRoot = process.cwd()) {
  return { path: path.relative(path.resolve(projectRoot), path.resolve(file)).split(path.sep).join('/'), type, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
}
export function writeReport(report, out, name = 'result.json') {
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, name), JSON.stringify(report, null, 2) + '\n');
  return report;
}
export function check(report, name, passed, detail) {
  report.checks.push({ name, status: passed ? 'pass' : 'blocked', ...(detail ? { detail } : {}) });
  if (!passed) report.failures.push(name);
  return passed;
}
export function finish(report) {
  report.status = report.failures.length ? 'blocked' : report.warnings.length ? 'pass_with_warnings' : 'pass';
  report.execution.exit_code = report.failures.length ? 1 : 0;
  return report;
}
export async function fillSteps(page, fixture, { inspectField, onStep } = {}) {
  const used = new Set();
  for (let step = 0; step < 24; step++) {
    const current = page.locator(fixture.selectors.step).filter({ visible: true }).first();
    await current.waitFor({ state: 'visible' });
    if (onStep) await onStep(current, step);
    for (const field of await current.locator('input[name],select[name],textarea[name]').all()) {
      const name = await field.getAttribute('name');
      if (!(name in fixture.fields) || !await field.isVisible()) continue;
      const type = await field.getAttribute('type');
      if (type === 'radio') { if (await field.getAttribute('value') !== String(fixture.fields[name])) continue; await field.check(); }
      else if (type === 'checkbox') await field.setChecked(Boolean(fixture.fields[name]));
      else if (await field.evaluate(el => el.tagName) === 'SELECT') await field.selectOption(String(fixture.fields[name]));
      else await field.fill(String(fixture.fields[name]));
      used.add(name);
      if (inspectField) {
        try { await inspectField(field); }
        catch (error) { throw new Error(`Field inspection failed for ${name}: ${error instanceof Error ? error.message : 'unknown error'}`); }
      }
    }
    const next = page.locator(fixture.selectors.next).first();
    if (!await next.isVisible()) {
      const missing = Object.keys(fixture.fields).filter(key => !used.has(key));
      if (missing.length) throw new Error('The fixture contains fields that were not found in the form.');
      await page.locator(fixture.selectors.submit).first().waitFor({ state: 'visible' });
      return;
    }
    await next.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
  throw new Error('The form did not advance through the reviewed fixture.');
}
export async function waitForPageImages(page, timeout = 5000) {
  try {
    await page.waitForFunction(() => [...document.images].filter(img => {
      const box = img.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(img).visibility !== 'hidden';
    }).every(img => img.complete), null, { timeout });
  } catch { return false; }
  return page.evaluate(() => [...document.images].filter(img => {
    const box = img.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(img).visibility !== 'hidden';
  }).every(img => img.complete && img.naturalWidth > 0));
}
export async function runBrowserCompat(args, suppliedRuntime) {
  const target = checkedTarget(args.url, args['allow-remote'] === true);
  const fixture = loadFixture(args.fixture);
  const report = makeReport('browser_compat', target, args);
  const out = path.resolve(args.out || 'build/browser-compat');
  mkdirSync(out, { recursive: true });
  const views = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }];
  report.viewports = views;
  report.engines = [];
  report.limits = ['WebKit automation is Safari-engine coverage, not a physical iPhone test.', 'The short viewport models available keyboard space; it does not emulate an iOS software keyboard.', 'Mutating network requests are blocked. Use live-verify for actual submission and receipt persistence.', 'Screenshots require an independent visual review; these measurements do not judge design quality.'];
  let runtime;
  try { runtime = suppliedRuntime || await import('playwright-core'); }
  catch { check(report, 'Playwright runtime is installed', false); return writeReport(finish(report), out); }
  for (const engine of ['chromium', 'webkit']) {
    let browser;
    try { browser = await runtime[engine].launch({ headless: true, ...(engine === 'chromium' && args['browser-executable'] ? { executablePath: args['browser-executable'] } : {}) }); }
    catch { check(report, `${engine} browser is installed and launches`, false, 'Run npx playwright-core install chromium webkit on a supported OS.'); report.engines.push({ name: engine, status: 'blocked' }); continue; }
    let engineFailed = false;
    try {
      for (const viewport of views) {
        const label = `${engine} ${viewport.width}x${viewport.height}`;
        const context = await browser.newContext({ viewport, ...(viewport.width < 600 ? { hasTouch: true, isMobile: true } : {}) });
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        const errors = []; page.on('pageerror', () => errors.push('JavaScript exception'));
        await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
        const before = report.failures.length;
        try {
          const response = await page.goto(sameOriginUrl(fixture.path, target.url).href, { waitUntil: 'networkidle' });
          check(report, `${label}: public page loads`, response?.ok() === true);
          await page.evaluate(async () => {
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            document.documentElement.style.scrollBehavior = 'auto';
            await Promise.race([document.fonts.ready, delay(3000)]);
            // WebKit may leave decode() pending for an off-screen lazy image.
            // Exercise normal scrolling first, then bound the decode wait. The
            // following loaded-image check still rejects any unresolved asset.
            for (let y = 0, end = Math.min(document.documentElement.scrollHeight, 35000); y < end; y += Math.max(200, innerHeight * 0.7)) {
              scrollTo(0, y);
              await delay(50);
            }
            await Promise.race([Promise.all([...document.images].map(img => img.decode().catch(() => {}))), delay(5000)]);
            scrollTo(0, 0);
          });
          check(report, `${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          // decode() can reject before a lazy request completes in WebKit.
          // Wait for the real resource state and still reject broken visible images.
          check(report, `${label}: images load`, await waitForPageImages(page));
          await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(100);
          const pageFile = path.join(out, `${engine}-${viewport.width}-page.png`);
          await page.screenshot({ path: pageFile, fullPage: true }); report.artifacts.push(artifact(pageFile, 'screenshot', args['project-root']));
          await page.waitForFunction(()=>window.LeadFunnel?.privacyState().configured&&document.querySelector('[data-privacy-choices]'));
          const privacyTrigger=page.locator('[data-privacy-choices]').first();await privacyTrigger.click();
          const privacyDialog=page.locator('[data-funnel-privacy-dialog]');await privacyDialog.waitFor({state:'visible'});
          check(report,`${label}: privacy choices reopen and receive focus`,await privacyDialog.evaluate(el=>el.contains(document.activeElement)));
          let privacyFocus=true;
          for(const key of ['Tab','Shift+Tab'])for(let i=0;i<6;i++){await page.keyboard.press(key);privacyFocus &&= await privacyDialog.evaluate(el=>el.contains(document.activeElement));}
          check(report,`${label}: privacy choices keep keyboard focus`,privacyFocus);
          check(report,`${label}: privacy choices fit viewport`,await privacyDialog.evaluate(el=>{const box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&box.top>=0&&box.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+1;}));
          const privacyFile=path.join(out,`${engine}-${viewport.width}-privacy.png`);await page.screenshot({path:privacyFile});report.artifacts.push(artifact(privacyFile,'screenshot',args['project-root']));
          await page.keyboard.press('Escape');
          check(report,`${label}: privacy Escape returns focus`,!await privacyDialog.isVisible()&&await privacyTrigger.evaluate(el=>el===document.activeElement));
          const trigger = page.locator(fixture.selectors.openModal).first(); await trigger.scrollIntoViewIfNeeded(); await trigger.focus(); await page.keyboard.press('Enter');
          const modal = page.locator(fixture.selectors.modal); await modal.waitFor({ state: 'visible' });
          check(report, `${label}: dialog receives keyboard focus`, await modal.evaluate(el => el.contains(document.activeElement)));
          check(report, `${label}: body scrolling locked`, await page.evaluate(() => ['hidden', 'clip'].includes(getComputedStyle(document.body).overflowY) || getComputedStyle(document.body).position === 'fixed' || ['hidden', 'clip'].includes(getComputedStyle(document.documentElement).overflowY)));
          const focusables = await modal.locator('button,input,select,textarea,a[href]').count();
          let focusContained = true;
          for (let i = 0; i < Math.min(focusables + 2, 60); i++) { await page.keyboard.press('Tab'); if (!await modal.evaluate(el => el.contains(document.activeElement))) { focusContained = false; break; } }
          await page.keyboard.press('Shift+Tab');
          check(report, `${label}: focus stays in dialog`, focusContained && await modal.evaluate(el => el.contains(document.activeElement)));
          await page.keyboard.press('Escape');
          check(report, `${label}: Escape closes and returns focus`, !await modal.isVisible() && await trigger.evaluate(el => document.activeElement === el));
          check(report, `${label}: scrolling restored`, await page.evaluate(() => !['hidden', 'clip'].includes(document.body.style.overflow)));
          await trigger.press('Enter');
          if (viewport.width < 600) await page.setViewportSize({ width: viewport.width, height: 420 });
          let fieldsFit = true, readable = true;
          await fillSteps(page, fixture, { inspectField: async field => {
            await field.focus(); await field.scrollIntoViewIfNeeded();
            const dimensions = await field.evaluate(el => { const r = el.getBoundingClientRect(); return { fit: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, font: parseFloat(getComputedStyle(el).fontSize), type: el.type }; });
            fieldsFit &&= dimensions.fit;
            if (viewport.width < 600 && !['checkbox', 'radio'].includes(dimensions.type)) readable &&= dimensions.font >= 16;
          } });
          check(report, `${label}: form fields remain reachable`, fieldsFit);
          check(report, `${label}: mobile inputs avoid zoom-sized text`, readable);
          const submit = page.locator(fixture.selectors.submit); await submit.scrollIntoViewIfNeeded();
          check(report, `${label}: final action reachable`, await submit.isVisible() && await submit.isEnabled());
          const modalFile = path.join(out, `${engine}-${viewport.width}-modal.png`);
          await page.screenshot({ path: modalFile }); report.artifacts.push(artifact(modalFile, 'screenshot', args['project-root']));
          check(report, `${label}: no runtime exceptions`, errors.length === 0);
        } catch (error) {
          const reason = error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/g, '[local target]').slice(0, 520) : 'Unknown browser interaction failure.';
          check(report, `${label}: complete interaction journey`, false, `No submission was sent. ${reason}`);
        }
        finally { await context.close(); }
        if (report.failures.length > before) engineFailed = true;
      }
    } finally { await browser.close(); }
    report.engines.push({ name: engine, status: engineFailed ? 'blocked' : 'pass' });
  }
  return writeReport(finish(report), out);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await runBrowserCompat(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: report.status, failures: report.failures, output: 'browser compatibility evidence saved' })); process.exitCode = report.execution.exit_code; }
  catch { console.error('Browser verification blocked: check target, fixture, snapshot, and options.'); process.exitCode = 1; }
}
