import { HttpError, cleanText, hmac } from './security.js';
import { serializeLead } from './repository.js';

const MAX_ATTEMPTS = 5;
export function validateWebhookUrl(raw) {
  let url;
  try { url = new URL(cleanText(raw, 2048, 'Webhook URL', true)); } catch { throw new HttpError(400, 'Enter a public HTTPS webhook URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
      /\.(localhost|local|internal|test|example|invalid|onion|lan|home)$/.test(host)) throw new HttpError(400, 'Use a public HTTPS hostname without credentials, fragments or a custom port.');
  return url.href;
}
export function isPublicAddress(address) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    const [a, b, c, d] = address.split('.').map(Number);
    return [a,b,c,d].every(x => x >= 0 && x <= 255) && a > 0 && a < 224 &&
      a !== 10 && a !== 127 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
      !(a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) && !(a === 100 && b >= 64 && b <= 127) &&
      !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) && !(a === 203 && b === 0 && c === 113);
  }
  // Only global unicast IPv6; exclude documentation, Teredo and 6to4 translation ranges.
  const lower = address.toLowerCase();
  return /^[23][a-f0-9]{3}:[a-f0-9:]+$/.test(lower) && !/^2001:(?:0{1,4}:|0?db8:|0{0,2}[12][0-9a-f]:)/.test(lower) && !lower.startsWith('2002:');
}
export async function assertPublicDestination(raw, fetcher = fetch) {
  const url = validateWebhookUrl(raw); const host = new URL(url).hostname;
  const answers = await Promise.all(['A', 'AAAA'].map(async type => {
    const lookup = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    if (!lookup.ok) throw new Error('DNS lookup failed');
    const data = await lookup.json();
    if (data.Status !== 0) throw new Error('DNS lookup failed');
    return (data.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => a.data);
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some(address => !isPublicAddress(address))) throw new HttpError(400, 'Webhook host must resolve only to public addresses.');
  return url;
}
export async function listWebhooks(env) {
  const rows = await env.DB.prepare(`SELECT w.id,w.name,w.url,w.enabled,w.created_at,
    (SELECT COUNT(*) FROM webhook_outbox o WHERE o.webhook_id=w.id AND o.status IN ('pending','sending')) AS pending_count,
    (SELECT COUNT(*) FROM webhook_outbox o WHERE o.webhook_id=w.id AND o.status='failed') AS failed_count,
    (SELECT MAX(delivered_at) FROM webhook_outbox o WHERE o.webhook_id=w.id) AS last_delivered_at
    FROM webhooks w WHERE w.removed_at IS NULL ORDER BY w.created_at DESC`).all();
  return { webhooks: rows.results.map(row => ({ ...row, enabled: Boolean(row.enabled) })) };
}
export async function addWebhook(env, body) {
  const name = cleanText(body.name, 120, 'Webhook name', true);
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM webhooks WHERE removed_at IS NULL').first();
  if (count.total >= 10) throw new HttpError(400, 'A site supports up to 10 webhooks.');
  if (body.enabled != null && typeof body.enabled !== 'boolean') throw new HttpError(400, 'Enabled must be true or false.');
  const url = await assertPublicDestination(body.url);
  const webhook = { id: crypto.randomUUID(), name, url, enabled: body.enabled !== false, created_at: new Date().toISOString(), pending_count: 0, failed_count: 0, last_delivered_at: null };
  await env.DB.prepare('INSERT INTO webhooks(id,name,url,enabled,created_at) VALUES(?,?,?,?,?)').bind(webhook.id, name, url, webhook.enabled ? 1 : 0, webhook.created_at).run();
  return { webhook };
}
export async function deleteWebhook(env, id) {
  const now=Math.floor(Date.now()/1000);
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE webhooks SET enabled=0,removed_at=COALESCE(removed_at,?) WHERE id=? RETURNING id').bind(new Date().toISOString(),id),
    env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Connection removed' WHERE webhook_id=? AND status='pending'").bind(id),
    env.DB.prepare('DELETE FROM webhooks WHERE id=? AND removed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM webhook_outbox o WHERE o.webhook_id=webhooks.id AND o.claim_token IS NOT NULL AND o.locked_until>?)').bind(id,now)
  ]);
  if(!results[0].results.length)throw new HttpError(404,'Webhook not found.');
  const active=await env.DB.prepare('SELECT COUNT(*) AS n FROM webhook_outbox WHERE webhook_id=? AND claim_token IS NOT NULL AND locked_until>?').bind(id,now).first();
  return {ok:true,finishing_deliveries:active.n};
}
export async function enableWebhook(env,id){
  const hook=await env.DB.prepare('SELECT url FROM webhooks WHERE id=? AND removed_at IS NULL').bind(id).first();
  if(!hook)throw new HttpError(404,'Webhook not found.');
  await assertPublicDestination(hook.url);
  const row=await env.DB.prepare('UPDATE webhooks SET enabled=1 WHERE id=? AND removed_at IS NULL RETURNING id').bind(id).first();
  if(!row)throw new HttpError(409,'The connection was removed. Refresh the list.');
  return {ok:true,enabled:true,previous_jobs_requeued:false};
}

