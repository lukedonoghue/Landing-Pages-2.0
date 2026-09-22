import { HttpError, cleanText } from './security.js';

const API_ROOT = 'https://api.cloudflare.com/client/v4/accounts';
const now = () => new Date().toISOString();

function normalizeEmail(value) {
  const result = cleanText(value, 90, 'Email', true).toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)) throw new HttpError(400, 'Enter a valid email address.');
  return result;
}

function staticRecipients(env) {
  try {
    const values = JSON.parse(env.CRM_VERIFIED_RECIPIENTS || '[]');
    return Array.isArray(values) ? [...new Set(values.filter(value => typeof value === 'string').map(value => value.trim().toLowerCase()).filter(Boolean))] : [];
  } catch { return []; }
}

export function recipientOnboardingConfigured(env) {
  return /^[a-f0-9]{32}$/i.test(env.CF_EMAIL_ROUTING_ACCOUNT_ID || '') && typeof env.CF_EMAIL_ROUTING_TOKEN === 'string' && env.CF_EMAIL_ROUTING_TOKEN.trim().length > 0;
}

export function emailConfigured(env) {
  const delivery = Boolean(env.EMAIL?.send && typeof env.CRM_EMAIL_FROM === 'string' && env.CRM_EMAIL_FROM.includes('@') && env.CRM_PUBLIC_ORIGIN);
  return delivery && (staticRecipients(env).length > 0 || recipientOnboardingConfigured(env));
}

export function accountDeliveryMode(env, request = null) {
  const configured = typeof env.CRM_PUBLIC_ORIGIN === 'string' ? env.CRM_PUBLIC_ORIGIN.trim() : '';
  let origin;
  try { origin = configured ? new URL(configured) : new URL(`${new URL(request.url).origin}/`); } catch { return 'unavailable'; }
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) return 'unavailable';
  return emailConfigured(env) ? 'email' : 'manual';
}

function providerConfig(env) {
  if (!recipientOnboardingConfigured(env)) throw new HttpError(503, 'Automatic recipient verification is not connected. Ask the Cloudflare account owner to complete the one-time email security setup.');
  return { accountId: env.CF_EMAIL_ROUTING_ACCOUNT_ID, token: env.CF_EMAIL_ROUTING_TOKEN.trim() };
}

