import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const executable = chromium.executablePath();
const browserPath = existsSync(executable) ? executable : null;
const options = { skip: browserPath ? false : 'Playwright-managed Chromium is not installed.' };
let server, browser, origin;

before(async () => {
  if (!browserPath) return;
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture');
    let relative;
    if (url.pathname === '/admin/' || url.pathname === '/admin') relative = 'admin/index.html';
    else relative = url.pathname.replace(/^\//, '');
    if (!/^[a-z0-9/.-]+$/i.test(relative) || relative.includes('..')) { response.writeHead(404).end(); return; }
    try {
      const data = await readFile(new URL(`../public/${relative}`, import.meta.url));
      const type = relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(data);
    } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
});

after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

const lead = { id:'lead-1', name:'Synthetic Test Lead', email:'test@example.invalid', phone:'+44 7700 900000', status:'new', version:1, created_at:'2026-09-21T08:00:00Z', traffic_source:'google', traffic_type:'paid', utm_medium:'cpc' };
const profiles = {
  admin: { user:{id:'owner',username:'owner',email:'owner@example.invalid',role:'admin'}, permissions:{manage_users:true,edit_leads:true,export_leads:true,manage_settings:true} },
  teammateAdmin: { user:{id:'admin-2',username:'admin-two',email:'admin-two@example.invalid',role:'admin'}, permissions:{manage_users:true,edit_leads:true,export_leads:true,manage_settings:true} },
  manager: { user:{id:'manager-1',username:'manager-one',email:'manager@example.invalid',role:'manager'}, permissions:{manage_users:false,edit_leads:true,export_leads:true,manage_settings:true} },
  viewer: { user:{id:'viewer-1',username:'viewer-one',email:'viewer@example.invalid',role:'viewer'}, permissions:{manage_users:false,edit_leads:false,export_leads:false,manage_settings:false} }
};

async function adminPage(profile, { emailConfigured = true, deliveryMode = emailConfigured ? 'email' : 'unavailable', recipientOnboardingConfigured = emailConfigured, legacy = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(6000); const calls = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method();
    if (method !== 'GET') calls.push({ method, path:url.pathname, body:request.postDataJSON?.() });
    let status = 200; let json = {};
    if (url.pathname === '/api/auth/session') json = legacy ? {authenticated:true} : {authenticated:true,...profile};
    else if (url.pathname === '/api/admin/config') json = {brand:{name:'Synthetic team fixture'},timezone:'UTC',earliest_date:'2026-09-01'};
    else if (url.pathname === '/api/admin/metrics') json = {days:[],totals:{visitors:0,conversions:0,leads:0},timezone:'UTC'};
    else if (url.pathname === '/api/admin/free-usage') json = {connection:'not_connected',status:'unknown',reason:'not_connected',checked_at:null,last_successful_at:null,qualification:'Cloudflare analytics can be delayed.',period:{daily_resets_at:'2026-09-22T00:00:00.000Z',storage_resets:false},metrics:[],dashboard_url:'https://dash.cloudflare.com/'};
    else if (url.pathname === '/api/admin/notifications') json = {through:10,unread_count:2};
    else if (url.pathname === '/api/admin/leads') json = {leads:[lead],total:1,page:1,limit:100};
    else if (url.pathname === '/api/admin/leads/lead-1') json = {lead,notes:[],activity:[]};
    else if (url.pathname === '/api/admin/users' && method === 'GET') json = {
      email_configured:emailConfigured,
      account_delivery_mode:deliveryMode,
      recipient_onboarding_configured:recipientOnboardingConfigured,
      recipients:[
        {id:'recipient-1',email:'owner@example.invalid',status:'verified',verified_at:'2026-09-21',source:'managed'},
        {id:'recipient-2',email:'waiting@example.invalid',status:'pending',verified_at:null,source:'managed'}
      ],
      users:[
        {id:'owner',username:'owner',email:'owner@example.invalid',role:'admin',status:'active',email_verified_at:'2026-09-21'},
        {id:'manager-1',username:'manager-one',email:'manager@example.invalid',role:'manager',status:'active',email_verified_at:'2026-09-21'},
        {id:'invited-1',username:'invited-user',email:'invite@example.invalid',role:'viewer',status:'invited',email_verified_at:null}
      ],
      requests:[
        {id:'request-self',user_id:'owner',email:'owner@example.invalid',username:'owner',status:'pending',created_at:'2026-09-21T08:00:00Z'},
        {id:'request-other',user_id:'manager-1',email:'manager@example.invalid',username:'manager-one',status:'pending',created_at:'2026-09-21T08:01:00Z'}
      ]
    };
    else if (url.pathname === '/api/admin/webhooks') json = {webhooks:[]};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)});
  });
  await page.goto(`${origin}/admin/`); await page.locator('#metric-cards').waitFor({state:'visible'});
  return {page,calls};
}

