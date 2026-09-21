import { HttpError, cleanText, digest, hmac, secureEqual } from './security.js';

export const ERASURE_BATCH = 20;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DAYS = ['leads_days', 'notes_days', 'attribution_days', 'visits_days', 'delivery_history_days'];
const DAY = 86400000;
const IN_IDS = 'SELECT value FROM json_each(?)';
const PENDING = "SELECT lead_id FROM erasure_items WHERE operation_id=?";
const PREPARING = "SELECT 1 FROM erasure_operations WHERE id=? AND status='preparing'";

export const erasedKey = key => digest(`erased-submission:${key}`);
function uuid(value, label = 'Operation ID') {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}
function leadIds(value) {
  if (!Array.isArray(value) || !value.length || value.length > ERASURE_BATCH) throw new HttpError(400, `Select between 1 and ${ERASURE_BATCH} enquiries.`);
  const ids = [...new Set(value.map(id => uuid(id, 'enquiry ID')))];
  if (ids.length !== value.length) throw new HttpError(400, 'Select each enquiry once.');
  return ids.sort();
}
function serializePolicy(row) {
  return { version: row.version, enabled: row.enabled === 1, lead_scope: row.lead_scope,
    ...Object.fromEntries(DAYS.map(key => [key, row[key]])), updated_at: row.updated_at };
}
export async function retentionPolicy(env) {
  return serializePolicy(await env.DB.prepare('SELECT * FROM data_retention_policy WHERE id=1').first());
}
export function validateRetention(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.enabled !== 'boolean') throw new HttpError(400, 'Choose whether automatic retention is enabled.');
  if (!['removed', 'all'].includes(value.lead_scope)) throw new HttpError(400, 'Choose removed enquiries or all enquiries.');
  if (Object.keys(value).some(key => !['enabled', 'lead_scope', ...DAYS].includes(key))) throw new HttpError(400, 'Unrecognized retention setting.');
  const policy = { enabled: value.enabled, lead_scope: value.lead_scope };
  for (const key of DAYS) {
    const days = value[key];
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 36500)) throw new HttpError(400, 'Use whole retention days from 1 to 36,500, or leave the period off.');
    policy[key] = days;
  }
  if (policy.enabled && DAYS.every(key => policy[key] === null)) throw new HttpError(400, 'Choose at least one retention period before enabling automatic cleanup.');
  return policy;
}
async function previewToken(env, value, now) {
  const payload = encodeURIComponent(JSON.stringify({ ...value, expires: now.getTime() + 10 * 60000 }));
  return `${payload}.${await hmac(env.SESSION_SECRET, `data-preview:${payload}`)}`;
}
async function verifyPreview(env, token, kind, now) {
  if (typeof token !== 'string' || token.length > 10000) throw new HttpError(400, 'Preview this action first.');
  const at = token.lastIndexOf('.'), payload = token.slice(0, at), signature = token.slice(at + 1);
  if (at < 0 || !await secureEqual(signature, await hmac(env.SESSION_SECRET, `data-preview:${payload}`))) throw new HttpError(400, 'Preview this action again.');
  let value; try { value = JSON.parse(decodeURIComponent(payload)); } catch { throw new HttpError(400, 'Invalid preview.'); }
  if (value.kind !== kind || !Number.isSafeInteger(value.expires) || value.expires < now.getTime()) throw new HttpError(409, 'The preview expired. Review the current data again.');
  return value;
}
async function selectedRows(env, ids) {
  return (await env.DB.prepare(`SELECT id,version,idempotency_key,name,email,created_at,deleted_at FROM leads
    WHERE id IN (${IN_IDS}) AND NOT EXISTS(SELECT 1 FROM erasure_items e WHERE e.lead_id=leads.id) ORDER BY id`).bind(JSON.stringify(ids)).all()).results;
}
async function erasureCounts(env, ids, now) {
  return env.DB.prepare(`WITH selected AS (SELECT value AS id FROM json_each(?)) SELECT
    (SELECT COUNT(*) FROM leads WHERE id IN (SELECT id FROM selected)) AS enquiries,
    (SELECT COUNT(*) FROM notes WHERE lead_id IN (SELECT id FROM selected)) AS notes,
    (SELECT COUNT(*) FROM activity WHERE lead_id IN (SELECT id FROM selected)) AS activity,
    (SELECT COUNT(*) FROM webhook_outbox WHERE lead_id IN (SELECT id FROM selected)) AS deliveries,
    (SELECT COUNT(*) FROM webhook_outbox WHERE lead_id IN (SELECT id FROM selected) AND claim_token IS NOT NULL AND locked_until>?) AS active_deliveries`).bind(JSON.stringify(ids), Math.floor(now.getTime() / 1000)).first();
}
export async function findErasableLeads(env, url) {
  const q = cleanText(url.searchParams.get('q'), 200, 'Search', true);
  if (q.length < 3) throw new HttpError(400, 'Enter at least three characters of a name, email or phone.');
  const pattern=q;
  const where = "(instr(lower(name),lower(?))>0 OR instr(lower(email),lower(?))>0 OR instr(lower(phone),lower(?))>0) AND NOT EXISTS(SELECT 1 FROM erasure_items e WHERE e.lead_id=leads.id)";
  const rows = await env.DB.batch([
    env.DB.prepare(`SELECT id,name,email,created_at,deleted_at FROM leads WHERE ${where} ORDER BY created_at DESC,id LIMIT 50`).bind(pattern, pattern, pattern),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM leads WHERE ${where}`).bind(pattern, pattern, pattern)
  ]);
  return { enquiries: rows[0].results, total: rows[1].results[0].total, limit: 50 };
}
export async function previewErasure(env, body, now = new Date()) {
  const ids = leadIds(body.lead_ids), rows = await selectedRows(env, ids);
  if (rows.length !== ids.length) throw new HttpError(409, 'An enquiry changed or is already being erased. Refresh the selection.');
  const scope = rows.map(({ id, version }) => ({ id, version }));
  return { enquiries: rows.map(({ id, name, email, created_at, deleted_at }) => ({ id, name, email, created_at, removed: !!deleted_at })),
    counts: await erasureCounts(env, ids, now), token: await previewToken(env, { kind: 'erasure', scope }, now),
    effect: 'Enquiry details, notes, activity and delivery records will be permanently erased. Historical lead and conversion totals may decrease. Visit records follow their separate retention period. Backups, downloaded exports and already delivered copies require separate handling.' };
}
function operation(row, active = 0) {
  return { id: row.id, status: row.status, origin: row.origin, created_at: row.created_at, completed_at: row.completed_at,
    counts: JSON.parse(row.counts), active_deliveries: active };
}
export async function erasureStatus(env, id) {
  uuid(id);
  const row = await env.DB.prepare('SELECT e.*,(SELECT COUNT(*) FROM webhook_outbox o JOIN erasure_items i ON i.lead_id=o.lead_id WHERE i.operation_id=e.id AND o.claim_token IS NOT NULL AND o.locked_until>?) AS active_deliveries FROM erasure_operations e WHERE e.id=?').bind(Math.floor(Date.now()/1000),id).first();
  if (!row) throw new HttpError(404, 'Erasure operation not found.');
  return operation(row,row.active_deliveries);
}
export async function recentErasures(env) {
  const rows = await env.DB.prepare("SELECT e.*,(SELECT COUNT(*) FROM webhook_outbox o JOIN erasure_items i ON i.lead_id=o.lead_id WHERE i.operation_id=e.id AND o.claim_token IS NOT NULL AND o.locked_until>?) AS active_deliveries FROM erasure_operations e ORDER BY CASE WHEN status='complete' THEN 1 ELSE 0 END,created_at DESC,id LIMIT 30").bind(Math.floor(Date.now()/1000)).all();
  return { operations: rows.results.map(row => operation(row,row.active_deliveries)) };
}
// All target rows and their suppression records enter one D1 transaction. The
// preparing state prevents concurrent retries from reapplying the same mutation.
async function startErasure(env, id, scope, origin, now, policyVersion = null) {
  const scopeHash = await digest(JSON.stringify({ scope, origin, policyVersion }));
  const old = await env.DB.prepare('SELECT * FROM erasure_operations WHERE id=?').bind(id).first();
  if (old) {
    if (old.scope_hash !== scopeHash) throw new HttpError(409, 'This operation ID belongs to a different action.');
    return progressErasure(env, id, now);
  }
  const ids = scope.map(row => row.id), rows = await selectedRows(env, ids);
  if (rows.length !== scope.length || rows.some((row, index) => row.id !== scope[index].id || row.version !== scope[index].version)) {
    const accepted=await env.DB.prepare('SELECT scope_hash FROM erasure_operations WHERE id=?').bind(id).first();
    if(accepted?.scope_hash===scopeHash)return progressErasure(env,id,now);
    throw new HttpError(409, 'An enquiry changed. Preview the erasure again.');
  }
  const suppression = await Promise.all(rows.map(async row => ({ lead_id: row.id, key_hash: await erasedKey(row.idempotency_key) })));
  const timestamp = now.toISOString();
  const guard = policyVersion === null ? '1=1' : 'EXISTS(SELECT 1 FROM data_retention_policy WHERE id=1 AND enabled=1 AND version=?)';
  const query = `INSERT OR IGNORE INTO erasure_operations(id,scope_hash,origin,status,created_at)
    SELECT ?,?,?,'preparing',? WHERE ${guard} AND
    (SELECT COUNT(*) FROM leads l JOIN json_each(?) s ON l.id=json_extract(s.value,'$.id')
     WHERE l.version=json_extract(s.value,'$.version') AND NOT EXISTS(SELECT 1 FROM erasure_items i WHERE i.lead_id=l.id))=?`;
  await env.DB.batch([
    env.DB.prepare(query).bind(id, scopeHash, origin, timestamp, ...(policyVersion === null ? [] : [policyVersion]), JSON.stringify(scope), scope.length),
    env.DB.prepare(`INSERT OR IGNORE INTO erasure_items(lead_id,operation_id) SELECT value,? FROM json_each(?) WHERE EXISTS(${PREPARING})`).bind(id, JSON.stringify(ids), id),
    env.DB.prepare(`INSERT OR IGNORE INTO erased_submissions(key_hash,lead_id,erased_at)
      SELECT json_extract(value,'$.key_hash'),json_extract(value,'$.lead_id'),? FROM json_each(?) WHERE EXISTS(${PREPARING})`).bind(timestamp, JSON.stringify(suppression), id),
    env.DB.prepare(`UPDATE leads SET deleted_at=COALESCE(deleted_at,?),updated_at=?,version=version+1 WHERE id IN (${PENDING}) AND EXISTS(${PREPARING})`).bind(timestamp, timestamp, id, id),
    env.DB.prepare(`UPDATE webhook_outbox SET status='failed',last_error='Enquiry erasure requested',locked_until=NULL,claim_token=NULL
      WHERE lead_id IN (${PENDING}) AND (status='pending' OR (status='sending' AND COALESCE(locked_until,0)<=?)) AND EXISTS(${PREPARING})`).bind(id, Math.floor(now.getTime() / 1000), id),
    env.DB.prepare(`UPDATE erasure_operations SET counts=json_object(
      'enquiries',(SELECT COUNT(*) FROM erasure_items WHERE operation_id=?),
      'notes',(SELECT COUNT(*) FROM notes WHERE lead_id IN (${PENDING})),
      'activity',(SELECT COUNT(*) FROM activity WHERE lead_id IN (${PENDING})),
      'deliveries',(SELECT COUNT(*) FROM webhook_outbox WHERE lead_id IN (${PENDING}))),status='waiting'
      WHERE id=? AND status='preparing'`).bind(id, id, id, id, id)
  ]);
  const saved = await env.DB.prepare('SELECT scope_hash FROM erasure_operations WHERE id=?').bind(id).first();
  if (!saved) throw new HttpError(409, 'The selection or retention policy changed. Preview the action again.');
  if (saved.scope_hash !== scopeHash) throw new HttpError(409, 'This operation ID belongs to a different action.');
  return progressErasure(env, id, now);
}
export async function beginErasure(env, body, now = new Date()) {
  const id = uuid(body.operation_id);
  // A retry can use its original signed scope after expiry; it can only finish
  // an operation already accepted under that exact scope, never start a new one.
  const old = await env.DB.prepare('SELECT * FROM erasure_operations WHERE id=?').bind(id).first();
  const value = await verifyPreview(env, body.token, 'erasure', old ? new Date(Math.min(now.getTime(), Date.parse(old.created_at))) : now);
  if (!Array.isArray(value.scope) || !value.scope.length || value.scope.length > ERASURE_BATCH) throw new HttpError(400, 'Invalid erasure scope.');
  return startErasure(env, id, value.scope, 'manual', now);
}
export async function progressErasure(env, id, now = new Date()) {
  uuid(id);
  const row = await env.DB.prepare('SELECT * FROM erasure_operations WHERE id=?').bind(id).first();
  if (!row) throw new HttpError(404, 'Erasure operation not found.');
  if (row.status === 'complete') return operation(row);
  const active = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webhook_outbox WHERE lead_id IN (${PENDING}) AND claim_token IS NOT NULL AND locked_until>?`).bind(id, Math.floor(now.getTime() / 1000)).first();
  if (active.n) return operation(row, active.n);
  // New delivery claims require a visible lead, so marking the selected leads
  // removed prevents a fresh lease after this check. Already-started requests
  // are allowed to finish (or expire) before a completion receipt is issued.
  await env.DB.batch([
    ...['webhook_outbox', 'notes', 'activity', 'lead_notifications'].map(table => env.DB.prepare(`DELETE FROM ${table} WHERE lead_id IN (${PENDING})`).bind(id)),
    env.DB.prepare(`DELETE FROM leads WHERE id IN (${PENDING})`).bind(id),
    env.DB.prepare('DELETE FROM erasure_items WHERE operation_id=?').bind(id),
    env.DB.prepare("UPDATE erasure_operations SET status='complete',completed_at=? WHERE id=? AND status='waiting'").bind(now.toISOString(), id)
  ]);
  return erasureStatus(env, id);
}
export async function exportErasureLedger(env, url) {
  const after=Number(url.searchParams.get('after')||0), requested=url.searchParams.get('through');
  const through=requested===null?(await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) AS n FROM erased_submissions').first()).n:Number(requested);
  if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(through)||through<after)throw new HttpError(400,'Invalid erasure record cursor.');
  const rows=await env.DB.prepare('SELECT sequence,key_hash,lead_id,erased_at FROM erased_submissions WHERE sequence>? AND sequence<=? ORDER BY sequence LIMIT 201').bind(after,through).all();
  const page=rows.results.slice(0,200);
  const source=await env.DB.prepare('SELECT dataset_id,(SELECT COUNT(*) FROM erased_submissions WHERE sequence<=?) AS total FROM data_retention_policy WHERE id=1').bind(through).first();
  return {schema_version:1,dataset_id:source.dataset_id,total:source.total,through,entries:page.map(({sequence,...entry})=>entry),next:rows.results.length>200?page.at(-1).sequence:null};
}

