import { HttpError, cleanText, hmac } from './security.js';
import { serializeLead } from './repository.js';
import { auditStatement } from './access-audit.js';
import { isAppsScriptEndpoint, sheetsEndpoint, connectionKey, minimalSheetsLead, signedSheetsPayload, readAppsScriptAck, redactConnectionSecret, SheetsRejected } from './sheets-protocol.js';

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
  const rows = await env.DB.prepare(`SELECT w.id,w.name,w.url,w.enabled,w.created_at,w.sheets_key_version,
    (SELECT COUNT(*) FROM webhook_outbox o WHERE o.webhook_id=w.id AND o.status IN ('pending','sending')) AS pending_count,
    (SELECT COUNT(*) FROM webhook_outbox o WHERE o.webhook_id=w.id AND o.status='failed') AS failed_count,
    (SELECT MAX(delivered_at) FROM webhook_outbox o WHERE o.webhook_id=w.id) AS last_delivered_at
    FROM webhooks w WHERE w.removed_at IS NULL ORDER BY w.created_at DESC`).all();
  return { webhooks: rows.results.map(row => ({ ...row, url:redactConnectionSecret(row.url), enabled: Boolean(row.enabled) })) };
}
export async function addWebhook(env, body, actor = 'owner') {
  const name = cleanText(body.name, 120, 'Webhook name', true);
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM webhooks WHERE removed_at IS NULL').first();
  if (count.total >= 10) throw new HttpError(400, 'A site supports up to 10 webhooks.');
  if (body.enabled != null && typeof body.enabled !== 'boolean') throw new HttpError(400, 'Enabled must be true or false.');
  const url = await assertPublicDestination(body.url);
  let keyVersion=1;
  if (isAppsScriptEndpoint(url)) {
    sheetsEndpoint(url);
    const retained=await env.DB.prepare('SELECT key_version FROM sheets_destination_keys WHERE destination=?').bind(url).first();
    keyVersion=retained?.key_version || 1;
    await connectionKey(env,url,keyVersion);
  }
  const webhook = { id: crypto.randomUUID(), name, url, enabled: body.enabled !== false, created_at: new Date().toISOString(), pending_count: 0, failed_count: 0, last_delivered_at: null };
  await env.DB.batch([
    ...(isAppsScriptEndpoint(url)?[env.DB.prepare('INSERT OR IGNORE INTO sheets_destination_keys(destination,key_version) VALUES(?,?)').bind(url,keyVersion)]:[]),
    env.DB.prepare('INSERT INTO webhooks(id,name,url,enabled,created_at,sheets_key_version) VALUES(?,?,?,?,?,COALESCE((SELECT key_version FROM sheets_destination_keys WHERE destination=?),1))').bind(webhook.id,name,url,webhook.enabled?1:0,webhook.created_at,url),
    auditStatement(env,actor,'webhook-created',webhook.id,{destination_host:new URL(url).hostname})]);
  return {webhook:{...webhook,url:redactConnectionSecret(url),sheets_key_version:keyVersion}};
}
export async function deleteWebhook(env, id, actor = 'owner') {
  const now=Math.floor(Date.now()/1000);
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE webhooks SET enabled=0,removed_at=COALESCE(removed_at,?) WHERE id=? RETURNING id').bind(new Date().toISOString(),id),
    env.DB.prepare("UPDATE webhook_outbox SET status='failed',last_error='Connection removed' WHERE webhook_id=? AND status='pending'").bind(id),
    env.DB.prepare('DELETE FROM webhooks WHERE id=? AND removed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM webhook_outbox o WHERE o.webhook_id=webhooks.id AND o.claim_token IS NOT NULL AND o.locked_until>?)').bind(id,now),
    auditStatement(env,actor,'webhook-deleted',id)
  ]);
  if(!results[0].results.length)throw new HttpError(404,'Webhook not found.');
  const active=await env.DB.prepare('SELECT COUNT(*) AS n FROM webhook_outbox WHERE webhook_id=? AND claim_token IS NOT NULL AND locked_until>?').bind(id,now).first();
  return {ok:true,finishing_deliveries:active.n};
}
export async function enableWebhook(env,id,actor='owner'){
  const hook=await env.DB.prepare('SELECT url FROM webhooks WHERE id=? AND removed_at IS NULL').bind(id).first();
  if(!hook)throw new HttpError(404,'Webhook not found.');
  await assertPublicDestination(hook.url);
  if (isAppsScriptEndpoint(hook.url)) { sheetsEndpoint(hook.url); await connectionKey(env,hook.url); }
  const row=await env.DB.prepare('UPDATE webhooks SET enabled=1 WHERE id=? AND removed_at IS NULL RETURNING id').bind(id).first();
  if(!row)throw new HttpError(409,'The connection was removed. Refresh the list.');
  await auditStatement(env,actor,'webhook-enabled',id,{destination_host:new URL(hook.url).hostname}).run();
  return {ok:true,enabled:true,previous_jobs_requeued:false};
}

