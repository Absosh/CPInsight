CREATE TABLE telemetry_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL UNIQUE,
  telemetry_session_id VARCHAR(180) NOT NULL UNIQUE,
  platform VARCHAR(80) NOT NULL,
  contest_id VARCHAR(180) NOT NULL,
  contest_name VARCHAR(500),
  contest_url TEXT NOT NULL,
  user_handle VARCHAR(180),
  state VARCHAR(80) NOT NULL DEFAULT 'preparing',
  session_token_hash CHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  connection_status VARCHAR(80) NOT NULL DEFAULT 'connected',
  events_received INTEGER NOT NULL DEFAULT 0,
  events_acknowledged INTEGER NOT NULL DEFAULT 0,
  statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telemetry_live_sessions_user_idx
  ON telemetry_live_sessions(user_id, started_at DESC);

CREATE INDEX telemetry_live_sessions_state_idx
  ON telemetry_live_sessions(state, last_heartbeat_at DESC);

CREATE TABLE telemetry_live_heartbeat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES telemetry_live_sessions(live_session_id) ON DELETE CASCADE,
  connection_status VARCHAR(80) NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  queue_depth INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telemetry_live_heartbeat_logs_session_idx
  ON telemetry_live_heartbeat_logs(live_session_id, created_at DESC);

CREATE TABLE telemetry_live_event_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES telemetry_live_sessions(live_session_id) ON DELETE CASCADE,
  event_id UUID NOT NULL UNIQUE,
  event_type VARCHAR(120) NOT NULL,
  sequence_number INTEGER NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX telemetry_live_event_receipts_session_sequence_idx
  ON telemetry_live_event_receipts(live_session_id, sequence_number);

CREATE TABLE contest_monitoring_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES telemetry_live_sessions(live_session_id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metric_name VARCHAR(160) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contest_monitoring_metrics_session_idx
  ON contest_monitoring_metrics(live_session_id, created_at DESC);

CREATE TABLE contest_review_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES telemetry_live_sessions(live_session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(80) NOT NULL DEFAULT 'queued',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX contest_review_jobs_session_idx
  ON contest_review_jobs(live_session_id, requested_at DESC);