async function providerRequest(env, path, init = {}) {
  const { accountId, token } = providerConfig(env);
  let response;
  try {
    response = await fetch(`${API_ROOT}/${accountId}/email/routing/addresses${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new HttpError(503, 'Cloudflare did not confirm the recipient request. No verification status was changed.');
  }
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || payload?.success !== true) throw new HttpError(503, 'Cloudflare did not confirm the recipient request. No verification status was changed.');
  return payload;
}

function checkedAddress(result, expectedEmail) {
  const id = typeof result?.id === 'string' && /^[a-f0-9]{32}$/i.test(result.id) ? result.id : null;
  const address = typeof result?.email === 'string' ? result.email.trim().toLowerCase() : '';
  if (!id || address !== expectedEmail) throw new HttpError(503, 'Cloudflare returned an unexpected recipient record. No verification status was changed.');
  return { id, verifiedAt: typeof result.verified === 'string' && result.verified ? result.verified : null };
}

function publicRow(row) {
  return {
    id: row.id,
    email: row.email,
    status: row.provider_verified_at ? 'verified' : row.status,
    verified_at: row.provider_verified_at || null,
    checked_at: row.checked_at || null,
    invitation_pending: Boolean(row.pending_username),
    source: 'managed'
  };
}

async function audit(env, actorId, action, target) {
  await env.DB.prepare('INSERT INTO crm_access_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), actorId, action, target, now()).run();
}

async function saveProviderResult(env, row, result) {
  const address = checkedAddress(result, row.email);
  const stamp = now();
  const status = address.verifiedAt ? 'verified' : 'pending';
  const saved = await env.DB.prepare(`UPDATE crm_email_recipients SET provider_id=?,status=?,provider_verified_at=?,checked_at=?,updated_at=? WHERE id=? RETURNING *`).bind(address.id, status, address.verifiedAt, stamp, stamp, row.id).first();
  if (!saved) throw new HttpError(409, 'This recipient changed. Refresh and try again.');
  return saved;
}

async function findExistingProviderAddress(env, expectedEmail) {
  for (let page = 1; page <= 4; page += 1) {
    const payload = await providerRequest(env, `?page=${page}&per_page=50&direction=asc`);
    const results = Array.isArray(payload.result) ? payload.result : [];
    const match = results.find(item => typeof item?.email === 'string' && item.email.trim().toLowerCase() === expectedEmail);
    if (match) return match;
    const totalPages = Number(payload.result_info?.total_pages || 1);
    if (page >= totalPages || results.length < 50) break;
    if (page === 4) throw new HttpError(409, 'Cloudflare has more recipient records than the bounded safety check can search. Review Destination Addresses before adding this inbox.');
  }
  return null;
}

export async function listEmailRecipients(env) {
  const managed = await env.DB.prepare('SELECT * FROM crm_email_recipients ORDER BY created_at,email').all();
  const seen = new Set(managed.results.map(row => row.email));
  const configured = staticRecipients(env).filter(email => !seen.has(email)).map(email => ({ id: null, email, status: 'verified', verified_at: null, checked_at: null, invitation_pending: false, source: 'static' }));
  return [...configured, ...managed.results.map(publicRow)];
}

export async function requestEmailRecipient(env, actor, body) {
  const address = normalizeEmail(body.email);
  if (staticRecipients(env).includes(address)) return { id: null, email: address, status: 'verified', verified_at: null, checked_at: null, invitation_pending: false, source: 'static' };
  providerConfig(env);
  let row = await env.DB.prepare('SELECT * FROM crm_email_recipients WHERE email=?').bind(address).first();
  if (row?.provider_id) return publicRow(row);
  if (row) {
    const found = await findExistingProviderAddress(env, address);
    if (!found) throw new HttpError(409, 'Cloudflare did not confirm the earlier request. Check Destination Addresses in Cloudflare; the CRM will not resend it automatically.');
    row = await saveProviderResult(env, row, found);
    return publicRow(row);
  }
  const found = await findExistingProviderAddress(env, address);
  const id = crypto.randomUUID(), stamp = now();
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO crm_email_recipients(id,email,status,requested_by,created_at,updated_at) VALUES(?,?,'requesting',?,?,?) RETURNING *`).bind(id, address, actor.id, stamp, stamp).first();
  if (!inserted) return publicRow(await env.DB.prepare('SELECT * FROM crm_email_recipients WHERE email=?').bind(address).first());
  if (found) {
    row = await saveProviderResult(env, inserted, found);
    await audit(env, actor.id, 'recipient-provider-adopted', id);
    return publicRow(row);
  }
  try {
    const payload = await providerRequest(env, '', { method: 'POST', body: JSON.stringify({ email: address }) });
    row = await saveProviderResult(env, inserted, payload.result);
    await audit(env, actor.id, 'recipient-verification-requested', id);
    return publicRow(row);
  } catch (error) {
    await env.DB.prepare("UPDATE crm_email_recipients SET status='unknown',updated_at=? WHERE id=? AND provider_id IS NULL").bind(now(), id).run();
    throw error;
  }
}

async function refreshRecipient(env, row) {
  if (!row?.provider_id) throw new HttpError(409, 'Cloudflare has not confirmed this recipient request. Check Destination Addresses in Cloudflare.');
  const payload = await providerRequest(env, `/${encodeURIComponent(row.provider_id)}`);
  try { return await saveProviderResult(env, row, payload.result); }
  catch (error) {
    await env.DB.prepare("UPDATE crm_email_recipients SET status='unknown',provider_verified_at=NULL,checked_at=?,updated_at=? WHERE id=?").bind(now(), now(), row.id).run();
    throw error;
  }
}

export async function checkEmailRecipient(env, actor, id) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new HttpError(404, 'Recipient request not found.');
  const row = await env.DB.prepare('SELECT * FROM crm_email_recipients WHERE id=?').bind(id).first();
  if (!row) throw new HttpError(404, 'Recipient request not found.');
  const updated = await refreshRecipient(env, row);
  if (updated.provider_verified_at && !row.provider_verified_at) await audit(env, actor.id, 'recipient-provider-verified', id);
  return publicRow(updated);
}

export async function requireVerifiedRecipient(env, recipient) {
  const address = normalizeEmail(recipient);
  if (staticRecipients(env).includes(address)) return;
  const row = await env.DB.prepare('SELECT * FROM crm_email_recipients WHERE email=?').bind(address).first();
  if (!row) throw new HttpError(409, 'Verify this recipient with Cloudflare in Users before sending account email.');
  const current = await refreshRecipient(env, row);
  if (!current.provider_verified_at) throw new HttpError(409, 'This recipient still needs to open Cloudflare’s verification email. Check its status in Users afterward.');
}
