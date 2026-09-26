import { HttpError, adminCredentials, cleanText, hashPassword, json, sessionCookie, verifyPassword } from './security.js';
import { dimensionConditions, normalizeTrafficFilters } from './traffic.js';
const stages = ['new', 'qualified', 'engaged', 'follow_up', 'won', 'lost'];

export async function accountInfo(env) {
  const account = await adminCredentials(env);
  return { username: account.username, password_changed_at: account.updated_at };
}
export async function changePassword(env, request, body) {
  const account = await adminCredentials(env);
  cleanText(body.current_password, 1024, 'Current password', true);
  if (!await verifyPassword(body.current_password, account.password_hash)) throw new HttpError(401, 'Current password is incorrect.');
  if (body.current_password === body.new_password) throw new HttpError(400, 'Choose a different new password.');
  const encoded = await hashPassword(body.new_password);
  // Compare-and-swap: two concurrent rotations cannot silently overwrite each other.
  const nextVersion = account.version + 1;
  const row = await env.DB.prepare(`INSERT INTO admin_credentials(id,password_hash,version,updated_at,username)
    SELECT 1,?,?,?,? WHERE COALESCE((SELECT version FROM admin_credentials WHERE id=1),0)=?
    ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,version=excluded.version,updated_at=excluded.updated_at,username=excluded.username,recovery_id=NULL
    WHERE admin_credentials.version=? RETURNING version`).bind(encoded, nextVersion, new Date().toISOString(), account.username, account.version, account.version).first();
  if (!row) throw new HttpError(409, 'The account changed. Sign in again before changing its password.');
  // Session version checks already invalidate old credentials, even if cleanup fails.
  await env.DB.prepare('DELETE FROM sessions WHERE user_id IS NULL AND credential_version<?').bind(nextVersion).run();
  return json({ ok: true, signed_out: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
}
export async function revokeSessions(env, request) {
  const account = await adminCredentials(env);
  // Increase credential version too, so an in-flight login using the old version
  // cannot create a valid session after this operation.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO admin_credentials(id,password_hash,version,updated_at,username) VALUES(1,?,1,?,?)
      ON CONFLICT(id) DO UPDATE SET version=version+1,recovery_id=NULL`).bind(account.password_hash, account.updated_at || '', account.username),
    env.DB.prepare('DELETE FROM sessions WHERE user_id IS NULL')
  ]);
  return json({ ok: true, signed_out: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
}
export async function notifications(env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS unread_count,COALESCE(MAX(n.sequence),0) AS through
    FROM lead_notifications n JOIN leads l ON l.id=n.lead_id
    WHERE l.deleted_at IS NULL AND n.sequence>(SELECT seen_sequence FROM admin_notification_state WHERE id=1)`).first();
  return { unread_count: row.unread_count, through: row.through };
}
export async function acknowledgeNotifications(env, body) {
  if (!Number.isSafeInteger(body.through) || body.through < 0) throw new HttpError(400, 'Invalid notification marker.');
  const maximum = (await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) AS maximum FROM lead_notifications').first()).maximum;
  if (body.through > maximum) throw new HttpError(400, 'Invalid notification marker.');
  await env.DB.prepare('UPDATE admin_notification_state SET seen_sequence=MAX(seen_sequence,?) WHERE id=1').bind(body.through).run();
  return notifications(env);
}
export function csvCell(value) {
  let text = String(value ?? '');
  // Quoting alone does not prevent spreadsheet formulas (including leading controls).
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function exportLeads(env, url) {
  for (const name of ['q', 'status']) if (url.searchParams.getAll(name).length > 1) throw new HttpError(400, `Duplicate ${name} filter.`);
  const q = cleanText(url.searchParams.get('q'), 200, 'Search');
  const status = url.searchParams.get('status') || '';
  if (status && status !== 'all' && !stages.includes(status)) throw new HttpError(400, 'Invalid stage.');
  const dimensions = dimensionConditions(normalizeTrafficFilters(url.searchParams));
  let where = `deleted_at IS NULL${dimensions.sql}`; const params = [...dimensions.params];
  if (status && status !== 'all') { where += ' AND status=?'; params.push(status); }
  if (q) {
    where += " AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')";
    const query = `%${q.replace(/[\\%_]/g, '\\$&')}%`; params.push(query, query, query);
  }
  const base = ['id', 'created_at', 'name', 'email', 'phone', 'status', 'traffic_source', 'traffic_type', 'device', 'landing_page'];
  // Click IDs and campaign terms let an owner import qualified leads into Google Ads as
  // offline conversions. They come from the stored first-party attribution; malformed
  // legacy JSON yields empty cells instead of failing the export.
  const attribution = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_campaign', 'utm_term'];
  const columns = [...base, ...attribution];
  const selected = [...base, ...attribution.map(key => `CASE WHEN json_valid(attribution) THEN json_extract(attribution,'$.latest_touch.${key}') END AS ${key}`)];
  // A bounded export avoids Worker memory exhaustion from arbitrary form payloads.
  // It contains all matching contacts up to 10,000, not just the UI's current page.
  const results = await env.DB.batch([
    env.DB.prepare(`SELECT ${selected.join(',')} FROM leads WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 10000`).bind(...params),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM leads WHERE ${where}`).bind(...params)
  ]);
  const rows = results[0].results; const total = results[1].results[0].total;
  const csv = '\uFEFF' + [columns.map(csvCell).join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n';
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store', 'X-Export-Count': String(rows.length), 'X-Export-Total': String(total), 'X-Export-Truncated': String(total > rows.length)
  } });
}
