import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const chrome = [process.env.CHROME_BIN, chromium.executablePath()].find(path => path && existsSync(path));
const browserOptions = { skip: !chrome ? 'Set CHROME_BIN for CRM UI behavior checks.' : false };
let server, browser, origin;

before(async () => {
  if (!chrome) return;
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture');
    let relative = url.pathname === '/admin/' || url.pathname === '/admin' ? 'admin/index.html' : url.pathname.replace(/^\//, '');
    if (!/^[a-z0-9/.-]+$/i.test(relative) || relative.includes('..')) { response.writeHead(404).end(); return; }
    try {
      const data = await readFile(new URL('../public/' + relative, import.meta.url));
      const type = relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      response.end(data);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: chrome, headless: true });
});

after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

const lead = {
  id: 'lead-1',
  name: 'Synthetic Test Lead',
  email: 'test@example.invalid',
  phone: '+44 7700 900000',
  status: 'new',
  version: 1,
  created_at: '2026-09-21T08:00:00Z',
  form_data: { service: 'Monthly bookkeeping' },
  attribution: {}
};

async function adminPage(viewport = { width: 1280, height: 900 }, options = {}) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(6000);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    let json = {};
    if (url.pathname === '/api/auth/session') {
      json = { authenticated: true, user: { id: 'owner', username: 'owner', email: 'owner@example.invalid', role: 'admin' }, permissions: { manage_users: true, edit_leads: true, export_leads: true, manage_settings: true } };
    } else if (url.pathname === '/api/admin/config') {
      json = { brand: { name: 'Synthetic CRM fixture' }, timezone: 'UTC', earliest_date: '2026-09-01' };
    } else if (url.pathname === '/api/admin/metrics') {
      if (options.metricsFailure) { await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Metrics unavailable'})}); return; }
      json = { days: [], totals: { visitors: 0, conversions: 0, leads: 1 }, timezone: 'UTC' };
    } else if (url.pathname === '/api/admin/free-usage') {
      json = options.usage || {connection:'not_connected',status:'unknown',coverage:'incomplete',reason:'not_connected',checked_at:null,last_successful_at:null,qualification:'Cloudflare analytics can be delayed.',period:{daily_resets_at:'2026-09-22T00:00:00.000Z',storage_resets:false},metrics:[],dashboard_url:'https://dash.cloudflare.com/'};
    } else if (url.pathname === '/api/admin/security/overview') {
      json = {events:[],sessions:[],outbound_connections:0,downstream_erasures:[]};
    } else if (url.pathname === '/api/admin/notifications') {
      json = { through: 1, unread_count: 0 };
    } else if (url.pathname === '/api/admin/leads/lead-1') {
      json = { lead, notes: [], activity: [] };
    } else if (url.pathname === '/api/admin/leads') {
      json = { leads: [lead], total: 1, page: 1, limit: 100 };
    } else if (url.pathname === '/api/admin/users') {
      json = {
        email_configured: true,
        users: [{ id: 'owner', username: 'owner', email: 'owner@example.invalid', role: 'admin', status: 'active', email_verified_at: '2026-09-21' }],
        requests: []
      };
    } else if (url.pathname === '/api/admin/webhooks') {
      json = { webhooks: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.goto(origin + '/admin/');
  if (options.metricsFailure) await page.locator('#metrics-status.error').waitFor({state:'visible'});
  else await page.locator('#metric-cards').waitFor({ state: 'visible' });
  await page.locator('#free-usage-heading').filter({hasNotText:'Checking Free usage'}).waitFor();
  return page;
}

async function openLeadDialog(page) {
  await page.locator('[data-view=leads]').click();
  const opener = page.locator('#lead-table [data-open-lead]').first();
  await opener.waitFor({ state: 'visible' });
  await opener.click();
  const dialog = page.locator('#lead-dialog');
  await dialog.locator('.detail-section').first().waitFor();
  assert.equal(await dialog.evaluate(node => node.open), true);
  return { dialog, opener };
}

test('CRM UI behavior source includes guarded backdrop handling and stable block labels', async () => {
  const [app, css, loginCss, usage] = await Promise.all([
    readFile(new URL('../public/admin/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/admin/users.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/login.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/admin/free-usage.js', import.meta.url), 'utf8')
  ]);
  assert.match(app, /isDialogBackdropPointer/);
  assert.match(app, /leadDialog\.addEventListener\('pointerdown'/);
  assert.match(app, /leadBackdropPointerStarted && isDialogBackdropPointer/);
  assert.match(css, /users-invite-form label,.owner-email-form label\{display:block/);
  assert.match(css, /label>input.*label>select.*display:block;width:100%;margin-top:7px/);
  assert.doesNotMatch(css, /lastpass|position:absolute!important|:empty:not\(input,select\)/i);
  assert.match(loginCss, /\[hidden\]\{display:none!important\}/);
  assert.match(loginCss, /\.intro h1\{font-size:4rem;letter-spacing:0\}\.sign-in h2\{letter-spacing:0\}/);
  assert.match(loginCss, /\.description,.help,.form-help,#login-status,#action-status\{color:#52685b\}/);
  assert.match(usage,/visibilitychange/); assert.match(usage,/5 \* 60 \* 1000/); assert.match(usage,/destroy\(\)/);
});

test('usage warning survives performance failure and fits narrow mobile screens', browserOptions, async () => {
  const usage={
    connection:'connected',status:'urgent',coverage:'incomplete',reason:null,checked_at:'2026-09-21T12:00:00.000Z',last_successful_at:'2026-09-21T12:00:00.000Z',
    plan:{id:'workers-free',name:'Workers Free',source:'verified_configuration'},
    qualification:'Cloudflare analytics can be delayed. Values are provider estimates.',period:{daily_resets_at:'2026-09-22T00:00:00.000Z',storage_resets:false},dashboard_url:'https://dash.cloudflare.com/',
    metrics:[
      {id:'workers_requests',label:'Workers requests',value:99_000,limit:100_000,unit:'requests',percent:99,status:'urgent'},
      {id:'d1_rows_read',label:'D1 rows read',value:120_000,limit:5_000_000,unit:'rows',percent:2.4,status:'ok'},
      {id:'d1_rows_written',label:'D1 rows written',value:4_000,limit:100_000,unit:'rows',percent:4,status:'ok'},
      {id:'d1_account_storage',label:'D1 account storage',value:null,limit:5_000_000_000,unit:'bytes',percent:null,status:'unknown'},
      {id:'d1_database_storage',label:'Largest D1 database',value:null,limit:500_000_000,unit:'bytes',percent:null,status:'unknown'}
    ]
  };
  const desktop=await adminPage({width:1280,height:900},{metricsFailure:true,usage});
  try {
    const compact=desktop.locator('#sidebar-usage');
    assert.equal(await compact.isVisible(),true); assert.match(await compact.textContent(),/Workers Free/); assert.match(await compact.textContent(),/Free usage urgent/);
    assert.equal(await compact.locator('.sidebar-usage-metric').count(),3); assert.equal(await compact.locator('.sidebar-usage-metric').first().textContent(),'Requests99%');
    if (process.env.TEST_ARTIFACT_DIR) { await mkdir(process.env.TEST_ARTIFACT_DIR,{recursive:true}); await compact.screenshot({path:join(process.env.TEST_ARTIFACT_DIR,'cloudflare-sidebar-usage.png')}); }
  } finally { await desktop.close(); }
  for (const viewport of [{width:390,height:844},{width:320,height:844}]) {
    const page=await adminPage(viewport,{metricsFailure:true,usage});
    try {
      const banner=page.locator('#free-usage');
      assert.equal(await page.locator('#sidebar-usage').isVisible(),false);
      assert.equal(await banner.getByRole('heading',{name:'Free usage urgent'}).isVisible(),true);
      assert.match(await banner.textContent(),/at least 95% used/); assert.match(await banner.textContent(),/Some usage figures are unavailable/);
      assert.equal(await banner.locator('.usage-metric').count(),5); assert.equal(await banner.locator('.usage-metrics').isVisible(),false);
      await banner.getByText('View 5 usage figures',{exact:true}).click(); assert.equal(await banner.locator('.usage-metrics').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const bounds=await banner.boundingBox(); const actions=await banner.locator('.usage-actions').boundingBox();
      assert.ok(actions.x>=bounds.x-1 && actions.x+actions.width<=bounds.x+bounds.width+1,JSON.stringify({viewport,bounds,actions}));
    } finally { await page.close(); }
  }
});

test('login and forgot-password modes hide, show, and focus the expected controls', browserOptions, async () => {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await page.route('**/api/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) }));
    await page.goto(origin + '/login.html');
    const login = page.locator('#login-form');
    const reset = page.locator('#reset-request-form');
    const forgot = page.locator('#forgot-help');
    assert.equal(await login.isVisible(), true);
    assert.equal(await reset.isHidden(), true);
    assert.equal(await forgot.isVisible(), true);
    await page.locator('#show-reset').click();
    assert.equal(await login.isHidden(), true);
    assert.equal(await reset.isVisible(), true);
    assert.equal(await forgot.isHidden(), true);
    assert.equal(await page.locator('#reset-email').evaluate(node => node === document.activeElement), true);
    await page.locator('#back-to-login').click();
    assert.equal(await login.isVisible(), true);
    assert.equal(await reset.isHidden(), true);
    assert.equal(await forgot.isVisible(), true);
    assert.equal(await page.locator('#username').evaluate(node => node === document.activeElement), true);
  } finally {
    await page.close();
  }
});

test('clicking the lead-details backdrop closes the dialog', browserOptions, async () => {
  const page = await adminPage();
  try {
    const { dialog } = await openLeadDialog(page);
    const bounds = await dialog.boundingBox();
    await page.mouse.click(Math.max(1, bounds.x - 20), bounds.y + 40);
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await dialog.evaluate(node => node.open), false);
  } finally {
    await page.close();
  }
});

test('clicking inside lead details keeps the dialog open', browserOptions, async () => {
  const page = await adminPage();
  try {
    const { dialog } = await openLeadDialog(page);
    await dialog.locator('.detail-section').first().click({ position: { x: 20, y: 20 } });
    assert.equal(await dialog.evaluate(node => node.open), true);
  } finally {
    await page.close();
  }
});

test('dragging a text selection from inside lead details onto the backdrop does not close it', browserOptions, async () => {
  const page = await adminPage();
  try {
    const { dialog } = await openLeadDialog(page);
    const text = dialog.locator('.detail-section dd').first();
    const textBounds = await text.boundingBox();
    const dialogBounds = await dialog.boundingBox();
    await page.mouse.move(textBounds.x + 4, textBounds.y + textBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(Math.max(1, dialogBounds.x - 20), textBounds.y + textBounds.height / 2, { steps: 12 });
    await page.mouse.up();
    assert.equal(await dialog.evaluate(node => node.open), true);
  } finally {
    await page.close();
  }
});

test('Escape closes lead details and restores focus to its opener', browserOptions, async () => {
  const page = await adminPage();
  try {
    const { dialog, opener } = await openLeadDialog(page);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await opener.evaluate(node => node === document.activeElement), true);
  } finally {
    await page.close();
  }
});

test('invite fields keep their baseline geometry and usability with an injected empty sibling', browserOptions, async () => {
  for (const viewport of [{ width: 2048, height: 1035 }, { width: 900, height: 1000 }, { width: 720, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await adminPage(viewport);
    try {
      await page.locator('[data-view=users]').click();
      await page.getByRole('heading', { name: 'Workspace users' }).waitFor();
      const locator = page.locator('.users-invite-form input[name=email],.users-invite-form input[name=username],.users-invite-form select[name=role]');
      const geometry = () => locator.evaluateAll(nodes => nodes.map(node => {
        const bounds = node.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right };
      }));
      const before = await geometry();
      await page.locator('.users-invite-form input[name=username]').evaluate(input => {
        const root = document.createElement('div');
        root.className = 'simulated-password-manager-root';
        input.closest('label').append(root);
      });
      const after = await geometry();
      for (let index = 0; index < before.length; index += 1) {
        for (const edge of ['top', 'bottom', 'left', 'right']) assert.ok(Math.abs(before[index][edge] - after[index][edge]) <= 1, viewport.width + ': ' + JSON.stringify({ before, after }));
      }
      if (viewport.width > 900) {
        assert.ok(Math.max(...after.map(field => field.top)) - Math.min(...after.map(field => field.top)) <= 1, JSON.stringify(after));
        assert.ok(Math.max(...after.map(field => field.bottom)) - Math.min(...after.map(field => field.bottom)) <= 1, JSON.stringify(after));
      } else if (viewport.width > 720) {
        assert.ok(Math.abs(after[0].top - after[1].top) <= 1, JSON.stringify(after));
        assert.ok(Math.abs(after[0].bottom - after[1].bottom) <= 1, JSON.stringify(after));
      }
      const username = page.locator('.users-invite-form input[name=username]');
      await username.click();
      await username.fill('usable-username');
      assert.equal(await username.inputValue(), 'usable-username');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally {
      await page.close();
    }
  }
});
