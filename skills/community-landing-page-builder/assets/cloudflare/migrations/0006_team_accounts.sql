ALTER TABLE sessions ADD COLUMN user_id TEXT;
CREATE TABLE crm_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('admin','manager','viewer')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','disabled')),
  password_hash TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE crm_owner_profile (
  id INTEGER PRIMARY KEY CHECK(id=1),
  email TEXT,
  pending_email TEXT,
  email_verified_at TEXT,
  version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO crm_owner_profile(id) VALUES(1);
CREATE TABLE crm_account_actions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('invite','reset','verify-email')),
  expected_version INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'sending' CHECK(state IN ('sending','ready','failed')),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT,
  consume_id TEXT,
  approved_by TEXT NOT NULL
);
CREATE TABLE crm_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT
);
CREATE UNIQUE INDEX crm_one_pending_reset ON crm_reset_requests(user_id) WHERE status='pending';
CREATE TABLE crm_access_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
