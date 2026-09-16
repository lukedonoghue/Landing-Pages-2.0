/** Real mobile Lighthouse lab measurements. TBT is a lab proxy, never field INP. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, checkedTarget, makeReport, artifact, check, finish, writeReport } from './browser-compat.mjs';

export const DEFAULT_BUDGETS = Object.freeze({ performance: 90, lcp_ms: 2500, cls: 0.1, tbt_ms: 200 });
export function readBudgets(args) {
  const mapping = { performance: 'performance-min', lcp_ms: 'lcp-max', cls: 'cls-max', tbt_ms: 'tbt-max' };
  return Object.fromEntries(Object.entries(mapping).map(([key, option]) => {
    const value = args[option] == null ? DEFAULT_BUDGETS[key] : Number(args[option]);
    if (!Number.isFinite(value) || value < 0 || (key === 'performance' && value > 100)) throw new Error('Performance budgets must be valid nonnegative numbers.');
    return [key, value];
  }));
}
export function extractMetrics(lhr) {
  const metrics = { performance: typeof lhr?.categories?.performance?.score === 'number' ? lhr.categories.performance.score * 100 : NaN,
    lcp_ms: lhr?.audits?.['largest-contentful-paint']?.numericValue,
    cls: lhr?.audits?.['cumulative-layout-shift']?.numericValue,
    tbt_ms: lhr?.audits?.['total-blocking-time']?.numericValue };
  if (lhr?.runtimeError || Object.values(metrics).some(value => !Number.isFinite(value))) throw new Error('Lighthouse did not produce complete performance measurements.');
  return metrics;
}
export function budgetChecks(metrics, budgets) {
  return Object.keys(budgets).map(key => ({ name: key, actual: metrics[key], budget: budgets[key], passed: key === 'performance' ? metrics[key] >= budgets[key] : metrics[key] <= budgets[key] }));
}
const median = values => { const sorted = [...values].sort((a, b) => a - b), center = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2; };
export async function runPerformance(args, runtime) {
  const target = checkedTarget(args.url, args['allow-remote'] === true);
  const report = makeReport('performance', target, args);
  const budgets = readBudgets(args);
  const runs = args.runs == null ? 3 : Number(args.runs);
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > 5) throw new Error('Choose one to five Lighthouse runs.');
  const out = path.resolve(args.out || 'build/performance'); mkdirSync(out, { recursive: true });
  report.budgets = budgets; report.runs = []; report.form_factor = 'mobile'; report.throttling_method = 'simulate';
  report.limits = ['Lab measurements are repeatable diagnostics, not real-user field performance.', 'Total Blocking Time (TBT) is a lab responsiveness proxy; this audit does not measure field INP.', 'Public API routes are blocked so speed checks never create contacts or visitor records.', 'Optimize assets, loading, and implementation without silently changing approved copy or design.'];
  let lighthouse, launch;
  try {
    lighthouse = runtime?.lighthouse || (await import('lighthouse')).default;
    launch = runtime?.launch || (await import('chrome-launcher')).launch;
  } catch { check(report, 'Lighthouse dependencies are installed', false, 'Install the locked project dependencies with npm ci.'); return writeReport(finish(report), out); }
  let chrome;
  try {
    let chromePath = args['browser-executable'];
    if (!chromePath && !runtime) { try { const candidate = (await import('playwright-core')).chromium.executablePath(); if (existsSync(candidate)) chromePath = candidate; } catch {} }
    chrome = await launch({ ...(chromePath ? { chromePath } : {}), chromeFlags: ['--headless', '--no-first-run', '--no-default-browser-check'] });
    for (let index = 1; index <= runs; index++) {
      const result = await lighthouse(target.url.href, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], formFactor: 'mobile', throttlingMethod: 'simulate',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
        throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675 },
        blockedUrlPatterns: ['*/api/*'], disableStorageReset: false });
      const rawFile = path.join(out, `lighthouse-mobile-${index}.json`);
      writeFileSync(rawFile, JSON.stringify(result.lhr, null, 2) + '\n');
      report.artifacts.push(artifact(rawFile, 'lighthouse_json', args['project-root']));
      report.tool = { name: 'Lighthouse', version: result.lhr.lighthouseVersion || 'unknown' };
      report.runs.push({ run: index, ...extractMetrics(result.lhr) });
    }
    report.metrics = Object.fromEntries(Object.keys(budgets).map(key => [key, median(report.runs.map(row => row[key]))]));
    report.aggregation = runs === 1 ? 'single run' : 'median of runs';
    for (const item of budgetChecks(report.metrics, budgets)) {
      check(report, `${item.name} meets mobile budget`, item.passed); Object.assign(report.checks.at(-1), { actual: item.actual, budget: item.budget });
    }
    if (report.runs.some(row => budgetChecks(row, budgets).some(item => !item.passed)) && !report.failures.length) report.warnings.push('Median meets the budgets, but at least one run exceeded a budget; inspect variability in the raw reports.');
    if (runs === 1) report.warnings.push('Single run requested; repeat a three-run audit before treating a marginal score as stable.');
  } catch { check(report, 'Lighthouse completed with numeric measurements', false, 'Check Chromium availability, the running page, and any saved raw reports.'); }
  finally { await chrome?.kill(); }
  return writeReport(finish(report), out);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await runPerformance(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: report.status, metrics: report.metrics, failures: report.failures, output: 'performance evidence saved' })); process.exitCode = report.execution.exit_code; }
  catch { console.error('Performance audit blocked: check target, budgets, snapshot, and options.'); process.exitCode = 1; }
}
