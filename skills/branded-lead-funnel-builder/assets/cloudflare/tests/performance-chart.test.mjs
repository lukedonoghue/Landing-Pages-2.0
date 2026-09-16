import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const chrome = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(path => path && existsSync(path));
let server, browser, origin;
before(async () => {
  if (!chrome) return;
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://fixture').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/performance-chart.css"><style>body{font:16px system-ui;margin:20px}#chart{padding:5px 10px}</style></head><body><main><div id="chart"></div></main><script type="module">import { renderPerformanceChart } from "/performance-chart.js"; window.render = (days, options) => renderPerformanceChart(document.querySelector("#chart"), days, options);</script></body></html>');
      return;
    }
    if (!['/performance-chart.js', '/performance-chart.css'].includes(pathname)) { response.statusCode = 404; response.end(); return; }
    response.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
    response.end(await readFile(new URL(`../public/admin${pathname}`, import.meta.url)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: chrome, headless: true });
});
after(async () => { await browser?.close(); server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); });
const options = { skip: !chrome ? 'Set CHROME_BIN for performance-chart browser checks.' : false };
const days = [
  { date: '2026-09-09', visitors: 11, conversions: 1 },
  { date: '2026-09-10', visitors: 8, conversions: 2 },
  { date: '2026-09-11', visitors: 0, conversions: 0 },
  { date: '2026-09-12', visitors: 6, conversions: 3 },
  { date: '2026-09-13', visitors: 8, conversions: 0 },
  { date: '2026-09-14', visitors: 8, conversions: 1 },
  { date: '2026-09-15', visitors: 17, conversions: 2 }
];
async function openPage(width = 1024, isMobile = false) {
  const page = await browser.newPage({ viewport: { width, height: 768 }, hasTouch: isMobile, isMobile });
  await page.goto(origin); await page.waitForFunction(() => typeof window.render === 'function');
  return page;
}

test('performance graph draws count lines/areas and keyboard shows exact values without bounces', options, async () => {
  const page = await openPage();
  try {
    await page.evaluate(days => window.render(days), days);
    assert.equal(await page.locator('.performance-line').count(), 2);
    assert.equal(await page.locator('.performance-area').count(), 2);
    assert.equal(await page.locator('rect').count(), 0);
    await page.locator('svg').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.performance-tooltip').getAttribute('data-date'), '2026-09-10');
    const rows = await page.locator('.performance-tooltip-row').allTextContents();
    assert.deepEqual(rows, ['Visitors8', 'Conversions2', 'Conversion rate25.0%']);
    assert.doesNotMatch(await page.locator('#chart').textContent(), /bounces/i);
    assert.match(await page.locator('[role=status]').textContent(), /Visitors: 8.*Conversions: 2.*25.0%/);
    await page.keyboard.press('End'); assert.equal(await page.locator('.performance-tooltip').getAttribute('data-date'), '2026-09-15');
    await page.keyboard.press('Home'); assert.equal(await page.locator('.performance-tooltip').getAttribute('data-date'), '2026-09-09');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.performance-tooltip').isHidden(), true);
  } finally { await page.close(); }
});

test('rate graph uses percent axes and leaves unmeasured days undefined', options, async () => {
  const page = await openPage();
  try {
    await page.evaluate(days => window.render(days, { mode: 'rate', visitorLabel: 'Unique visitors' }), days);
    assert.equal(await page.locator('.performance-line.performance-conversions').count(), 0);
    assert.match(await page.locator('.performance-axis').textContent(), /%/);
    await page.locator('svg').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.performance-tooltip').getAttribute('data-date'), '2026-09-11');
    assert.deepEqual(await page.locator('.performance-tooltip-row').allTextContents(), ['Unique visitors0', 'Conversions0', 'Conversion rate—']);
    assert.equal(await page.locator('.performance-hover-point.performance-visitors').getAttribute('visibility'), 'hidden');
    assert.match(await page.locator('[role=status]').textContent(), /not available, no measured visitors/);
    assert.doesNotMatch(await page.locator('svg').evaluate(node => node.outerHTML), /NaN|Infinity/);
  } finally { await page.close(); }
});

test('single, empty and multi-year ranges remain legible with exact-day inspection', options, async () => {
  const page = await openPage(390);
  try {
    await page.evaluate(day => window.render([day]), days[0]);
    assert.equal(await page.locator('.performance-date-label').count(), 1);
    assert.equal(await page.locator('.performance-single-point').count(), 2);
    const points = await page.locator('.performance-single-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('cx'))));
    assert.equal(points[0], points[1]); assert.ok(points[0] > 40);
    await page.evaluate(() => window.render([]));
    assert.match(await page.locator('#chart').textContent(), /first measured visit/);
    assert.equal(await page.locator('svg').count(), 0);
    await page.evaluate(() => window.render(Array.from({ length: 4000 }, (_, index) => ({ date: new Date(Date.UTC(2016, 0, 1 + index)).toISOString().slice(0, 10), visitors: index, conversions: index % 20 }))));
    assert.ok(await page.locator('svg *').count() < 50);
    await page.locator('svg').focus(); await page.keyboard.press('End');
    assert.deepEqual((await page.locator('.performance-tooltip-row').allTextContents()).slice(0, 2), ['Visitors3,999', 'Conversions19']);
    const labels = await page.locator('.performance-date-label').evaluateAll(nodes => nodes.map(node => { const bounds = node.getBoundingClientRect(); return { left: bounds.left, right: bounds.right }; }));
    for (let i = 1; i < labels.length; i++) assert.ok(labels[i].left > labels[i - 1].right, 'Date labels must not overlap.');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally { await page.close(); }
});

test('mouse and touch inspect dates with tooltip bounded inside narrow charts', options, async () => {
  for (const width of [1024, 320]) {
    const page = await openPage(width, width === 320);
    try {
      await page.evaluate(days => window.render(days), days);
      const bounds = await page.locator('svg').boundingBox();
      if (width === 320) await page.touchscreen.tap(bounds.x + bounds.width - 12, bounds.y + 60);
      else await page.mouse.move(bounds.x + bounds.width - 12, bounds.y + 60);
      assert.equal(await page.locator('.performance-tooltip').getAttribute('data-date'), '2026-09-15');
      const tooltip = await page.locator('.performance-tooltip').boundingBox();
      assert.ok(tooltip.x >= bounds.x && tooltip.x + tooltip.width <= bounds.x + bounds.width);
      assert.ok(tooltip.y >= bounds.y && tooltip.y + tooltip.height <= bounds.y + bounds.height);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await page.close(); }
  }
});

test('invalid numeric data cannot generate broken coordinates or executable markup', options, async () => {
  const page = await openPage();
  try {
    await page.evaluate(() => window.render([{ date: '<img src=x onerror=alert(1)>', visitors: 'not-a-number', conversions: -1 }], { visitorLabel: '<script>bad()</script>' }));
    await page.locator('svg').focus();
    assert.equal(await page.locator('#chart img, #chart script').count(), 0);
    assert.deepEqual((await page.locator('.performance-tooltip-row').allTextContents()).slice(1), ['Conversions0', 'Conversion rate—']);
    assert.doesNotMatch(await page.locator('svg').evaluate(node => node.outerHTML), /NaN|Infinity/);
  } finally { await page.close(); }
});
