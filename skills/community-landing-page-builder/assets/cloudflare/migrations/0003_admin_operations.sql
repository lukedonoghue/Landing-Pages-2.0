-- One named owner per client/site. The initial hash is a Worker secret; rotations
-- store only a salted hash here. A monotonically increasing version revokes old sessions.
CREATE TABLE admin_credentials (
  id INTEGER PRIMARY KEY CHECK(id=1),
  password_hash TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version>0),
  updated_at TEXT NOT NULL
);
ALTER TABLE sessions ADD COLUMN credential_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN username TEXT NOT NULL DEFAULT '';
CREATE TABLE lead_notifications (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE
);
INSERT INTO lead_notifications(lead_id) SELECT id FROM leads WHERE deleted_at IS NULL ORDER BY created_at,id;
CREATE TRIGGER lead_notification_created AFTER INSERT ON leads
BEGIN INSERT INTO lead_notifications(lead_id) VALUES(NEW.id); END;
CREATE TABLE admin_notification_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  seen_sequence INTEGER NOT NULL DEFAULT 0
);
INSERT INTO admin_notification_state(id,seen_sequence) VALUES(1,0);
