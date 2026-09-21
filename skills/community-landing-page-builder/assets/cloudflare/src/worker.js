import { retentionPolicy, findErasableLeads, previewErasure, beginErasure, erasureStatus, recentErasures, progressErasure, exportErasureLedger, previewRetention, saveRetention, runRetention } from './data-lifecycle.js';
import siteConfig from './site-config.json';
import { accountInfo, acknowledgeNotifications, changePassword, exportLeads, notifications, revokeSessions } from './admin-operations.js';
import { HttpError, enforceOrigin, json, rateLimit, readJson, requireSession, secureResponse, privacyOptOut, sessionCookie, sessionTokenHash } from './security.js';
import { addNote, changeStatus, createLead, deleteLead, earliestReportingDate, getLead, listLeads, metrics, recordVisit } from './repository.js';
import { addWebhook, deleteWebhook, enableWebhook, listWebhooks, processOutbox } from './webhooks.js';
import { permissions, authorize, loginTeam, listUsers, createUser, updateUser, inviteOrReset, setOwnerEmail, requestReset, reviewReset, completeAction, memberPassword, memberRevoke } from './team-accounts.js';

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
    return loginTeam(env,request,body);
  }
  if (path === '/api/auth/session' && method === 'GET') { const {token_hash,...user}=await requireSession(env,request); return json({authenticated:true,user,permissions:permissions(user)}); }
  if (path === '/api/auth/reset-request' && method === 'POST') {
    await rateLimit(env,request,'reset-request',4,900);
    await rateLimit(env,request,'reset-request-global',40,900,true);
    return json(await requestReset(env,await readJson(request,2048)),202);
  }
  if (path === '/api/auth/complete' && method === 'POST') {
    await rateLimit(env,request,'account-confirmation',8,900);
    return completeAction(env,request,await readJson(request,4096));
  }
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
    const user=await requireSession(env, request);
    authorize(user,path,method);
    if (!['GET', 'HEAD'].includes(method)) await rateLimit(env, request, 'admin-mutation', 120, 60);
    if (path.startsWith('/api/admin/users') && method!=='GET') await rateLimit(env,request,'account-management',12,900);
    if (path==='/api/admin/users' && method==='GET')return json(await listUsers(env));
    if (path==='/api/admin/users' && method==='POST')return json(await createUser(env,request,user,await readJson(request,4096)),201);
    if (path==='/api/admin/users/owner-email' && method==='POST')return json(await setOwnerEmail(env,request,user,await readJson(request,4096)));
    const resetMatch=/^\/api\/admin\/users\/reset-requests\/([a-f0-9-]{36})\/(approve|reject)$/.exec(path);
    if(resetMatch && method==='POST')return json(await reviewReset(env,request,user,resetMatch[1],resetMatch[2]==='approve'));
    const userMatch=/^\/api\/admin\/users\/(owner|[a-f0-9-]{36})(?:\/(invite|reset))?$/.exec(path);
    if(userMatch && method==='PATCH' && !userMatch[2])return json(await updateUser(env,user,userMatch[1],await readJson(request,2048)));
    if(userMatch && method==='POST' && userMatch[2])return json(await inviteOrReset(env,request,user,userMatch[1],userMatch[2]));
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
    if (path === '/api/admin/account' && method === 'GET') return json(user.id==='owner'?await accountInfo(env):{username:user.username,password_changed_at:(await env.DB.prepare('SELECT updated_at FROM crm_users WHERE id=?').bind(user.id).first()).updated_at});
    if (path === '/api/admin/account/password' && method === 'POST') { await rateLimit(env, request, 'password-change', 5, 900); const body=await readJson(request,4096); return user.id==='owner'?changePassword(env,request,body):memberPassword(env,request,user,body); }
    if (path === '/api/admin/account/revoke-sessions' && method === 'POST') return user.id==='owner'?revokeSessions(env,request):memberRevoke(env,request,user);
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
