// Intentionally contains no request body, IP, password, query string or token.
export function auditStatement(env, actor, action, target = '-', details = {}) {
  const safe = {};
  if (Number.isSafeInteger(details.count) && details.count >= 0) safe.count = details.count;
  if (/^[a-z0-9.-]{1,253}$/.test(details.destination_host || '')) safe.destination_host = details.destination_host;
  if (/^[a-f0-9]{64}$/.test(details.username_hash || '')) safe.username_hash = details.username_hash;
  return env.DB.prepare('INSERT INTO crm_access_audit(id,actor_id,action,target_id,created_at,details) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), actor || 'anonymous', action, target, new Date().toISOString(), JSON.stringify(safe));
}
export async function recordAudit(env, actor, action, target = '-', details = {}) {
  await auditStatement(env, actor, action, target, details).run();
}
export async function securityOverview(env) {
  const now = Math.floor(Date.now() / 1000);
  const [events, sessions, connections, erasures] = await env.DB.batch([
    env.DB.prepare('SELECT actor_id,action,target_id,created_at,details FROM crm_access_audit ORDER BY created_at DESC,id DESC LIMIT 100'),
    env.DB.prepare(`SELECT COALESCE(s.user_id,'owner') AS user_id,COUNT(*) AS active_sessions,MAX(s.last_seen_at) AS last_seen_at
      FROM sessions s LEFT JOIN crm_users u ON u.id=s.user_id
      WHERE s.expires_at>? AND COALESCE(s.last_seen_at,s.created_at)>? AND
      ((s.user_id IS NULL AND s.credential_version=COALESCE((SELECT version FROM admin_credentials WHERE id=1),0)) OR
       (u.status='active' AND u.email_verified_at IS NOT NULL AND s.credential_version=u.version)) GROUP BY COALESCE(s.user_id,'owner')`).bind(now,now-3600),
    env.DB.prepare('SELECT COUNT(*) AS total FROM webhooks WHERE enabled=1 AND removed_at IS NULL'),
    env.DB.prepare("SELECT status,COUNT(*) AS total FROM sheets_erasure_outbox WHERE status<>'delivered' GROUP BY status")
  ]);
  return {events:events.results.map(row=>({...row,details:JSON.parse(row.details)})),sessions:sessions.results,
    outbound_connections:connections.results[0].total,downstream_erasures:erasures.results};
}
