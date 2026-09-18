-- A changed owner identity must survive deployments with the bootstrap secret.
-- NULL preserves the original named-owner configuration for existing sites.
ALTER TABLE admin_credentials ADD COLUMN username TEXT;
-- Identifies a completed owner-recovery operation after a lost CLI response.
ALTER TABLE admin_credentials ADD COLUMN recovery_id TEXT;
