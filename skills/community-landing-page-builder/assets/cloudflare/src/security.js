const encoder = new TextEncoder();
export class HttpError extends Error {
  constructor(status, message, headers = {}, code = null) { super(message); this.status = status; this.headers = headers; this.code = code; }
}
export function hex(bytes) { return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function unhex(value) { return Uint8Array.from(value.match(/../g) || [], x => parseInt(x, 16)); }
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function hmac(secret, value) {
  if (typeof secret !== 'string' || secret.length < 32) throw new HttpError(503, 'Server security configuration is incomplete.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
export function randomToken() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
export function secureEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
export function adminUsername(env) {
  const username = typeof env.ADMIN_USERNAME === 'string' ? env.ADMIN_USERNAME.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9._@+\-]{2,79}$/.test(username)) throw new HttpError(503, 'Named admin authentication is not configured.');
  return username;
}
export async function adminCredentials(env) {
  const bootstrapUsername = adminUsername(env);
  const stored = await env.DB.prepare('SELECT password_hash,version,updated_at,username FROM admin_credentials WHERE id=1').first();
  const username = stored?.username == null ? bootstrapUsername : adminUsername({ ADMIN_USERNAME: stored.username });
  return { username, password_hash: stored?.password_hash || env.ADMIN_PASSWORD_HASH, version: stored?.version || 0, updated_at: stored?.updated_at || null };
}
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 1024) throw new HttpError(400, 'Use a password with 16 to 1024 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, salt }, key, 256);
  return `pbkdf2_sha256$100000$${hex(salt)}$${hex(hash)}`;
}
export async function verifyPassword(password, encoded) {
  const match = /^pbkdf2_sha256\$(100000)\$([a-f0-9]{32,128})\$([a-f0-9]{64})$/.exec(encoded || '');
  if (!match || match[2].length % 2) throw new HttpError(503, 'Admin authentication is not configured.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: Number(match[1]), salt: unhex(match[2]) }, key, 256);
  return secureEqual(hex(hash), match[3]);
}
export function enforceOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new HttpError(403, 'Request origin is not allowed.');
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && !['same-origin', 'none'].includes(site)) throw new HttpError(403, 'Cross-site request denied.');
}
export async function readJson(request, maximum = 32768) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, 'Send application/json.');
  if (Number(request.headers.get('Content-Length') || 0) > maximum) throw new HttpError(413, 'Request is too large.');
  if (!request.body) throw new HttpError(400, 'A JSON body is required.');
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > maximum) { await reader.cancel(); throw new HttpError(413, 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Invalid JSON object.'); }
}
export function reportingDay(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const f = Object.fromEntries(parts.map(p => [p.type, p.value])); return `${f.year}-${f.month}-${f.day}`;
}
export function privacyOptOut(request) { return request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1'; }
export function attributionAllowed(request, body, config) {
  if (privacyOptOut(request) || body.attribution_consent === false) return false;
  const mode = config.attributionMode || 'consent';
  if (mode === 'lead') return true;
  return mode === 'consent' && !privacyChoiceDenied(request) && (body.attribution_consent === true || (body.attribution_consent === undefined && body.analytics_consent === true));
}
export function privacyChoiceDenied(request) { return /(?:^|;\s*)funnel_privacy_choice=deny(?:;|$)/.test(request.headers.get('Cookie') || ''); }
export async function visitorHash(env, request, body, day, config) {
  if (['off', 'disabled'].includes(config.analyticsMode) || privacyOptOut(request) || privacyChoiceDenied(request)) return null;
  if (body.analytics_consent !== true) return null;
  if (typeof body.visitor_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.visitor_id)) return null;
  return hmac(env.SESSION_SECRET, `visitor:${day}:${body.visitor_id}`);
}
export async function rateLimit(env, request, namespace, maximum, seconds, global = false) {
  const now = Math.floor(Date.now() / 1000);
  const ip = global ? 'global' : (request.headers.get('CF-Connecting-IP') || 'local');
  const key = await hmac(env.SESSION_SECRET, `rate:${namespace}:${Math.floor(now / seconds)}:${ip}`);
  const expires = (Math.floor(now / seconds) + 1) * seconds;
  const row = await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, expires).first();
  if (row.count > maximum) throw new HttpError(429, 'Too many requests. Please try again later.', { 'Retry-After': String(expires - now) });
}
export function sessionCookie(request, token, maxAge = 43200) {
  const secure = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
  return `crm_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export async function sessionTokenHash(env, request) {
  const token = /(?:^|;\s*)crm_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1];
  return token ? hmac(env.SESSION_SECRET, `session:${token}`) : null;
}
export async function requireSession(env, request) {
  const tokenHash = await sessionTokenHash(env, request);
  if (!tokenHash) throw new HttpError(401, 'Please sign in.');
  const member = await env.DB.prepare(`SELECT u.id,u.username,u.email,u.role FROM sessions s JOIN crm_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=u.version AND u.status='active' AND u.email_verified_at IS NOT NULL`).bind(tokenHash, Math.floor(Date.now()/1000)).first();
  if (member) return {...member, token_hash:tokenHash};
  const credentials = await adminCredentials(env);
  const session = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash=? AND expires_at>? AND credential_version=? AND username=? AND user_id IS NULL').bind(tokenHash, Math.floor(Date.now() / 1000), credentials.version, credentials.username).first();
  if (!session) throw new HttpError(401, 'Your session has expired. Please sign in.');
  const profile = await env.DB.prepare('SELECT email FROM crm_owner_profile WHERE id=1').first();
  return {id:'owner', username:credentials.username, email:profile?.email || '', role:'admin', token_hash:tokenHash};
}
export function cleanText(value, maximum, field, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, `${field} is invalid.`);
  const result = value.trim(); if (required && !result) throw new HttpError(400, `${field} is required.`); return result;
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
export function secureResponse(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY'); headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/account-action')) {
    headers.set('Cache-Control', 'no-store'); headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