test('admin sees restrained user management and unavailable email actions stay disabled', options, async () => {
  const {page,calls} = await adminPage(profiles.admin,{emailConfigured:false});
  try {
    assert.match(await page.locator('#free-usage').textContent(),/Ask Codex to connect read-only Cloudflare usage access/);
    const usersNav = page.locator('[data-view=users]'); assert.equal(await usersNav.isVisible(),true); await usersNav.click();
    await page.getByRole('heading',{name:'Workspace users'}).waitFor();
    const provider=page.locator('.users-provider'),setup=page.locator('.users-security-setup');
    assert.equal(await provider.getByText('One-time account setup required',{exact:true}).isVisible(),true);
    assert.equal(await setup.evaluate(node=>node.open),true);
    const setupCopy=await setup.textContent();
    assert.match(setupCopy,/Use secure links on Free/);
    assert.match(setupCopy,/Gmail and other inboxes work without a sending domain/);
    assert.match(setupCopy,/one token limited to Email Routing Addresses Write/);
    assert.match(setupCopy,/Open Users > Owner email/);
    assert.match(setupCopy,/Teammates can use any email domain, including Gmail or an agency address/);
    assert.doesNotMatch(setupCopy,/test account|CRM_EMAIL|current CRM address|JSON/i);
    assert.ok(setupCopy.trim().split(/\s+/).length<=180);
    assert.equal(await setup.getByRole('link',{name:'Cloudflare instructions'}).getAttribute('href'),'https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/');
    assert.equal(await page.getByRole('button',{name:'Create invitation'}).isDisabled(),true);
    assert.equal(await page.locator('.recipient-form').isHidden(),true);
    assert.equal(await page.getByRole('button',{name:'Create new invite link'}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Create verification link'}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Create reset link'}).count(),2);
    assert.equal(await page.getByRole('button',{name:'Create reset link'}).evaluateAll(buttons=>buttons.every(button=>button.disabled)),true);
    assert.equal(await page.getByRole('button',{name:'Another admin required'}).isDisabled(),true);
    assert.equal(await page.getByRole('heading',{name:'Owner email'}).isVisible(),true);
    const row = page.locator('.users-table tbody tr').filter({hasText:'manager-one'});
    await row.waitFor();
    if (process.env.TEST_ARTIFACT_DIR) {
      await mkdir(process.env.TEST_ARTIFACT_DIR,{recursive:true});
      for (const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:844}]) {
        await page.setViewportSize(viewport);
        await provider.screenshot({path:join(process.env.TEST_ARTIFACT_DIR,`users-admin-${viewport.width}.png`)});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      }
      await page.setViewportSize({width:1280,height:900});
    }
    await page.setViewportSize({width:320,height:844});
    assert.deepEqual(await page.locator('.users-table').evaluate(node=>({pageFits:document.documentElement.scrollWidth<=innerWidth,tableScrolls:node.scrollWidth>node.clientWidth})),{pageFits:true,tableScrolls:true});
    await page.setViewportSize({width:1280,height:900});
    const setupToggle=setup.getByText('One-time security setup',{exact:true}); await setupToggle.focus(); await page.keyboard.press('Enter'); assert.equal(await setup.evaluate(node=>node.open),false); await page.keyboard.press('Space'); assert.equal(await setup.evaluate(node=>node.open),true);
    await setupToggle.click(); assert.equal(await setup.evaluate(node=>node.open),false);
    await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/users'),page.getByRole('button',{name:'Refresh',exact:true}).click()]);
    assert.equal(await setup.evaluate(node=>node.open),false);
    await row.getByLabel('Role for manager-one').selectOption('viewer'); await row.getByRole('button',{name:'Save'}).click();
    await page.getByText('User access updated.').waitFor();
    assert.ok(calls.some(call => call.method === 'PATCH' && call.path === '/api/admin/users/manager-1' && call.body.role === 'viewer'));
    const invited = page.locator('.users-table tbody tr').filter({hasText:'invited-user'});
    await invited.getByLabel('Email for invited-user').fill('corrected@example.invalid'); await invited.getByRole('button',{name:'Save'}).click();
    await page.getByText('Invitation corrected.').waitFor();
    assert.ok(calls.some(call => call.method === 'PATCH' && call.path === '/api/admin/users/invited-1' && call.body.email === 'corrected@example.invalid'));
  } finally { await page.close(); }
});

