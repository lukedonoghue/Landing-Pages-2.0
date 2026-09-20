import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const chrome = '/Users/mac/.cache/puppeteer/chrome/mac_arm-138.0.7204.168/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const report = { tool: 'axe-core', states: [] };
for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:50525/');
  await page.addScriptTag({ path: new URL('../qa-tools/node_modules/axe-core/axe.min.js', import.meta.url).pathname });
  for (const state of ['page', 'modal', 'validation']) {
    if (state === 'modal') await page.locator('[data-open-modal]').nth(1).click();
    if (state === 'validation') await page.locator('#submit-enquiry').click();
    const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
    report.states.push({ viewport, state, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.help, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
  }
  await page.close();
}
await browser.close();
report.status = report.states.some(s => s.violations.length) ? 'blocked' : 'pass';
await writeFile(new URL('../project/build/accessibility-review.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, states: report.states.length, violations: report.states.reduce((n, s) => n + s.violations.length, 0) }));
if (report.status !== 'pass') process.exitCode = 1;
