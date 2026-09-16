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
    FROM webhooks w ORDER BY w.created_at DESC`).all();
  return { webhooks: rows.results.map(row => ({ ...row, enabled: Boolean(row.enabled) })) };
}
export async function addWebhook(env, body) {
  const name = cleanText(body.name, 120, 'Webhook name', true);
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM webhooks').first();
  if (count.total >= 10) throw new HttpError(400, 'A site supports up to 10 webhooks.');
  if (body.enabled != null && typeof body.enabled !== 'boolean') throw new HttpError(400, 'Enabled must be true or false.');
  const url = await assertPublicDestination(body.url);
  const webhook = { id: crypto.randomUUID(), name, url, enabled: body.enabled !== false, created_at: new Date().toISOString(), pending_count: 0, failed_count: 0, last_delivered_at: null };
  await env.DB.prepare('INSERT INTO webhooks(id,name,url,enabled,created_at) VALUES(?,?,?,?,?)').bind(webhook.id, name, url, webhook.enabled ? 1 : 0, webhook.created_at).run();
  return { webhook };
}
export async function deleteWebhook(env, id) {
  const row = await env.DB.prepare('DELETE FROM webhooks WHERE id=? RETURNING id').bind(id).first();
  if (!row) throw new HttpError(404, 'Webhook not found.');
  return { ok: true };
}
export async function processOutbox(env) {
  const now = Math.floor(Date.now() / 1000);
  // A crashed fifth attempt must become terminal after its lease expires.
  await env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Delivery lease expired after final attempt' WHERE status='sending' AND locked_until<? AND attempts>=?").bind(now, MAX_ATTEMPTS).run();
  const due = await env.DB.prepare("SELECT id FROM webhook_outbox WHERE attempts<? AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<?)) ORDER BY next_attempt_at LIMIT 5").bind(MAX_ATTEMPTS, now, now).all();
  for (const item of due.results) {
    const claim = crypto.randomUUID();
    const job = await env.DB.prepare("UPDATE webhook_outbox SET status='sending',attempts=attempts+1,locked_until=?,claim_token=? WHERE id=? AND attempts<? AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<?)) RETURNING *").bind(now + 90, claim, item.id, MAX_ATTEMPTS, now, now).first();
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