test('non-owner admin sees teammate setup without owner-only instructions', options, async () => {
  const {page}=await adminPage(profiles.teammateAdmin,{emailConfigured:false});
  try {
    await page.locator('[data-view=users]').click(); await page.getByRole('heading',{name:'Workspace users'}).waitFor();
    const setup=page.locator('.users-security-setup');
    assert.match(await setup.textContent(),/Adding a teammate/);
    assert.equal(await setup.getByText('Choose the inbox and sender.',{exact:true}).count(),0);
    assert.equal(await page.getByRole('heading',{name:'Owner email'}).isHidden(),true);
  } finally { await page.close(); }
});

test('available email configuration remains explicitly unverified until the delivery test', options, async () => {
  const {page}=await adminPage(profiles.admin,{emailConfigured:true});
  try {
    await page.locator('[data-view=users]').click(); await page.getByRole('heading',{name:'Workspace users'}).waitFor();
    const provider=page.locator('.users-provider'),setup=page.locator('.users-security-setup');
    assert.equal(await provider.getByText('Automatic email is ready',{exact:true}).isVisible(),true);
    assert.match(await provider.textContent(),/Cloudflare can send account messages to verified inboxes\./);
    assert.doesNotMatch(await provider.textContent(),/email delivery is configured|setup complete/i);
    assert.equal(await setup.evaluate(node=>node.open),false);
    assert.equal(await page.getByRole('button',{name:'Create invitation'}).isEnabled(),true);
    assert.equal(await page.getByRole('button',{name:'Add recipient'}).isEnabled(),true);
    assert.equal(await page.getByText('Waiting for inbox confirmation',{exact:true}).isVisible(),true);
    assert.equal(await page.getByText('CRM verified',{exact:true}).count(),2);
  } finally { await page.close(); }
});

test('manual Free mode enables Gmail-compatible one-use account links without a sender domain', options, async () => {
  const {page}=await adminPage(profiles.admin,{emailConfigured:false,deliveryMode:'manual',recipientOnboardingConfigured:false});
  try {
    await page.locator('[data-view=users]').click(); await page.getByRole('heading',{name:'Workspace users'}).waitFor();
    const provider=page.locator('.users-provider');
    assert.equal(await provider.getByText('Secure account links are ready',{exact:true}).isVisible(),true);
    assert.match(await provider.textContent(),/Gmail or your normal email app.*No sending domain is required/s);
    assert.equal(await page.getByRole('button',{name:'Create invitation'}).isEnabled(),true);
    assert.equal(await page.locator('.recipient-form').isHidden(),true);
    assert.equal(await page.getByRole('button',{name:'Create verification link'}).isEnabled(),true);
  } finally { await page.close(); }
});

test('manager keeps operational controls but cannot see user administration', options, async () => {
  const {page} = await adminPage(profiles.manager);
  try {
    assert.match(await page.locator('#free-usage').textContent(),/Ask an administrator to connect read-only Cloudflare usage access/);
    assert.equal(await page.locator('[data-view=users]').isHidden(),true);
    assert.equal(await page.locator('[data-view=connections]').isVisible(),true);
    await page.locator('[data-view=leads]').click(); await page.locator('#lead-table').waitFor({state:'visible'});
    assert.equal(await page.locator('#lead-table [data-lead-stage]').isEnabled(),true);
    await page.locator('[data-view=account]').click();
    assert.equal(await page.getByRole('button',{name:'Export contacts CSV'}).isVisible(),true);
  } finally { await page.close(); }
});

