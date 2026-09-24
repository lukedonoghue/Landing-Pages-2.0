/** Real mobile Lighthouse lab measurements. TBT is a lab proxy, never field INP. */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
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
export function browserLaunchFlags(args, target, env = process.env) {
  const flags = ['--headless', '--no-first-run', '--no-default-browser-check'];
  if (!args['isolated-ci-fixture']) return flags;
  if (args['isolated-ci-fixture'] !== true) throw new Error('Use --isolated-ci-fixture as a boolean flag.');
  if (env.CI !== 'true' || !target.local || !args['project-root']) throw new Error('The CI browser profile requires an isolated local fixture in CI.');
  const root = path.resolve(args['project-root']);
  const config = JSON.parse(readFileSync(path.join(root, 'funnel.json'), 'utf8'));
  const marker = JSON.parse(readFileSync(path.join(root, '.landing-pages-demo.json'), 'utf8'));
  if (config.development_fixture !== true || marker.kind !== 'synthetic-local-demo') throw new Error('The CI browser profile is restricted to the generated synthetic demo.');
  // Hosted Linux CI may disallow Chromium's user-namespace sandbox. Match the
  // existing Playwright fixture runner only for this isolated local test. Normal
  // client/remote audits retain the launcher's default sandbox configuration.
  return [...flags, '--no-sandbox', '--disable-dev-shm-usage'];
}
const median = values => { const sorted = [...values].sort((a, b) => a - b), center = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2; };
export async function runPerformance(args, runtime) {
  const target = checkedTarget(args.url, args['allow-remote'] === true);
  const report = makeReport('performance', target, args);
  let configured = {};
  if(args['project-root']){
    const config=JSON.parse(readFileSync(path.join(path.resolve(args['project-root']),'funnel.json'),'utf8'));
    const values=config.quality?.performance||{};
    for(const [field,flag] of Object.entries({minimum_score:'performance-min',lcp_ms:'lcp-max',cls:'cls-max',tbt_ms:'tbt-max'}))if(values[field]!=null)configured[flag]=values[field];
  }
  const budgets = readBudgets({...configured,...args});
  const runs = args.runs == null ? 3 : Number(args.runs);
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > 5) throw new Error('Choose one to five Lighthouse runs.');
  const out = path.resolve(args.out || 'build/performance'); mkdirSync(out, { recursive: true });
  report.server={command:args['server-command']||null,scope:'Caller-recorded command of the actual audit server; not proof of a provider deployment'};
  report.budgets = budgets; report.runs = []; report.form_factor = 'mobile'; report.throttling_method = 'simulate';
  report.limits = ['Lab measurements are repeatable diagnostics, not real-user field performance.', 'Total Blocking Time (TBT) is a lab responsiveness proxy; this audit does not measure field INP.', 'Public API routes are blocked so speed checks never create contacts or visitor records.', 'Optimize assets, loading, and implementation without silently changing approved copy or design.'];
  let lighthouse, launch;
  try {
    lighthouse = runtime?.lighthouse || (await import('lighthouse')).default;
    launch = runtime?.launch || (await import('chrome-launcher')).launch;
  } catch { check(report, 'Lighthouse dependencies are installed', false, 'Install the locked project dependencies with npm ci.'); return writeReport(finish(report), out); }
  let chrome, phase = 'browser_launch';
  try {
    let chromePath = args['browser-executable'];
    if (!chromePath && !runtime) { try { const candidate = (await import('playwright-core')).chromium.executablePath(); if (existsSync(candidate)) chromePath = candidate; } catch {} }
    const chromeFlags = browserLaunchFlags(args, target, runtime?.env || process.env);
    report.execution.isolated_ci_browser = args['isolated-ci-fixture'] === true;
    chrome = await launch({ ...(chromePath ? { chromePath } : {}), chromeFlags });
    for (let index = 1; index <= runs; index++) {
      phase = 'lighthouse_run';
      const result = await lighthouse(target.url.href, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], formFactor: 'mobile', throttlingMethod: 'simulate',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
        throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675 },
        blockedUrlPatterns: ['*/api/leads*', '*/api/visits*', '*/api/admin/*'], disableStorageReset: false });
      const rawFile = path.join(out, `lighthouse-mobile-${index}.json`);
      writeFileSync(rawFile, JSON.stringify(result.lhr, null, 2) + '\n');
      report.artifacts.push(artifact(rawFile, 'lighthouse_json', args['project-root']));
      report.tool = { name: 'Lighthouse', version: result.lhr.lighthouseVersion || 'unknown' };
      phase = 'read_measurements';
      report.runs.push({ run: index, ...extractMetrics(result.lhr) });
    }
    report.metrics = Object.fromEntries(Object.keys(budgets).map(key => [key, median(report.runs.map(row => row[key]))]));
    report.aggregation = runs === 1 ? 'single run' : 'median of runs';
    for (const item of budgetChecks(report.metrics, budgets)) {
      check(report, `${item.name} meets mobile budget`, item.passed); Object.assign(report.checks.at(-1), { actual: item.actual, budget: item.budget });
    }
    if (report.runs.some(row => budgetChecks(row, budgets).some(item => !item.passed)) && !report.failures.length) report.warnings.push('Median meets the budgets, but at least one run exceeded a budget; inspect variability in the raw reports.');
    if (runs === 1) report.warnings.push('Single run requested; repeat a three-run audit before treating a marginal score as stable.');
  } catch (error) {
    report.failure_phase = phase;
    report.error_code = /^[A-Z0-9_]{1,40}$/.test(error?.code || '') ? error.code : 'UNSPECIFIED';
    check(report, 'Lighthouse completed with numeric measurements', false, `Stage: ${phase}. Check Chromium availability, the running page, and any saved raw reports.`);
  }
  finally { await chrome?.kill(); }
  return writeReport(finish(report), out);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await runPerformance(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({ status: report.status, metrics: report.metrics, failures: report.failures, output: 'performance evidence saved' })); process.exitCode = report.execution.exit_code; }
  catch { console.error('Performance audit blocked: check target, budgets, snapshot, and options.'); process.exitCode = 1; }
}