export async function processOutbox(env, limit = 5, config = {}) {
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
      const sheets = isAppsScriptEndpoint(destination);
      const envelope = {event:'lead.created',event_id:job.id,created_at:job.created_at,lead:sheets?minimalSheetsLead(serializeLead(lead),config):serializeLead(lead)};
      const payload = sheets ? await signedSheetsPayload(env,destination,envelope,webhook.sheets_key_version) : JSON.stringify(envelope);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const headers = { 'Content-Type': 'application/json', 'X-CRM-Event-ID': job.id, 'X-CRM-Timestamp': timestamp };
      if (env.WEBHOOK_SIGNING_SECRET) headers['X-CRM-Signature'] = `sha256=${await hmac(env.WEBHOOK_SIGNING_SECRET, `${timestamp}.${payload}`)}`;
      // Recheck after DNS/signing work: an erasure may have started meanwhile.
      const renewed=await env.DB.prepare("UPDATE webhook_outbox SET locked_until=? WHERE id=? AND claim_token=? AND status='sending' AND locked_until>? AND EXISTS(SELECT 1 FROM leads WHERE leads.id=webhook_outbox.lead_id AND leads.deleted_at IS NULL) AND EXISTS(SELECT 1 FROM webhooks WHERE webhooks.id=webhook_outbox.webhook_id AND webhooks.enabled=1 AND webhooks.removed_at IS NULL) RETURNING id").bind(Math.floor(Date.now()/1000)+90,job.id,claim,Math.floor(Date.now()/1000)).first();
      if(!renewed){
        await env.DB.prepare("UPDATE webhook_outbox SET status='failed',locked_until=NULL,claim_token=NULL,last_error='Delivery cancelled before dispatch' WHERE id=? AND claim_token=? AND status='sending'").bind(job.id,claim).run();
        continue;
      }
      // Record a possible downstream copy before dispatch, even if its acknowledgement is lost.
      if (sheets) await env.DB.prepare('INSERT INTO sheets_delivery_receipts(webhook_id,lead_id,destination,key_version,created_at) VALUES(?,?,?,MAX(?,COALESCE((SELECT key_version FROM sheets_destination_keys WHERE destination=?),1)),?) ON CONFLICT(webhook_id,lead_id) DO UPDATE SET key_version=MAX(sheets_delivery_receipts.key_version,excluded.key_version)').bind(webhook.id,lead.id,sheetsEndpoint(destination),webhook.sheets_key_version,sheetsEndpoint(destination),job.created_at).run();
      await deliver(destination,headers,payload,job.id);
      await env.DB.prepare("UPDATE webhook_outbox SET status='delivered',delivered_at=?,locked_until=NULL,last_error=NULL WHERE id=? AND claim_token=? AND status='sending'").bind(new Date().toISOString(), job.id, claim).run();
    } catch (error) {
      // No PII, URL query string, response body or exception payload is logged/stored.
      const reason = /^HTTP \d{3}$/.test(error.message || '') ? error.message : 'Delivery failed or destination rejected';
      await env.DB.prepare('UPDATE webhook_outbox SET status=?,next_attempt_at=?,locked_until=NULL,last_error=? WHERE id=? AND claim_token=? AND status=\'sending\'').bind(error instanceof SheetsRejected || job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', Math.floor(Date.now() / 1000) + Math.min(3600, 60 * 2 ** (job.attempts - 1)), reason, job.id, claim).run();
    }
  }
}

