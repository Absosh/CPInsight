CREATE TABLE telemetry_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  sequence_number BIGINT NOT NULL,
  sdk_version VARCHAR(120) NOT NULL,
  schema_version INTEGER NOT NULL,
  collector_version VARCHAR(160) NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'accepted',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, batch_id)
);

CREATE INDEX telemetry_batches_user_sequence_idx ON telemetry_batches(user_id, sequence_number);
CREATE INDEX telemetry_batches_received_at_idx ON telemetry_batches(received_at DESC);

CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_row_id UUID REFERENCES telemetry_batches(id) ON DELETE SET NULL,
  event_id UUID NOT NULL UNIQUE,
  session_id VARCHAR(180) NOT NULL,
  platform VARCHAR(80) NOT NULL,
  contest_id VARCHAR(180) NOT NULL,
  contest_name TEXT,
  problem_id VARCHAR(255),
  event_type VARCHAR(120) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  page_url TEXT NOT NULL,
  sequence_number BIGINT NOT NULL,
  schema_version INTEGER NOT NULL,
  sdk_version VARCHAR(120) NOT NULL,
  collector_version VARCHAR(160) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingestion_status VARCHAR(32) NOT NULL DEFAULT 'accepted',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telemetry_events_user_sequence_idx ON telemetry_events(user_id, sequence_number);
CREATE INDEX telemetry_events_user_session_idx ON telemetry_events(user_id, session_id);
CREATE INDEX telemetry_events_platform_contest_idx ON telemetry_events(platform, contest_id);
CREATE INDEX telemetry_events_received_at_idx ON telemetry_events(received_at DESC);
CREATE INDEX telemetry_events_payload_gin_idx ON telemetry_events USING GIN(payload);

CREATE TABLE upload_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  status VARCHAR(32) NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  acknowledged_count INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(120),
  error_message TEXT,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX upload_attempts_user_batch_idx ON upload_attempts(user_id, batch_id);
CREATE INDEX upload_attempts_attempted_at_idx ON upload_attempts(attempted_at DESC);

CREATE TABLE event_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  batch_id UUID,
  event_id UUID,
  sequence_number BIGINT,
  failure_code VARCHAR(120) NOT NULL,
  failure_message TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX event_failures_user_created_idx ON event_failures(user_id, created_at DESC);
CREATE INDEX event_failures_batch_idx ON event_failures(batch_id);

CREATE TRIGGER telemetry_batches_updated_at
  BEFORE UPDATE ON telemetry_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER telemetry_events_updated_at
  BEFORE UPDATE ON telemetry_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