export async function processOutbox(env, limit = 5) {
  const now = Math.floor(Date.now() / 1000);
  // Preserve leased rows when a connection is removed; erasure still needs to
  // observe those deliveries until they finish or their lease expires.
  await env.DB.prepare('DELETE FROM webhooks WHERE removed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM webhook_outbox o WHERE o.webhook_id=webhooks.id AND o.claim_token IS NOT NULL AND o.locked_until>?)').bind(now).run();
  // A crashed fifth attempt must become terminal after its lease expires.
  await env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Delivery lease expired after final attempt' WHERE status='sending' AND locked_until<? AND attempts>=?").bind(now, MAX_ATTEMPTS).run();
  // Reconcile old partial removals in bounded batches. Keep active leases so
  // erasure can still observe any already-dispatched request until it finishes.
  await env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Destination or contact is unavailable' WHERE id IN (SELECT o.id FROM webhook_outbox o WHERE o.status IN ('pending','sending') AND NOT EXISTS(SELECT 1 FROM leads l JOIN webhooks w ON w.id=o.webhook_id WHERE l.id=o.lead_id AND l.deleted_at IS NULL AND w.enabled=1 AND w.removed_at IS NULL) LIMIT 100)").run();
  // Filter before LIMIT: even more than 100 orphaned rows cannot starve a
  // valid job in a scheduled batch of one.
  const due = await env.DB.prepare("SELECT o.id FROM webhook_outbox o WHERE attempts<? AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<?)) AND EXISTS(SELECT 1 FROM leads l JOIN webhooks w ON w.id=o.webhook_id WHERE l.id=o.lead_id AND l.deleted_at IS NULL AND w.enabled=1 AND w.removed_at IS NULL) ORDER BY next_attempt_at,o.id LIMIT ?").bind(MAX_ATTEMPTS, now, now, Math.max(1,Math.min(5,limit))).all();
  for (const item of due.results) {
    const claim = crypto.randomUUID();
    const job = await env.DB.prepare("UPDATE webhook_outbox SET status='sending',attempts=attempts+1,locked_until=?,claim_token=? WHERE id=? AND attempts<? AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<?)) AND EXISTS(SELECT 1 FROM leads WHERE leads.id=webhook_outbox.lead_id AND leads.deleted_at IS NULL) RETURNING *").bind(now + 90, claim, item.id, MAX_ATTEMPTS, now, now).first();
    if (!job) continue;
    try {
      const webhook = await env.DB.prepare('SELECT * FROM webhooks WHERE id=? AND enabled=1').bind(job.webhook_id).first();
      const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=? AND deleted_at IS NULL').bind(job.lead_id).first();
      if (!webhook || !lead) {
        await env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Destination or contact is unavailable',locked_until=NULL WHERE id=? AND claim_token=?").bind(job.id, claim).run();
        continue;
      }
      const destination = await assertPublicDestination(webhook.url);
      const payload = JSON.stringify({ event: 'lead.created', event_id: job.id, created_at: job.created_at, lead: serializeLead(lead) });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const headers = { 'Content-Type': 'application/json', 'X-CRM-Event-ID': job.id, 'X-CRM-Timestamp': timestamp };
      if (env.WEBHOOK_SIGNING_SECRET) headers['X-CRM-Signature'] = `sha256=${await hmac(env.WEBHOOK_SIGNING_SECRET, `${timestamp}.${payload}`)}`;
      // Recheck after DNS/signing work: an erasure may have started meanwhile.
      const renewed=await env.DB.prepare("UPDATE webhook_outbox SET locked_until=? WHERE id=? AND claim_token=? AND status='sending' AND locked_until>? AND EXISTS(SELECT 1 FROM leads WHERE leads.id=webhook_outbox.lead_id AND leads.deleted_at IS NULL) AND EXISTS(SELECT 1 FROM webhooks WHERE webhooks.id=webhook_outbox.webhook_id AND webhooks.enabled=1 AND webhooks.removed_at IS NULL) RETURNING id").bind(Math.floor(Date.now()/1000)+90,job.id,claim,Math.floor(Date.now()/1000)).first();
      if(!renewed){
        await env.DB.prepare("UPDATE webhook_outbox SET status='failed',locked_until=NULL,claim_token=NULL,last_error='Delivery cancelled before dispatch' WHERE id=? AND claim_token=? AND status='sending'").bind(job.id,claim).run();
        continue;
      }
      const response = await fetch(destination, { method: 'POST', headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(10000) });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await env.DB.prepare("UPDATE webhook_outbox SET status='delivered',delivered_at=?,locked_until=NULL,last_error=NULL WHERE id=? AND claim_token=? AND status='sending'").bind(new Date().toISOString(), job.id, claim).run();
    } catch (error) {
      // No PII, URL query string, response body or exception payload is logged/stored.
      const reason = /^HTTP \d{3}$/.test(error.message || '') ? error.message : 'Delivery failed or destination rejected';
      await env.DB.prepare('UPDATE webhook_outbox SET status=?,next_attempt_at=?,locked_until=NULL,last_error=? WHERE id=? AND claim_token=? AND status=\'sending\'').bind(job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', Math.floor(Date.now() / 1000) + Math.min(3600, 60 * 2 ** (job.attempts - 1)), reason, job.id, claim).run();
    }
  }
}
