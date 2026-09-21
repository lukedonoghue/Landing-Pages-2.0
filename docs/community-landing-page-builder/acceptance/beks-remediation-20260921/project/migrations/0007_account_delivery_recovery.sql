ALTER TABLE crm_account_actions ADD COLUMN reset_request_id TEXT;
ALTER TABLE crm_reset_requests ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'idle' CHECK(delivery_state IN ('idle','sending','failed','sent'));
ALTER TABLE crm_reset_requests ADD COLUMN claim_token TEXT;
ALTER TABLE crm_reset_requests ADD COLUMN claim_expires_at INTEGER;
ALTER TABLE crm_reset_requests ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX crm_one_live_reset_action ON crm_account_actions(reset_request_id) WHERE reset_request_id IS NOT NULL AND state IN ('sending','ready');
