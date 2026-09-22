import { erasedKey } from './data-lifecycle.js';
import { HttpError, cleanText, digest, reportingDay, visitorHash, attributionAllowed } from './security.js';
import { classifyDevice, classifyTraffic, dimensionConditions, eventId, normalizeTrafficFilters, normalizeVisitAttribution } from './traffic.js';

export const STATUS_IDS = ['new', 'qualified', 'engaged', 'follow_up', 'won', 'lost'];
const attributionKeys = ['source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic', 'gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid'];
function stableJson(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}
function sanitizedUrl(value, origin, sameOrigin = false) {
  if (!value) return '';
  const raw = cleanText(value, 2048, 'URL');
  try {
    const url = new URL(raw, origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (sameOrigin && url.origin !== origin)) throw new Error();
    return sameOrigin ? url.pathname : `${url.origin}${url.pathname}`;
  } catch { throw new HttpError(400, 'Invalid page URL.'); }
}
export function normalizePath(value, origin, config) {
  const path = sanitizedUrl(value || '/', origin, true);
  if (!config.allowedPaths?.includes(path)) throw new HttpError(400, 'This page is not configured for tracking.');
  return path === '/index.html' && config.allowedPaths.includes('/') ? '/' : path;
}
function validateForm(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Form details are required.');
  if (!Array.isArray(fields) || !fields.length) throw new HttpError(503, 'Form fields are not configured.');
  const allowed = new Set(fields.map(f => f.name));
  if (Object.keys(value).some(key => key !== 'website' && !allowed.has(key))) throw new HttpError(400, 'The form contains an unrecognized field.');
  if (value.website != null && (typeof value.website !== 'string' || value.website.trim())) throw new HttpError(400, 'We could not accept this submission.');
  const result = {};
  for (const field of fields) {
    const input = value[field.name];
    if (field.type === 'checkbox') {
      if (input !== undefined && typeof input !== 'boolean') throw new HttpError(400, `${field.name} must be true or false.`);
      if (field.required && input !== true) throw new HttpError(400, `${field.name} is required.`);
      result[field.name] = input === true;
      continue;
    }
    const text = cleanText(input, field.type === 'textarea' ? 4000 : 320, field.name, field.required);
    if (text && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new HttpError(400, 'Enter a valid email address.');
    if (text && field.type === 'tel' && (!/^[+\d\s().-]{7,40}$/.test(text) || text.replace(/\D/g, '').length < 7)) throw new HttpError(400, 'Enter a valid phone number.');
    if (text && Array.isArray(field.options) && !field.options.map(o => typeof o === 'string' ? o : o.value).includes(text)) throw new HttpError(400, `${field.name} is not an allowed choice.`);
    result[field.name] = text;
  }
  return result;
}
function normalizeAttribution(value, origin) {
  const output = { first_touch: {}, latest_touch: {} };
  if (value == null) return output;
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid attribution.');
  for (const key of ['first_touch', 'latest_touch']) {
    const source = value[key];
    if (source == null) continue;
    if (typeof source !== 'object' || Array.isArray(source)) throw new HttpError(400, 'Invalid attribution.');
    for (const name of attributionKeys) if (source[name] != null) output[key][name] = cleanText(source[name], 512, name);
    if (source.landing_page) output[key].landing_page = sanitizedUrl(source.landing_page, origin, true);
    if (source.referrer) output[key].referrer = sanitizedUrl(source.referrer, origin);
  }
  return output;
}
export function serializeLead(row) {
  const { payload_hash, idempotency_key, visitor_hash, deleted_at, ...lead } = row;
  lead.form_data = JSON.parse(row.form_data);
  lead.attribution = JSON.parse(row.attribution);
  for (const key of attributionKeys) lead[key] = lead.attribution.latest_touch?.[key] || lead.attribution.first_touch?.[key] || '';
  lead.source ||= lead.utm_source || lead.traffic_source || (lead.referrer ? 'referral' : 'unknown');
  return lead;
}
export async function createLead(env, request, body, config) {
  if (body.website != null && (typeof body.website !== 'string' || body.website.trim())) throw new HttpError(400, 'We could not accept this submission.');
  const key = cleanText(body.idempotency_key, 128, 'Submission ID', true);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new HttpError(400, 'Invalid submission ID.');
  const suppressionKey = await erasedKey(key);
  if(await env.DB.prepare('SELECT 1 FROM erased_submissions WHERE key_hash=?').bind(suppressionKey).first())throw new HttpError(410,'This enquiry can no longer be retried. Reload the page to start a new enquiry.');
  const origin = new URL(request.url).origin;
  const form = validateForm(body.form_data, config.formFields);
  const keepAttribution = attributionAllowed(request, body, config);
  const attribution = keepAttribution ? normalizeAttribution(body.attribution, origin) : {first_touch:{},latest_touch:{}};
  const page = normalizePath(body.landing_page || '/', origin, config);
  const referrer = keepAttribution ? sanitizedUrl(body.referrer, origin) : '';
  const formName = cleanText(body.form_name || 'enquiry', 120, 'Form name', true);
  const requestedEvent = eventId(body.visit_event_id);
  // Analytics context is not part of the contact payload fingerprint: retain
  // receipt compatibility for pre-migration submissions and safe form retries.
  // Optional tracking may be withdrawn during an uncertain retry. Contact
  // identity stays stable; retries never rewrite previously stored attribution.
  const payloadHash = await digest(stableJson({ form, page, formName }));
  const existing = await env.DB.prepare('SELECT id,receipt_id,payload_hash,deleted_at,form_data,landing_page,form_name FROM leads WHERE idempotency_key=?').bind(key).first();
  if (existing) return duplicateResult(existing, payloadHash);
  const now = new Date(); const timestamp = now.toISOString();
  const day = reportingDay(now, config.timezone);
  const measuredVisitor = await visitorHash(env, request, body, day, config);
  const measuredEvent = requestedEvent && measuredVisitor ? await env.DB.prepare('SELECT event_id,device,traffic_source,traffic_type FROM visit_events WHERE event_id=? AND visitor_hash=? AND reporting_day=? AND path=? AND legacy=0').bind(requestedEvent, measuredVisitor, day, page).first() : null;
  const latestTouch = Object.keys(attribution.latest_touch).length ? attribution.latest_touch : attribution.first_touch;
  const dimensions = measuredEvent || (keepAttribution ? { ...classifyTraffic(latestTouch, latestTouch.referrer || referrer, origin), device: classifyDevice(request.headers.get('User-Agent')) } : {traffic_source:'unknown',traffic_type:'unknown',device:'unknown'});
  const id = crypto.randomUUID(); const receipt = crypto.randomUUID();
  const name = cleanText(form.name || [form.first_name, form.last_name].filter(Boolean).join(' '), 640, 'Name');
  const params = [id, receipt, key, payloadHash, timestamp, timestamp, day, name, form.email || '', form.phone || '', formName, JSON.stringify(form), JSON.stringify(attribution), page, referrer, measuredVisitor, measuredEvent?.event_id || null, dimensions.device, dimensions.traffic_source, dimensions.traffic_type];
  // D1 batch commits CRM, history and durable webhook jobs atomically.
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,name,email,phone,form_name,form_data,attribution,landing_page,referrer,visitor_hash,visit_event_id,device,traffic_source,traffic_type) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM erased_submissions WHERE key_hash=?)').bind(...params,suppressionKey),
    env.DB.prepare("INSERT INTO activity(id,lead_id,event_type,to_status,description,created_at) SELECT ?,id,'created','new','Contact received',? FROM leads WHERE id=?").bind(`created:${id}`, timestamp, id),
    env.DB.prepare("INSERT INTO webhook_outbox(id,webhook_id,lead_id,next_attempt_at,created_at) SELECT lower(hex(randomblob(16))),webhooks.id,leads.id,?,? FROM webhooks CROSS JOIN leads WHERE webhooks.enabled=1 AND leads.id=?").bind(Math.floor(now.getTime() / 1000), timestamp, id)
  ]);
  const saved = await env.DB.prepare('SELECT id,receipt_id,payload_hash,deleted_at,form_data,landing_page,form_name FROM leads WHERE idempotency_key=?').bind(key).first();
  if (!saved) {
    if(await env.DB.prepare('SELECT 1 FROM erased_submissions WHERE key_hash=?').bind(suppressionKey).first())throw new HttpError(410,'This enquiry can no longer be retried. Reload the page to start a new enquiry.');
    throw new HttpError(503, 'The contact could not be saved. Please try again.');
  }
  if (saved.id !== id) return duplicateResult(saved, payloadHash);
  return { ok: true, lead_id: id, receipt_id: receipt, duplicate: false };
}
async function duplicateResult(row, hash) {
  if (row.deleted_at) throw new HttpError(409, 'This submission was removed. Start a new enquiry.', {}, 'submission_removed');
  // Old records used a fingerprint that included optional attribution. Compare
  // their retained normalized contact fields instead of invalidating safe retries.
  const storedHash = row.payload_hash === hash ? hash : await digest(stableJson({form:JSON.parse(row.form_data),page:row.landing_page,formName:row.form_name}));
  if (storedHash !== hash) throw new HttpError(409, 'This submission ID was already used for different details.', {}, 'submission_conflict');
  return { ok: true, lead_id: row.id, receipt_id: row.receipt_id, duplicate: true };
}
export async function listLeads(env, url) {
  const q = cleanText(url.searchParams.get('q'), 200, 'Search');
  const status = url.searchParams.get('status') || '';
  if (status && status !== 'all' && !STATUS_IDS.includes(status)) throw new HttpError(400, 'Invalid stage.');
  const page = parseInteger(url.searchParams.get('page') || '1', 1, 100000, 'Page');
  const limit = parseInteger(url.searchParams.get('limit') || '50', 1, 500, 'Page size');
  const filters = normalizeTrafficFilters(url.searchParams);
  const dimensions = dimensionConditions(filters);
  let where = `deleted_at IS NULL${dimensions.sql}`; const params = [...dimensions.params];
  if (status && status !== 'all') { where += ' AND status=?'; params.push(status); }
  if (q) {
    where += " AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')";
    const search = `%${q.replace(/[\\%_]/g, '\\$&')}%`; params.push(search, search, search);
  }
  const results = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM leads WHERE ${where}`).bind(...params)
  ]);
  return { leads: results[0].results.map(serializeLead), total: results[1].results[0].total, page, limit, filters };
}
function parseInteger(value, min, max, label) {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new HttpError(400, `${label} is outside the allowed range.`);
  return Number(value);
}
export async function getLead(env, id) {
  const results = await env.DB.batch([
    env.DB.prepare('SELECT * FROM leads WHERE id=? AND deleted_at IS NULL').bind(id),
    env.DB.prepare('SELECT id,body,created_at FROM notes WHERE lead_id=? ORDER BY created_at DESC,id DESC').bind(id),
    env.DB.prepare('SELECT id,event_type,from_status,to_status,description,created_at FROM activity WHERE lead_id=? ORDER BY created_at DESC,id DESC').bind(id)
  ]);
  if (!results[0].results[0]) throw new HttpError(404, 'Contact not found.');
  return { lead: serializeLead(results[0].results[0]), notes: results[1].results, activity: results[2].results };
}
export async function changeStatus(env, id, body) {
  if (!STATUS_IDS.includes(body.status)) throw new HttpError(400, 'Invalid stage.');
  if (!Number.isSafeInteger(body.version) || body.version < 1) throw new HttpError(400, 'The current contact version is required.');
  const row = await env.DB.prepare('UPDATE leads SET status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL RETURNING *').bind(body.status, new Date().toISOString(), id, body.version).first();
  if (!row) {
    const exists = await env.DB.prepare('SELECT id FROM leads WHERE id=? AND deleted_at IS NULL').bind(id).first();
    throw new HttpError(exists ? 409 : 404, exists ? 'This contact changed. Refresh and try again.' : 'Contact not found.');
  }
  return { lead: serializeLead(row) };
}
export async function addNote(env, id, body) {
  const text = cleanText(body.body, 4000, 'Note', true);
  const noteId = body.request_id === undefined ? crypto.randomUUID() : eventId(body.request_id, true);
  const now = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO notes(id,lead_id,body,created_at) SELECT ?,id,?,? FROM leads WHERE id=? AND deleted_at IS NULL').bind(noteId, text, now, id),
    env.DB.prepare("INSERT OR IGNORE INTO activity(id,lead_id,event_type,description,created_at) SELECT ?,lead_id,'note_added','Note added',created_at FROM notes WHERE id=? AND lead_id=? AND body=?").bind(`note:${noteId}`, noteId, id, text)
  ]);
  const saved = await env.DB.prepare('SELECT n.id,n.body,n.created_at,n.lead_id FROM notes n JOIN leads l ON l.id=n.lead_id WHERE n.id=? AND l.deleted_at IS NULL').bind(noteId).first();
  if (!saved) throw new HttpError(404, 'Contact not found.');
  if (saved.lead_id !== id || saved.body !== text) throw new HttpError(409, 'This note request was already used for different details.');
  return { note: { id: saved.id, body: saved.body, created_at: saved.created_at }, duplicate: !results[0].meta.changes };
}
export async function deleteLead(env, id) {
  const now = new Date().toISOString();
  // Commit removal and delivery cancellation together. Repeating a lost
  // acknowledgement reconciles queue state without modifying reporting history.
  const result = await env.DB.batch([
    env.DB.prepare('UPDATE leads SET deleted_at=COALESCE(deleted_at,?),updated_at=CASE WHEN deleted_at IS NULL THEN ? ELSE updated_at END,version=version+CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END WHERE id=? RETURNING id').bind(now, now, id),
    env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Contact removed' WHERE lead_id=? AND status IN ('pending','sending')").bind(id)
  ]);
  if (!result[0].results.length) throw new HttpError(404, 'Contact not found.');
  return { ok: true };
}
export async function earliestReportingDate(env, config) {
  // Removed contacts remain part of accepted-lead reporting, so they also define
  // the beginning of the available history. Each MIN can use its date index.
  const row = await env.DB.prepare('SELECT MIN(date) AS earliest_date FROM (SELECT MIN(reporting_day) AS date FROM visit_events UNION ALL SELECT MIN(reporting_day) AS date FROM leads)').first();
  return row?.earliest_date || reportingDay(new Date(), config.timezone);
}
export async function recordVisit(env, request, body, config) {
  const now = new Date(); const day = reportingDay(now, config.timezone);
  const visitor = await visitorHash(env, request, body, day, config);
  if (!visitor) return { ok: true, measured: false };
  const id = eventId(body.event_id, true);
  const origin = new URL(request.url).origin;
  const path = normalizePath(body.path, origin, config);
  const keepAttribution = attributionAllowed(request, body, config);
  const attribution = keepAttribution ? normalizeVisitAttribution(body.attribution) : {};
  const referrer = keepAttribution ? sanitizedUrl(body.referrer, origin) : '';
  const dimensions = { ...(keepAttribution ? classifyTraffic(attribution, referrer, origin) : {traffic_source:'unknown',traffic_type:'unknown'}), device: classifyDevice(request.headers.get('User-Agent')) };
  const payloadHash = await digest(stableJson({ day, visitor, path, attribution, referrer, dimensions }));
  const inserted = await env.DB.prepare('INSERT OR IGNORE INTO visit_events(event_id,reporting_day,path,visitor_hash,created_at,payload_hash,device,traffic_source,traffic_type) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(id, day, path, visitor, now.toISOString(), payloadHash, dimensions.device, dimensions.traffic_source, dimensions.traffic_type).run();
  const saved = await env.DB.prepare('SELECT payload_hash FROM visit_events WHERE event_id=?').bind(id).first();
  if (!saved || saved.payload_hash !== payloadHash) throw new HttpError(409, 'This visit ID was already used for a different visit.');
  return { ok: true, measured: true, event_id: id, duplicate: !inserted.meta.changes };
}
export async function metrics(env, url, config) {
  const today = reportingDay(new Date(), config.timezone);
  const end = validDate(url.searchParams.get('to') || today);
  const fallbackStart = new Date(`${end}T12:00:00Z`); fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 29);
  const start = validDate(url.searchParams.get('from') || fallbackStart.toISOString().slice(0, 10));
  const range = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
  const endExclusive = new Date(`${start}T00:00:00Z`);
  endExclusive.setUTCFullYear(endExclusive.getUTCFullYear() + 100);
  if (range < 0 || Date.parse(end) >= endExclusive.getTime()) throw new HttpError(400, 'Choose a date range of up to 100 calendar years, with the end on or after the start.');
  const filters = normalizeTrafficFilters(url.searchParams);
  const requestedPath = url.searchParams.get('path');
  const path = requestedPath ? normalizePath(requestedPath, url.origin, config) : null;
  const dimensions = dimensionConditions(filters, 'v');
  const leadDimensions = dimensionConditions(filters, 'l');
  const visitsWhere = `${path ? ' AND v.path=?' : ''}${dimensions.sql}`;
  const leadsWhere = `${path ? ' AND l.landing_page=?' : ''}${leadDimensions.sql}`;
  const params = [...(path ? [path] : []), ...dimensions.params];
  const leadParams = [...(path ? [path] : []), ...leadDimensions.params];
  const unique = filters.visitor_mode === 'unique';
  const visitorCount = unique ? 'COUNT(DISTINCT v.visitor_hash)' : 'COUNT(*)';
  const conversionCount = unique ? 'COUNT(DISTINCT CASE WHEN c.event_id IS NOT NULL THEN v.visitor_hash END)' : 'COUNT(c.event_id)';
  // Join only accepted contacts linked to this exact measured event, preserving a
  // common denominator cohort even when one browser visits from several sources.
  const converted = '(SELECT DISTINCT l.visit_event_id AS event_id FROM leads l JOIN visit_events linked ON linked.event_id=l.visit_event_id AND linked.visitor_hash=l.visitor_hash AND linked.reporting_day=l.reporting_day AND linked.path=l.landing_page)';
  const eventQuery = (dated) => `SELECT v.reporting_day AS date,${visitorCount} AS visitors,${conversionCount} AS conversions FROM visit_events v LEFT JOIN ${converted} c ON c.event_id=v.event_id WHERE ${dated ? 'v.reporting_day BETWEEN ? AND ?' : '1=1'}${visitsWhere} GROUP BY v.reporting_day`;
  const coverageWhere = path ? ' AND path=?' : '';
  const results = await env.DB.batch([
    env.DB.prepare(eventQuery(true)).bind(start, end, ...params),
    env.DB.prepare(`SELECT l.reporting_day AS date,COUNT(*) AS leads FROM leads l WHERE l.reporting_day BETWEEN ? AND ?${leadsWhere} GROUP BY l.reporting_day`).bind(start, end, ...leadParams),
    env.DB.prepare(`SELECT COALESCE(SUM(visitors),0) AS visitors,COALESCE(SUM(conversions),0) AS conversions FROM (${eventQuery(false)})`).bind(...params),
    env.DB.prepare(`SELECT COUNT(*) AS leads FROM leads l WHERE 1=1${leadsWhere}`).bind(...leadParams),
    env.DB.prepare(`SELECT COUNT(*) AS recorded_events,COALESCE(SUM(legacy),0) AS legacy_visits,COALESCE(SUM(CASE WHEN device='unknown' OR traffic_source='unknown' OR traffic_type='unknown' THEN 1 ELSE 0 END),0) AS unknown_dimensions FROM visit_events WHERE reporting_day BETWEEN ? AND ?${coverageWhere}`).bind(start, end, ...(path ? [path] : [])),
    env.DB.prepare(`SELECT COALESCE(SUM(legacy),0) AS legacy_visits FROM visit_events WHERE 1=1${coverageWhere}`).bind(...(path ? [path] : []))
  ]);
  const events = new Map(results[0].results.map(row => [row.date, row]));
  const leads = new Map(results[1].results.map(row => [row.date, row.leads]));
  const days = [];
  for (let i = 0; i <= range; i++) {
    const date = new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10);
    const { visitors = 0, conversions = 0 } = events.get(date) || {};
    days.push({ date, visitors, conversions, leads: leads.get(date) || 0, conversion_rate: percent(conversions, visitors) });
  }
  const totals = days.reduce((t, d) => ({ visitors: t.visitors + d.visitors, conversions: t.conversions + d.conversions, leads: t.leads + d.leads }), { visitors: 0, conversions: 0, leads: 0 });
  totals.conversion_rate = percent(totals.conversions, totals.visitors);
  const lifetime = { ...results[2].results[0], leads: results[3].results[0].leads };
  lifetime.conversion_rate = percent(lifetime.conversions, lifetime.visitors);
  const coverage = { ...results[4].results[0], lifetime_legacy_visits: results[5].results[0].legacy_visits };
  coverage.all_visits_complete = coverage.legacy_visits === 0;
  const warnings = [];
  const retentionHistory=await env.DB.prepare("SELECT EXISTS(SELECT 1 FROM erasure_operations WHERE status='complete') AS erased,(SELECT next_kind FROM data_retention_policy WHERE id=1) AS runs").first();
  if(retentionHistory.erased||retentionHistory.runs>0)warnings.push('Reports show retained history. Permanent erasure and retention can reduce past lead, visitor and conversion totals.');
  if (coverage.legacy_visits) warnings.push('Historical visits were stored as daily unique browsers only. Their source and device are Unknown; All visits includes one historical record per browser, page and day, so historical repeat visits cannot be recovered.');
  else if (coverage.lifetime_legacy_visits && !unique) warnings.push('All-time comparisons include historical daily-unique records; historical repeat visits cannot be recovered.');
  if (coverage.unknown_dimensions && !coverage.legacy_visits) warnings.push('Some measured visits have an unknown device, traffic type or source. Specific filters exclude unknown values unless Unknown is selected.');
  coverage.warnings = warnings;
  return { days, totals, lifetime_totals: lifetime, filters, coverage, warnings, timezone: config.timezone,
    definition: unique ? 'Visitors are daily unique browsers within the selected filters. Conversions are those browsers with an accepted contact linked to a measured visit in the same filtered cohort. Total visitors sums daily uniques, not unique people across the range. All retained accepted leads are counted separately, including unmeasured submissions and removed contacts. Permanently erased enquiries and expired records are excluded.' : 'Visitors are measured page visits within the selected filters. Conversions are measured visits with at least one accepted contact; repeat contacts in the same visit count once. All retained accepted leads are counted separately, including unmeasured submissions and removed contacts. Permanently erased enquiries and expired records are excluded.',
    analytics_mode: config.analyticsMode };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new HttpError(400, 'Use a valid YYYY-MM-DD date.');
  return value;
}
function percent(numerator, denominator) { return denominator ? Math.round(numerator / denominator * 10000) / 100 : 0; }