test('View-only access is read-only while own password and session controls remain', options, async () => {
  const {page,calls} = await adminPage(profiles.viewer);
  try {
    assert.match(await page.locator('#free-usage').textContent(),/Ask an administrator to connect read-only Cloudflare usage access/);
    assert.equal(await page.locator('[data-view=users]').isHidden(),true);
    assert.equal(await page.locator('[data-view=connections]').isHidden(),true);
    await page.locator('[data-view=leads]').click(); await page.locator('#lead-table').waitFor({state:'visible'});
    assert.equal(await page.locator('#lead-table [data-lead-stage]').isDisabled(),true);
    await page.locator('#lead-table [data-open-lead]').click(); await page.locator('#lead-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#lead-dialog .note-form').count(),0);
    assert.equal(await page.getByRole('button',{name:'Remove contact'}).count(),0);
    await page.keyboard.press('Escape'); await page.locator('[data-view=account]').click();
    assert.equal(await page.getByRole('button',{name:'Export contacts CSV'}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Mark as seen'}).count(),0);
    await page.locator('.account-details summary').click();
    assert.equal(await page.getByRole('button',{name:'Change password & sign out'}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Sign out all devices'}).count(),1);
    assert.equal(calls.filter(call => call.path === '/api/admin/notifications/acknowledge').length,0);
  } finally { await page.close(); }
});

test('authenticated legacy session without a user gets only the explicit owner compatibility path', options, async () => {
  const {page} = await adminPage(profiles.admin,{legacy:true});
  try { assert.equal(await page.locator('[data-view=users]').isVisible(),true); assert.equal(await page.locator('[data-view=connections]').isVisible(),true); }
  finally { await page.close(); }
});

test('forgot-password UI distinguishes unavailable email from a generic accepted request', options, async () => {
  const page = await browser.newPage({viewport:{width:900,height:700}}); let configured = false;
  try {
    await page.route('**/api/auth/session', route => route.fulfill({json:{authenticated:false}}));
    await page.route('**/api/auth/reset-request', route => configured ? route.fulfill({status:202,json:{accepted:true}}) : route.fulfill({status:503,json:{error:'Email delivery is not configured.'}}));
    await page.goto(`${origin}/login.html`); await page.getByRole('button',{name:'Forgot your password?'}).click();
    await page.getByLabel('Account email').fill('test@example.invalid'); await page.getByRole('button',{name:/Request reset/}).click();
    await page.locator('#reset-error').filter({hasText:'not configured'}).waitFor(); assert.equal(await page.locator('#login-status').textContent(),'');
    configured = true; await page.getByRole('button',{name:/Request reset/}).waitFor({state:'visible'}); await page.waitForFunction(() => !document.querySelector('#reset-submit').disabled); await page.getByRole('button',{name:/Request reset/}).click();
    await page.locator('#login-status').filter({hasText:'If an account matches'}).waitFor(); assert.equal(await page.locator('#reset-error').textContent(),'');
  } finally { await page.close(); }
});

test('fragment account actions send password only when the action asks for one', options, async () => {
  const bodies=[];
  for (const [purpose,expectedPassword] of [['invite',true],['verify-email',false]]) {
    const page=await browser.newPage({viewport:{width:900,height:700}});
    try {
      await page.route('**/api/auth/complete', async route => { bodies.push(route.request().postDataJSON()); await route.fulfill({json:{completed:true}}); });
      await page.goto(`${origin}/account-action.html#token=synthetic-${purpose}&purpose=${purpose}`);
      assert.equal(new URL(page.url()).hash,'');
      if (expectedPassword) { await page.getByLabel(/New password/).fill('synthetic-password-16-characters'); await page.getByLabel(/Confirm new password/).fill('synthetic-password-16-characters'); }
      await page.getByRole('button',{name:expectedPassword?/Save and continue/:/Confirm email/}).click();
      await page.getByRole('heading',{name:'Account action complete.'}).waitFor();
    } finally { await page.close(); }
  }
  assert.equal(bodies[0].password,'synthetic-password-16-characters'); assert.equal('password' in bodies[1],false);
});
