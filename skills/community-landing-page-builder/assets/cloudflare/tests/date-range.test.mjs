import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { datePresets, calendarDays, shiftDays } from '../public/admin/date-range.js';

test('preset dates match the supplied September reference including complete prior months', () => {
  const actual = datePresets('2026-09-09', '2021-09-10').map(({ id, from, to }) => [id, from, to]);
  assert.deepEqual(actual, [
    ['last30', '2026-08-11', '2026-09-09'], ['thisMonth', '2026-09-01', '2026-09-09'],
    ['lastMonth', '2026-08-01', '2026-08-31'], ['last3', '2026-06-01', '2026-08-31'],
    ['last6', '2026-03-01', '2026-08-31'], ['thisYear', '2026-01-01', '2026-09-09'],
    ['lastYear', '2025-01-01', '2025-12-31'], ['all', '2021-09-10', '2026-09-09']
  ]);
});
test('calendar boundaries handle leap days, year changes and empty-data all time', () => {
  const leap = datePresets('2024-03-01');
  assert.equal(leap.find(p => p.id === 'lastMonth').to, '2024-02-29');
  assert.deepEqual(datePresets('2026-01-01').find(p => p.id === 'last3'), { id:'last3', label:'Last 3 months', from:'2025-10-01', to:'2025-12-31' });
  assert.equal(shiftDays('2024-03-01', -1), '2024-02-29');
  assert.equal(datePresets('2026-09-09')[7].from, '2026-09-09');
  assert.equal(calendarDays('2026-08-01')[0], '2026-07-26');
  assert.equal(calendarDays('2026-08-01').at(-1), '2026-09-05');
});

const chrome = [process.env.CHROME_BIN, chromium.executablePath()].find(p => p && existsSync(p));
let server, browser, origin;
before(async () => {
  if (!chrome) return;
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture');
    response.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/admin/config') { response.end(JSON.stringify({ brand:{name:'Calendar preview'},timezone:'UTC',earliest_date:'2021-09-10' })); return; }
    if (url.pathname === '/api/admin/metrics') { response.end(JSON.stringify({days:[],totals:{visitors:0,conversions:0,leads:0},timezone:'UTC'})); return; }
    try {
      const filename = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/admin\//,'');
      if (!/^[a-z.-]+$/.test(filename)) throw new Error();
      const file = new URL(`../public/admin/${filename}`, import.meta.url);
      response.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch { response.statusCode=404;response.end('{}'); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); origin=`http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({executablePath:chrome,headless:true});
});
after(async () => {await browser?.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));});
const browserOptions={skip:!chrome?'Set CHROME_BIN for date-picker browser checks.':false};
async function openPage(viewport={width:1440,height:1000}) {
  const page=await browser.newPage({viewport});page.setDefaultTimeout(5000);
  await page.clock.install({time:new Date('2026-09-09T12:00:00Z')});
  await page.goto(origin);await page.locator('[data-range-trigger]:not(:disabled)').waitFor();
  return page;
}
test('preset selection loads exact metrics dates and closes the popover', browserOptions, async () => {
  const page=await openPage();
  try {
    await page.locator('[data-range-trigger]').click();
    assert.equal(await page.locator('[data-range-presets] button').count(),8);
    const request=page.waitForRequest(r=>r.url().includes('/api/admin/metrics?')&&r.url().includes('from=2026-06-01'));
    await page.locator('[data-preset=last3]').click();
    assert.equal(new URL((await request).url()).searchParams.get('to'),'2026-08-31');
    assert.equal(await page.locator('[data-range-popover]').isHidden(),true);
    await page.locator('[data-range-trigger]').click();
    const all=page.waitForRequest(r=>r.url().includes('from=2021-09-10'));
    await page.locator('[data-preset=all]').click();assert.equal(new URL((await all).url()).searchParams.get('to'),'2026-09-09');
  } finally {await page.close();}
});
test('calendar selects custom and reverse ranges, with Escape and outside-click cancellation',browserOptions,async()=>{
  const page=await openPage();
  try{
    await page.locator('[data-range-trigger]').click();
    await page.locator('[data-date="2026-08-20"]').click();
    assert.equal(await page.locator('#date-from').inputValue(),'2026-08-11');
    await page.locator('[data-date="2026-08-14"]').click();
    assert.equal(await page.locator('#date-from').inputValue(),'2026-08-14');assert.equal(await page.locator('#date-to').inputValue(),'2026-08-20');
    await page.locator('[data-range-trigger]').click();await page.locator('[data-date="2026-08-25"]').click();await page.keyboard.press('Escape');
    assert.equal(await page.locator('#date-from').inputValue(),'2026-08-14');assert.equal(await page.locator('[data-range-trigger]').evaluate(el=>el===document.activeElement),true);
    await page.locator('[data-range-trigger]').click();await page.locator('#page-title').click();assert.equal(await page.locator('[data-range-popover]').isHidden(),true);
  }finally{await page.close();}
});
test('calendar keyboard movement crosses months and navigation disables future dates',browserOptions,async()=>{
  const page=await openPage();
  try{
    await page.locator('[data-range-trigger]').click();await page.locator('[data-date="2026-08-31"]').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.date),'2026-09-01');
    assert.equal(await page.locator('[data-date="2026-09-10"]').isDisabled(),true);
    await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    assert.equal(await page.locator('#date-from').inputValue(),'2026-09-01');assert.equal(await page.locator('#date-to').inputValue(),'2026-09-02');
  }finally{await page.close();}
});
test('mobile picker fits the viewport and allows scrolling to calendar dates',browserOptions,async()=>{
  const page=await openPage({width:390,height:844});
  try{
    await page.locator('[data-range-trigger]').click();const bounds=await page.locator('[data-range-popover]').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);assert.ok(bounds.y>=0&&bounds.y+bounds.height<=844);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('[data-date="2026-08-18"]').click();await page.locator('[data-date="2026-08-22"]').click();
    assert.equal(await page.locator('#date-to').inputValue(),'2026-08-22');
  }finally{await page.close();}
});
