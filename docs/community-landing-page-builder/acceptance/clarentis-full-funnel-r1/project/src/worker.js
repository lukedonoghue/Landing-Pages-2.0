import { retentionPolicy, findErasableLeads, previewErasure, beginErasure, erasureStatus, recentErasures, progressErasure, exportErasureLedger, previewRetention, saveRetention, runRetention } from './data-lifecycle.js';
import siteConfig from './site-config.json';
import { accountInfo, acknowledgeNotifications, changePassword, exportLeads, notifications, revokeSessions } from './admin-operations.js';
import { HttpError, adminCredentials, cleanText, secureEqual, enforceOrigin, hmac, json, randomToken, rateLimit, readJson, requireSession, secureResponse, privacyOptOut, sessionCookie, sessionTokenHash, verifyPassword } from './security.js';
import { addNote, changeStatus, createLead, deleteLead, earliestReportingDate, getLead, listLeads, metrics, recordVisit } from './repository.js';
import { addWebhook, deleteWebhook, enableWebhook, listWebhooks, processOutbox } from './webhooks.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try { return secureResponse(await route(request, env, ctx, url), url.pathname); }
    catch (error) {
      // Return no database exception text, secrets, submitted details or stack traces.
      return secureResponse(json({ error: error instanceof HttpError ? error.message : 'The service is temporarily unavailable. Please try again.' }, error instanceof HttpError ? error.status : 503, error.headers || {}), url.pathname);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      await runRetention(env);
      await processOutbox(env, 1);
      const now = Math.floor(Date.now() / 1000);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
        env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now)
      ]);
    })());
  }
};
async function route(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;
  if (path.startsWith('/api/') && !['GET', 'HEAD'].includes(method)) enforceOrigin(request);
  if (path === '/api/privacy-config' && method === 'GET') return json({analytics_mode:siteConfig.analyticsMode || 'consent',attribution_mode:siteConfig.attributionMode || 'consent',advertising_user_data_mode:siteConfig.advertisingUserDataMode || 'disabled',consent_ui:siteConfig.consentUiMode || 'internal',sensitive_category:siteConfig.sensitiveCategory === true,gtm_container_id:/^GTM-[A-Z0-9]+$/.test(siteConfig.gtmContainerId||'')?siteConfig.gtmContainerId:'',browser_opt_out:privacyOptOut(request)});
  if (path === '/api/health' && method === 'GET') {
    await env.DB.prepare('SELECT id FROM leads LIMIT 1').first();
    return json({ ok: true, database: 'connected', release: { version_id: env.CF_VERSION_METADATA?.id || null, release_id: env.FUNNEL_RELEASE_ID || null, source_fingerprint: env.FUNNEL_SOURCE_FINGERPRINT || null } });
  }
  if (path === '/api/auth/login' && method === 'POST') {
    await rateLimit(env, request, 'login', 8, 900);
    await rateLimit(env, request, 'login-global', 80, 900, true);
    const body = await readJson(request, 2048);
    cleanText(body.password, 1024, 'Password', true);
    const account = await adminCredentials(env);
    const suppliedUsername = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const passwordMatches = await verifyPassword(body.password, account.password_hash);
    if (!secureEqual(suppliedUsername, account.username) || !passwordMatches) throw new HttpError(401, 'Incorrect username or password.');
    const prior = await sessionTokenHash(env, request);
    const token = randomToken(); const tokenHash = await hmac(env.SESSION_SECRET, `session:${token}`);
    const now = Math.floor(Date.now() / 1000);
    const statements = [env.DB.prepare('INSERT INTO sessions(token_hash,created_at,expires_at,credential_version,username) SELECT ?,?,?,?,? WHERE COALESCE((SELECT version FROM admin_credentials WHERE id=1),0)=? RETURNING token_hash').bind(tokenHash, now, now + 43200, account.version, account.username, account.version)];
    if (prior) statements.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(prior));
    const saved = await env.DB.batch(statements);
    if (!saved[0].results.length) throw new HttpError(401, 'Credentials changed. Please sign in again.');
    return json({ authenticated: true }, 200, { 'Set-Cookie': sessionCookie(request, token) });
  }
  if (path === '/api/auth/session' && method === 'GET') { await requireSession(env, request); return json({ authenticated: true }); }
  if (path === '/api/auth/logout' && method === 'POST') {
    const tokenHash = await sessionTokenHash(env, request);
    if (tokenHash) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
  }
  if (path === '/api/visits' && method === 'POST') {
    await rateLimit(env, request, 'visits', 240, 3600);
    return json(await recordVisit(env, request, await readJson(request, 8192), siteConfig));
  }
  if (path === '/api/leads' && method === 'POST') {
    await rateLimit(env, request, 'leads', 12, 600);
    const result = await createLead(env, request, await readJson(request), siteConfig);
    // The receipt only acknowledges the committed CRM record. Outbound delivery is independent.
    ctx.waitUntil(processOutbox(env).catch(() => {}));
    return json(result, result.duplicate ? 200 : 201);
  }
  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    await requireSession(env, request);
    if (!['GET', 'HEAD'].includes(method)) await rateLimit(env, request, 'admin-mutation', 120, 60);
    if(path==='/api/admin/data/retention'&&method==='GET')return json(await retentionPolicy(env));
    if(path==='/api/admin/data/retention/preview'&&method==='POST')return json(await previewRetention(env,await readJson(request,4096)));
    if(path==='/api/admin/data/retention'&&method==='POST')return json(await saveRetention(env,await readJson(request,16384)));
    if(path==='/api/admin/data/retention/run'&&method==='POST')return json(await runRetention(env));
    if(path==='/api/admin/data/enquiries'&&method==='GET')return json(await findErasableLeads(env,url));
    if(path==='/api/admin/data/erasures/preview'&&method==='POST')return json(await previewErasure(env,await readJson(request,4096)));
    if(path==='/api/admin/data/erasures'&&method==='POST')return json(await beginErasure(env,await readJson(request,16384)),202);
    if(path==='/api/admin/data/erasures'&&method==='GET')return json(await recentErasures(env));
    if(path==='/api/admin/data/erasure-records'&&method==='GET')return json(await exportErasureLedger(env,url));
    const erasureMatch=/^\/api\/admin\/data\/erasures\/([a-f0-9-]{36})(\/continue)?$/.exec(path);
    if(erasureMatch&&method==='GET'&&!erasureMatch[2])return json(await erasureStatus(env,erasureMatch[1]));
    if(erasureMatch&&method==='POST'&&erasureMatch[2])return json(await progressErasure(env,erasureMatch[1]));
    if (path === '/api/admin/account' && method === 'GET') return json(await accountInfo(env));
    if (path === '/api/admin/account/password' && method === 'POST') { await rateLimit(env, request, 'password-change', 5, 900); return changePassword(env, request, await readJson(request, 4096)); }
    if (path === '/api/admin/account/revoke-sessions' && method === 'POST') return revokeSessions(env, request);
    if (path === '/api/admin/notifications' && method === 'GET') return json(await notifications(env));
    if (path === '/api/admin/notifications/acknowledge' && method === 'POST') return json(await acknowledgeNotifications(env, await readJson(request, 1024)));
    if (path === '/api/admin/leads/export.csv' && method === 'GET') return exportLeads(env, url);
    if (path === '/api/admin/config' && method === 'GET') return json({ brand: { name: siteConfig.name, color: siteConfig.color, logo: siteConfig.logo }, stages: siteConfig.stages, timezone: siteConfig.timezone, analytics_mode: siteConfig.analyticsMode, earliest_date: await earliestReportingDate(env, siteConfig) });
    if (path === '/api/admin/leads' && method === 'GET') return json(await listLeads(env, url));
    if (path === '/api/admin/metrics' && method === 'GET') return json(await metrics(env, url, siteConfig));
    const leadMatch = /^\/api\/admin\/leads\/([a-f0-9-]{36})(\/notes)?$/.exec(path);
    if (leadMatch) {
      const id = leadMatch[1]; const notes = Boolean(leadMatch[2]);
      if (notes && method === 'POST') return json(await addNote(env, id, await readJson(request, 8192)), 201);
      if (!notes && method === 'GET') return json(await getLead(env, id));
      if (!notes && method === 'PATCH') return json(await changeStatus(env, id, await readJson(request, 2048)));
      if (!notes && method === 'DELETE') return json(await deleteLead(env, id));
    }
    if (path === '/api/admin/webhooks' && method === 'GET') return json(await listWebhooks(env));
    if (path === '/api/admin/webhooks' && method === 'POST') return json(await addWebhook(env, await readJson(request, 4096)), 201);
    const webhookMatch = /^\/api\/admin\/webhooks\/([a-f0-9-]{36})$/.exec(path);
    if (webhookMatch && method === 'DELETE') return json(await deleteWebhook(env, webhookMatch[1]));
    if(webhookMatch&&method==='PATCH'){
      const body=await readJson(request,1024);
      if(body.enabled!==true||Object.keys(body).some(key=>key!=='enabled'))throw new HttpError(400,'This action enables new deliveries only.');
      return json(await enableWebhook(env,webhookMatch[1]));
    }
    throw new HttpError(404, 'Endpoint not found.');
  }
  if (path.startsWith('/api/')) throw new HttpError(404, 'Endpoint not found.');
  if (!['GET', 'HEAD'].includes(method)) throw new HttpError(405, 'Method not allowed.', { Allow: 'GET, HEAD' });
  // Decode protected routes too: encoded /admin aliases must never bypass authentication.
  let decoded;
  try { decoded = decodeURIComponent(path).replace(/\\/g, '/'); } catch { throw new HttpError(400, 'Invalid URL.'); }
  if (decoded === '/admin' || decoded.startsWith('/admin/')) {
    try { await requireSession(env, request); }
    catch (error) { if (error.status === 401) return Response.redirect(`${url.origin}/login.html`, 302); throw error; }
    if (decoded === '/admin') return Response.redirect(`${url.origin}/admin/`, 302);
  }
  if (!env.ASSETS) throw new HttpError(503, 'Site assets are not configured.');
  return env.ASSETS.fetch(request);
}