// Apps Script alone needs its ContentService redirect followed. No credentials,
// signature header or lead body may be forwarded to the redirected host.
export async function deliver(destination, headers, payload, eventId, fetcher = fetch) {
  const sheets = isAppsScriptEndpoint(destination);
  if (sheets) sheetsEndpoint(destination);
  let response = await fetcher(destination,{method:'POST',headers,body:payload,redirect:'manual',signal:AbortSignal.timeout(10000)});
  if (!sheets) { await response.body?.cancel(); if (!response.ok) throw new Error(`HTTP ${response.status}`); return; }
  if ([302,303].includes(response.status)) {
    const location = response.headers.get('location'); await response.body?.cancel();
    let redirect; try { redirect = new URL(location); } catch { throw new Error('Invalid Sheets redirect'); }
    if (redirect.protocol !== 'https:' || redirect.hostname !== 'script.googleusercontent.com' || !redirect.pathname.startsWith('/macros/') || redirect.username || redirect.password || redirect.port || redirect.hash) throw new Error('Invalid Sheets redirect');
    const checked = await assertPublicDestination(redirect.href,fetcher);
    response = await fetcher(checked,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000)});
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
  return readAppsScriptAck(response,eventId);
}
export async function rotateSheetsKey(env,id,version,actor) {
  if (!Number.isSafeInteger(version) || version < 2) throw new HttpError(400,'Choose a new positive key version.');
  const hook=await env.DB.prepare('SELECT * FROM webhooks WHERE id=? AND removed_at IS NULL').bind(id).first();
  if (!hook || !isAppsScriptEndpoint(hook.url)) throw new HttpError(404,'Google Sheets connection not found.');
  const retained=await env.DB.prepare('SELECT key_version FROM sheets_destination_keys WHERE destination=?').bind(hook.url).first();
  if (version<=Math.max(hook.sheets_key_version,retained?.key_version||1))throw new HttpError(409,'The new key version must increase.');
  await connectionKey(env,hook.url,version);
  const now=Math.floor(Date.now()/1000);
  // Monotonic registry + one atomic batch prevent a concurrent older rotation
  // from downgrading any hook, historical receipt or pending deletion job.
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sheets_destination_keys(destination,key_version) VALUES(?,?) ON CONFLICT(destination) DO UPDATE SET key_version=MAX(sheets_destination_keys.key_version,excluded.key_version)').bind(hook.url,version),
    env.DB.prepare('UPDATE webhooks SET sheets_key_version=(SELECT key_version FROM sheets_destination_keys WHERE destination=?) WHERE url=?').bind(hook.url,hook.url),
    env.DB.prepare('UPDATE sheets_delivery_receipts SET key_version=(SELECT key_version FROM sheets_destination_keys WHERE destination=?) WHERE destination=?').bind(hook.url,hook.url),
    env.DB.prepare("UPDATE sheets_erasure_outbox SET key_version=(SELECT key_version FROM sheets_destination_keys WHERE destination=?),status=CASE WHEN status='failed' THEN 'pending' ELSE status END,attempts=CASE WHEN status='failed' THEN 0 ELSE attempts END,next_attempt_at=? WHERE destination=? AND status<>'delivered'").bind(hook.url,now,hook.url),
    env.DB.prepare("UPDATE webhook_outbox SET status='pending',attempts=0,next_attempt_at=? WHERE status='failed' AND webhook_id IN (SELECT id FROM webhooks WHERE url=? AND removed_at IS NULL AND enabled=1) AND EXISTS(SELECT 1 FROM leads WHERE leads.id=webhook_outbox.lead_id AND deleted_at IS NULL)").bind(now,hook.url),
    auditStatement(env,actor,'sheets-key-rotated',id)
  ]);
  const current=await env.DB.prepare('SELECT key_version FROM sheets_destination_keys WHERE destination=?').bind(hook.url).first();
  return {ok:true,key_version:current.key_version};
}
export async function retrySheetsErasures(env,actor) {
  const result=await env.DB.prepare("UPDATE sheets_erasure_outbox SET status='pending',attempts=0,next_attempt_at=? WHERE id IN (SELECT id FROM sheets_erasure_outbox WHERE status='failed' ORDER BY created_at LIMIT 100) RETURNING id").bind(Math.floor(Date.now()/1000)).all();
  await auditStatement(env,actor,'sheets-erasures-retried','-',{count:result.results.length}).run();
  return {ok:true,requeued:result.results.length};
}
export async function processSheetsErasures(env,limit=5) {
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare("UPDATE sheets_erasure_outbox SET status='failed',claim_token=NULL,locked_until=NULL,last_error='Final delivery lease expired' WHERE status='sending' AND locked_until<? AND attempts>=5").bind(now).run();
  const due=await env.DB.prepare("SELECT id FROM sheets_erasure_outbox WHERE attempts<5 AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<?)) ORDER BY next_attempt_at,id LIMIT ?").bind(now,now,Math.max(1,Math.min(5,limit))).all();
  for (const item of due.results) {
    const claim=crypto.randomUUID(),claimNow=Math.floor(Date.now()/1000);
    const job=await env.DB.prepare("UPDATE sheets_erasure_outbox SET status='sending',attempts=attempts+1,locked_until=?,claim_token=? WHERE id=? AND attempts<5 AND ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<?)) RETURNING *").bind(claimNow+90,claim,item.id,claimNow,claimNow).first();
    if (!job) continue;
    try {
      const destination=await assertPublicDestination(sheetsEndpoint(job.destination));
      const payload=await signedSheetsPayload(env,destination,{event:'lead.erased',event_id:job.id,created_at:job.created_at,lead_id:job.lead_id},job.key_version);
      const dispatchNow=Math.floor(Date.now()/1000);
      const owned=await env.DB.prepare("UPDATE sheets_erasure_outbox SET locked_until=? WHERE id=? AND claim_token=? AND status='sending' AND locked_until>? RETURNING id").bind(dispatchNow+90,job.id,claim,dispatchNow).first();
      if(!owned)continue;
      await deliver(destination,{'Content-Type':'application/json'},payload,job.id);
      await env.DB.batch([
        env.DB.prepare("UPDATE sheets_erasure_outbox SET status='delivered',delivered_at=?,locked_until=NULL,claim_token=NULL,last_error=NULL WHERE id=? AND claim_token=? AND status='sending'").bind(new Date().toISOString(),job.id,claim),
        env.DB.prepare('DELETE FROM sheets_delivery_receipts WHERE webhook_id=? AND lead_id=? AND EXISTS(SELECT 1 FROM sheets_erasure_outbox WHERE id=? AND status=\'delivered\')').bind(job.webhook_id,job.lead_id,job.id)
      ]);
    } catch(error) {
      await env.DB.prepare("UPDATE sheets_erasure_outbox SET status=?,next_attempt_at=?,locked_until=NULL,claim_token=NULL,last_error='Downstream deletion requires retry or connection repair' WHERE id=? AND claim_token=?").bind(error instanceof SheetsRejected || job.attempts>=5?'failed':'pending',Math.floor(Date.now()/1000)+Math.min(3600,60*2**(job.attempts-1)),job.id,claim).run();
    }
  }
}