function cutoff(now, days) { return new Date(now.getTime() - days * DAY).toISOString(); }
function leadWhere(policy) { return policy.lead_scope === 'removed' ? 'deleted_at IS NOT NULL AND deleted_at<?' : 'created_at<?'; }
async function retentionCounts(env, policy, now) {
  const counts = {};
  for (const key of DAYS) {
    if (policy[key] === null) { counts[key] = 0; continue; }
    const before = cutoff(now, policy[key]);
    const sql = key === 'leads_days' ? `SELECT COUNT(*) AS n FROM leads WHERE ${leadWhere(policy)} AND NOT EXISTS(SELECT 1 FROM erasure_items e WHERE e.lead_id=leads.id)`
      : key === 'notes_days' ? 'SELECT (SELECT COUNT(*) FROM notes WHERE created_at<?)+(SELECT COUNT(*) FROM activity WHERE created_at<?) AS n'
      : key === 'attribution_days' ? `SELECT COUNT(*) AS n FROM leads WHERE created_at<? AND (referrer<>'' OR attribution NOT IN ('{}','{"first_touch":{},"latest_touch":{}}'))`
      : key === 'visits_days' ? 'SELECT COUNT(*) AS n FROM visit_events WHERE created_at<?'
      : "SELECT COUNT(*) AS n FROM webhook_outbox WHERE created_at<? AND status IN ('delivered','failed') AND (claim_token IS NULL OR COALESCE(locked_until,0)<=CAST(strftime('%s','now') AS INTEGER))";
    counts[key] = (await env.DB.prepare(sql).bind(...(key === 'notes_days' ? [before, before] : [before])).first()).n;
  }
  return counts;
}
export async function previewRetention(env, body, now = new Date()) {
  const policy = validateRetention(body.policy), current = await retentionPolicy(env);
  return { policy, counts: await retentionCounts(env, policy, now), batch_limit: ERASURE_BATCH,
    token: await previewToken(env, { kind: 'retention', policy, version: current.version }, now),
    effect: 'Automatic cleanup changes the retained reporting history. Empty periods remain off. Enquiry erasure waits for active deliveries; other cleanup is bounded per run. Existing accepted erasures continue even if you later turn scheduling off.' };
}
export async function saveRetention(env, body, now = new Date()) {
  const preview = await verifyPreview(env, body.token, 'retention', now), policy = validateRetention(body.policy);
  if (JSON.stringify(policy) !== JSON.stringify(preview.policy)) throw new HttpError(409, 'Settings changed. Preview them again.');
  const row = await env.DB.prepare(`UPDATE data_retention_policy SET version=version+1,enabled=?,lead_scope=?,leads_days=?,notes_days=?,attribution_days=?,visits_days=?,delivery_history_days=?,updated_at=? WHERE id=1 AND version=? RETURNING *`)
    .bind(Number(policy.enabled), policy.lead_scope, ...DAYS.map(key => policy[key]), now.toISOString(), preview.version).first();
  if (!row) {
    const current = await retentionPolicy(env);
    if (JSON.stringify(Object.fromEntries(['enabled', 'lead_scope', ...DAYS].map(key => [key, current[key]]))) === JSON.stringify(policy) && current.version === preview.version + 1) return { policy: current, duplicate: true };
    throw new HttpError(409, 'Retention settings changed elsewhere. Load the current settings and preview again.');
  }
  return { policy: serializePolicy(row), duplicate: false };
}
export async function runRetention(env, now = new Date()) {
  const pending = await env.DB.prepare("SELECT id FROM erasure_operations WHERE status='waiting' ORDER BY created_at LIMIT 1").all();
  for (const row of pending.results) await progressErasure(env, row.id, now);
  const policy = await retentionPolicy(env);
  if (!policy.enabled) return { enabled: false };
  const claim=await env.DB.prepare('UPDATE data_retention_policy SET next_kind=next_kind+1 WHERE id=1 AND enabled=1 AND version=? RETURNING next_kind').bind(policy.version).first();
  if(!claim)return {enabled:false};
  const active=DAYS.filter(key=>policy[key]!==null), category=active[(claim.next_kind-1)%active.length];
  let erasure = null;
  if (category === 'leads_days') {
    const rows = (await env.DB.prepare(`SELECT id,version FROM leads WHERE ${leadWhere(policy)} AND NOT EXISTS(SELECT 1 FROM erasure_items e WHERE e.lead_id=leads.id) ORDER BY id LIMIT ${ERASURE_BATCH}`).bind(cutoff(now, policy.leads_days)).all()).results;
    if (rows.length) {
      try { erasure = await startErasure(env, crypto.randomUUID(), rows, 'retention', now, policy.version); }
      catch (error) { if (error.status !== 409) throw error; }
    }
  }
  const guard = 'EXISTS(SELECT 1 FROM data_retention_policy WHERE id=1 AND enabled=1 AND version=?)';
  const statements = [];
  if (category === 'notes_days') for (const table of ['notes', 'activity']) statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE created_at<? ORDER BY created_at LIMIT 200) AND ${guard}`).bind(cutoff(now, policy.notes_days), policy.version));
  if (category === 'attribution_days') statements.push(env.DB.prepare(`UPDATE leads SET attribution='{"first_touch":{},"latest_touch":{}}',referrer='' WHERE id IN (SELECT id FROM leads WHERE created_at<? AND (referrer<>'' OR attribution NOT IN ('{}','{"first_touch":{},"latest_touch":{}}')) ORDER BY created_at LIMIT 200) AND ${guard}`).bind(cutoff(now, policy.attribution_days), policy.version));
  if (category === 'visits_days') {
    const before = cutoff(now, policy.visits_days);
    const old = 'SELECT event_id FROM visit_events WHERE created_at<? ORDER BY created_at,event_id LIMIT 200';
    statements.push(env.DB.prepare(`UPDATE leads SET visit_event_id=NULL,visitor_hash=NULL WHERE visit_event_id IN (${old}) AND ${guard}`).bind(before, policy.version));
    statements.push(env.DB.prepare(`DELETE FROM visit_events WHERE event_id IN (${old}) AND ${guard}`).bind(before, policy.version));
    statements.push(env.DB.prepare(`DELETE FROM visits WHERE rowid IN (SELECT rowid FROM visits WHERE created_at<? ORDER BY created_at LIMIT 200) AND ${guard}`).bind(before, policy.version));
    statements.push(env.DB.prepare(`UPDATE leads SET visitor_hash=NULL WHERE id IN (SELECT id FROM leads WHERE created_at<? AND visit_event_id IS NULL AND visitor_hash IS NOT NULL ORDER BY created_at LIMIT 200) AND ${guard}`).bind(before, policy.version));
  }
  if (category === 'delivery_history_days') statements.push(env.DB.prepare(`DELETE FROM webhook_outbox WHERE id IN (SELECT id FROM webhook_outbox WHERE created_at<? AND status IN ('delivered','failed') AND (claim_token IS NULL OR COALESCE(locked_until,0)<=CAST(strftime('%s','now') AS INTEGER)) ORDER BY created_at LIMIT 200) AND ${guard}`).bind(cutoff(now, policy.delivery_history_days), policy.version));
  if (statements.length) await env.DB.batch(statements);
  return { enabled: true, category, policy_version: policy.version, erasure, cleanup_statements: statements.length };
}
