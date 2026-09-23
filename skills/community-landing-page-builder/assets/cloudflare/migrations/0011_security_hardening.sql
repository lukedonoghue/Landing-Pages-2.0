-- 0009/0010 are reserved for the separately reviewed identity-attribution example.
-- Reauthentication is required after deploying this migration, including legacy cookies.
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER;
DELETE FROM sessions;
ALTER TABLE crm_access_audit ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
CREATE INDEX crm_access_audit_time ON crm_access_audit(created_at DESC,id);
-- Invalidate previously minted privileged manual links as well as preventing new ones.
UPDATE crm_account_actions SET state='failed' WHERE purpose='reset' AND used_at IS NULL;
-- Downstream deletion jobs must survive removal of the source lead and connection.
-- They contain only an opaque lead ID, never a contact, answer or credential.
CREATE TABLE sheets_erasure_outbox (
  id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL, destination TEXT NOT NULL,
  lead_id TEXT NOT NULL, operation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL,
  locked_until INTEGER, claim_token TEXT, created_at TEXT NOT NULL,
  delivered_at TEXT, last_error TEXT, UNIQUE(webhook_id,lead_id)
);
CREATE INDEX sheets_erasure_due ON sheets_erasure_outbox(status,next_attempt_at);

ALTER TABLE webhooks ADD COLUMN sheets_key_version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE sheets_delivery_receipts (
  webhook_id TEXT NOT NULL, lead_id TEXT NOT NULL, destination TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
  PRIMARY KEY(webhook_id,lead_id)
);
ALTER TABLE sheets_erasure_outbox ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1;
-- Preserve possible historical copies without persisting the legacy query token.
INSERT OR IGNORE INTO sheets_delivery_receipts(webhook_id,lead_id,destination,created_at)
SELECT w.id,o.lead_id,CASE WHEN instr(w.url,'?')>0 THEN substr(w.url,1,instr(w.url,'?')-1) ELSE w.url END,o.created_at
FROM webhook_outbox o JOIN webhooks w ON w.id=o.webhook_id
WHERE o.attempts>0 AND w.url LIKE 'https://script.google.com/macros/s/%/exec%';
-- Legacy token-based scripts need an operator upgrade before sending any more personal data.
UPDATE webhooks SET enabled=0,url=substr(url,1,instr(url,'?')-1)
WHERE url LIKE 'https://script.google.com/macros/s/%/exec?%';

CREATE TABLE sheets_destination_keys (destination TEXT PRIMARY KEY, key_version INTEGER NOT NULL CHECK(key_version>0));
INSERT INTO sheets_destination_keys(destination,key_version)
SELECT destination,MAX(key_version) FROM (
 SELECT url AS destination,sheets_key_version AS key_version FROM webhooks WHERE url LIKE 'https://script.google.com/macros/s/%/exec'
 UNION ALL SELECT destination,key_version FROM sheets_delivery_receipts
) GROUP BY destination;
