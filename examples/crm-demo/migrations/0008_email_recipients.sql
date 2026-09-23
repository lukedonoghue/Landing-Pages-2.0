CREATE TABLE crm_email_recipients (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  provider_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('requesting','pending','verified','unknown')),
  provider_verified_at TEXT,
  requested_by TEXT NOT NULL,
  pending_username TEXT COLLATE NOCASE,
  pending_role TEXT CHECK(pending_role IN ('admin','manager','viewer')),
  pending_requested_by TEXT,
  pending_requested_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  checked_at TEXT
);
CREATE INDEX crm_email_recipients_status ON crm_email_recipients(status,updated_at);
CREATE UNIQUE INDEX crm_email_recipients_pending_username ON crm_email_recipients(pending_username) WHERE pending_username IS NOT NULL;
