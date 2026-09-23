PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  reporting_day TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','qualified','engaged','follow_up','won','lost')),
  version INTEGER NOT NULL DEFAULT 1, form_name TEXT NOT NULL, form_data TEXT NOT NULL, attribution TEXT NOT NULL,
  landing_page TEXT NOT NULL, referrer TEXT NOT NULL DEFAULT '', visitor_hash TEXT, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status ON leads(status,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_reporting ON leads(reporting_day,visitor_hash);
CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS notes_lead ON notes(lead_id,created_at);
CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), event_type TEXT NOT NULL, from_status TEXT, to_status TEXT, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS activity_lead ON activity(lead_id,created_at);
CREATE TRIGGER IF NOT EXISTS lead_status_activity AFTER UPDATE OF status ON leads WHEN NEW.status <> OLD.status
BEGIN
  INSERT INTO activity(id,lead_id,event_type,from_status,to_status,description,created_at)
  VALUES(lower(hex(randomblob(16))),NEW.id,'status_changed',OLD.status,NEW.status,'Stage changed',NEW.updated_at);
END;
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 1,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rates_expiry ON rate_limits(expires_at);
-- No raw IP, contact information or persistent visitor identifier in analytics.
CREATE TABLE IF NOT EXISTS visits (reporting_day TEXT NOT NULL,path TEXT NOT NULL,visitor_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(reporting_day,path,visitor_hash));
CREATE TABLE IF NOT EXISTS webhooks (id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id TEXT PRIMARY KEY,webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,lead_id TEXT NOT NULL REFERENCES leads(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL,locked_until INTEGER,claim_token TEXT,
  created_at TEXT NOT NULL,delivered_at TEXT,last_error TEXT,UNIQUE(webhook_id,lead_id)
);
CREATE INDEX IF NOT EXISTS outbox_due ON webhook_outbox(status,next_attempt_at);
