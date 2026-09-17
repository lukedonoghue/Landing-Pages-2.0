-- No automatic deletion is enabled by this migration.
CREATE TABLE data_retention_policy (
  id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 1,
  dataset_id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  lead_scope TEXT NOT NULL DEFAULT 'removed' CHECK(lead_scope IN ('removed','all')),
  leads_days INTEGER, notes_days INTEGER, attribution_days INTEGER,
  visits_days INTEGER, delivery_history_days INTEGER,
  updated_at TEXT NOT NULL DEFAULT '', next_kind INTEGER NOT NULL DEFAULT 0
);
INSERT INTO data_retention_policy(id) VALUES(1);
CREATE TABLE erasure_operations (
  id TEXT PRIMARY KEY, scope_hash TEXT NOT NULL,
  origin TEXT NOT NULL CHECK(origin IN ('manual','retention','restore')),
  status TEXT NOT NULL CHECK(status IN ('preparing','waiting','complete')),
  created_at TEXT NOT NULL, completed_at TEXT,
  counts TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX erasure_pending ON erasure_operations(status,created_at);
-- Pending identifiers are removed with the contact. Completed operations retain
-- counts and an opaque scope digest, never names, answers or attribution.
CREATE TABLE erasure_items (
  lead_id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES erasure_operations(id)
);
CREATE INDEX erasure_items_operation ON erasure_items(operation_id);
-- Opaque suppression records prevent old submission keys or restored backups
-- from recreating erased enquiries. They do not contain contact/payload hashes.
CREATE TABLE erased_submissions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE, lead_id TEXT NOT NULL UNIQUE, erased_at TEXT NOT NULL
);
CREATE INDEX retention_removed_leads ON leads(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX retention_notes ON notes(created_at);
CREATE INDEX retention_activity ON activity(created_at);
CREATE INDEX retention_visits ON visit_events(created_at);
CREATE INDEX retention_delivery_history ON webhook_outbox(status,created_at);

ALTER TABLE webhooks ADD COLUMN removed_at TEXT;
CREATE INDEX outbox_lead_lease ON webhook_outbox(lead_id,locked_until);
