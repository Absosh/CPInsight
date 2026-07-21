CREATE TABLE leetcode_extension_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  session_id VARCHAR(180) NOT NULL UNIQUE,
  payload_hash VARCHAR(120) NOT NULL,
  collector_version VARCHAR(120) NOT NULL,
  provider_version VARCHAR(80),
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX leetcode_extension_uploads_user_id_idx ON leetcode_extension_uploads(user_id);
CREATE INDEX leetcode_extension_uploads_account_id_idx ON leetcode_extension_uploads(platform_account_id);

CREATE TRIGGER leetcode_extension_uploads_updated_at
  BEFORE UPDATE ON leetcode_extension_uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
