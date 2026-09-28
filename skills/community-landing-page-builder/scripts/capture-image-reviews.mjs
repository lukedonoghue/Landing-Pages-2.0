#!/usr/bin/env node
/**
 * Capture every planned image in its actual rendered placement for per-image review.
 *
 * For each image-plan asset with optimized variants, at a desktop and a mobile
 * viewport, this finds the <img> actually serving one of its variants and records
 * the selector, bounding box, served path and the hash of the served bytes, plus an
 * element capture and a placement screenshot. It writes a review skeleton per asset
 * under build/image-reviews/; the reviewer inspects the captures and sets every
 * judgment. It never marks a judgment as passed itself.
 *
 * Usage: node scripts/capture-image-reviews.mjs --url http://127.0.0.1:8787/ [--project-root .]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const url = option('url');
if (!url) { console.error('Usage: node scripts/capture-image-reviews.mjs --url http://127.0.0.1:8787/ [--project-root .]'); process.exit(2); }
const root = path.resolve(option('project-root', '.'));
const require = createRequire(path.join(root, 'package.json'));
let runtime;
try { runtime = await import(pathToFileURL(require.resolve('playwright-core')).href); }
catch { console.error('Browser dependencies are not installed. From the project folder run: python3 scripts/quickstart.py bootstrap --project .'); process.exit(2); }
const chromium = runtime.chromium || runtime.default?.chromium;
const plan = JSON.parse(readFileSync(path.join(root, option('plan', 'image-plan.json')), 'utf8'));
const out = path.join(root, option('out', 'build/image-reviews'));
mkdirSync(out, { recursive: true });
const rel = file => path.relative(root, file).split(path.sep).join('/');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const served = asset => new Map((asset.variants || []).map(v => ['/' + v.path.split('public/').pop(), v]));
const devices = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const executable = option('browser-executable', process.env.FUNNEL_CHROMIUM || '');
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
const reports = {}, missing = [];
try {
  for (const [device, viewport] of Object.entries(devices)) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle' });
    for (const asset of plan.assets || []) {
      const variants = served(asset);
      if (!variants.size) continue;
      const handle = await page.evaluateHandle(paths => [...document.querySelectorAll('img')].find(img => {
        img.loading = 'eager';
        return paths.includes(new URL(img.currentSrc || img.src, location.href).pathname);
      }) || null, [...variants.keys()]);
      const element = handle.asElement();
      if (!element) { missing.push(`${asset.id} (${device})`); continue; }
      await element.scrollIntoViewIfNeeded();
      await element.evaluate(img => img.complete ? null : new Promise(done => img.addEventListener('load', done, { once: true })));
      await page.waitForTimeout(250);
      const found = await element.evaluate(img => {
        const pathTo = node => {
          if (node.id) return '#' + CSS.escape(node.id);
          if (node.dataset?.imageId) return `img[data-image-id="${node.dataset.imageId}"]`;
          const parts = [];
          for (let current = node; current && current.nodeType === 1 && current !== document.body; current = current.parentElement) {
            const siblings = [...(current.parentElement?.children || [])].filter(child => child.tagName === current.tagName);
            parts.unshift(current.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ''));
          }
          return 'body > ' + parts.join(' > ');
        };
        const box = img.getBoundingClientRect();
        return { selector: pathTo(img), bbox: { x: box.x, y: box.y, width: box.width, height: box.height },
                 current_src: new URL(img.currentSrc || img.src, location.href).pathname };
      });
      const variant = variants.get(found.current_src);
      const response = await page.request.get(new URL(found.current_src, url).href);
      const crop = path.join(out, `${asset.id}-${device}-element.png`);
      const placement = path.join(out, `${asset.id}-${device}-placement.png`);
      await element.screenshot({ path: crop });
      await page.screenshot({ path: placement });
      reports[asset.id] ||= { reviewer: '', source_sha256: asset.source?.sha256 || null,
        variant_sha256: Object.fromEntries((asset.variants || []).map(v => [v.path, v.sha256])),
        instructions: 'Inspect each element capture and placement screenshot. Set every judgment to true only if it holds; otherwise fix the page and recapture. Record the reviewer.' };
      reports[asset.id][device] = { screenshot: rel(placement), viewport, device_pixel_ratio: 1, served_variant: variant.path,
        element: { ...found, resource_sha256: sha256(await response.body()) }, element_screenshot: rel(crop),
        subject_visible: null, crop_appropriate: null, alt_appropriate: null, no_false_claim: null, page_layout_checked: null };
    }
    await page.close();
  }
} finally { await browser.close(); }
for (const [id, report] of Object.entries(reports)) writeFileSync(path.join(out, id + '.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: missing.length ? 'blocked' : 'pass', reports: Object.keys(reports).map(id => rel(path.join(out, id + '.json'))),
  missing_on_page: missing, next: 'Fill in each report, then run image_workflow.py review --id ID --report build/image-reviews/ID.json' }, null, 2));
process.exit(missing.length ? 1 : 0);
