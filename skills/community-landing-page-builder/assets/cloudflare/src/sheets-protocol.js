import { HttpError, hmac } from './security.js';

export const MAX_ACK_BYTES = 16 * 1024;
export function isAppsScriptEndpoint(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' && u.hostname === 'script.google.com' &&
    !u.port && !u.username && !u.password && !u.hash && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname); } catch { return false; }
}
export function sheetsEndpoint(raw) {
  if (!isAppsScriptEndpoint(raw) || new URL(raw).search) throw new HttpError(400, 'Use the versioned Google Apps Script /exec URL without a query, token or fragment.');
  return new URL(raw).href;
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export async function connectionKey(env, destination, version = 1) {
  if (!/^[a-f0-9]{64}$/i.test(env.GOOGLE_SHEETS_SIGNING_SECRET || '')) throw new Error('Google Sheets signing is not configured');
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Invalid connection key version');
  return hmac(env.GOOGLE_SHEETS_SIGNING_SECRET, `sheets:v1:${version}:${sheetsEndpoint(destination)}`);
}
export function minimalSheetsLead(lead, config = {}) {
  const allowed = new Set(['id','created_at','name','email','phone','status','service']);
  const defaults = ['id','created_at','name','email','phone','status','service'];
  const columns = config.googleSheets?.columns || defaults;
  const result = {id:lead.id};
  for (const key of columns) if (allowed.has(key) && key !== 'service' && lead[key] != null) result[key] = lead[key];
  const service=(config.formFields || []).find(field=>field.name==='service');
  // A field named service is not automatically safe: only declared choices,
  // never free-text/textarea content, may cross the minimal-payload boundary.
  if (columns.includes('service') && ['select','radio'].includes(service?.type) && service.options?.includes(lead.form_data?.service)) result.service = lead.form_data.service;
  // Form fields are opt-in and allow-listed against the form schema, never whole JSON or attribution.
  // Sensitive categories export contact, stage and service only, regardless of custom field settings.
  if (config.sensitiveCategory !== true) {
    const fields = config.googleSheets?.formFields || [];
    for (const field of config.formFields || []) if (fields.includes(field.name) && field.type !== 'textarea' && lead.form_data?.[field.name] != null) {
      (result.fields ||= {})[field.name] = lead.form_data[field.name];
    }
  }
  return result;
}
export async function signedSheetsPayload(env, destination, envelope, version = 1, now = Date.now()) {
  const value = {...envelope, timestamp:Math.floor(now / 1000), key_version:version};
  const signature = await hmac(await connectionKey(env,destination,version), `${value.timestamp}.${canonical(value)}`);
  return JSON.stringify({...value,signature});
}
export class SheetsRejected extends Error {}
export async function readAppsScriptAck(response, eventId) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_ACK_BYTES) { await response.body?.cancel(); throw new Error('Oversized acknowledgement'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing acknowledgement');
  const chunks = []; let length = 0;
  try {
    while (true) { const {done,value} = await reader.read(); if (done) break;
      length += value.byteLength; if (length > MAX_ACK_BYTES) { await reader.cancel(); throw new Error('Oversized acknowledgement'); } chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  let body; try { body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { throw new Error('Invalid acknowledgement'); }
  if (body?.ok === false && body?.retryable === false) throw new SheetsRejected('Google Sheets rejected the signed message');
  if (body?.ok !== true || body.event_id !== eventId) throw new Error('Invalid acknowledgement');
  return body;
}
export function redactConnectionSecret(raw) {
  try { const url = new URL(raw); if (url.search) url.search = '?private=hidden'; return url.href; } catch { return 'Private connection'; }
}
