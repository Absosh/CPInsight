CREATE TABLE domain_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_sequence BIGSERIAL NOT NULL UNIQUE,
  event_id UUID NOT NULL UNIQUE,
  aggregate_type VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(240) NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  event_version INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  original_published_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(160) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  causation_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  retry_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  relay_owner VARCHAR(240),
  lease_expiration TIMESTAMPTZ,
  publication_token UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT domain_event_outbox_status_check CHECK (
    status IN ('pending', 'publishing', 'published', 'failed', 'dead_letter')
  )
);

CREATE INDEX domain_event_outbox_status_created_idx
  ON domain_event_outbox(status, outbox_sequence);

CREATE INDEX domain_event_outbox_due_idx
  ON domain_event_outbox(status, next_attempt_at, outbox_sequence)
  WHERE status IN ('pending', 'failed');

CREATE INDEX domain_event_outbox_aggregate_order_idx
  ON domain_event_outbox(aggregate_type, aggregate_id, outbox_sequence);

CREATE INDEX domain_event_outbox_event_type_idx
  ON domain_event_outbox(event_type, created_at DESC);

CREATE INDEX domain_event_outbox_retry_idx
  ON domain_event_outbox(retry_count, status);

CREATE INDEX domain_event_outbox_lease_idx
  ON domain_event_outbox(status, lease_expiration)
  WHERE status = 'publishing';

CREATE TABLE domain_event_replay_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID NOT NULL REFERENCES domain_event_outbox(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  status VARCHAR(64) NOT NULL,
  replayed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX domain_event_replay_log_event_idx
  ON domain_event_replay_log(event_id, replayed_at DESC);

CREATE INDEX domain_event_replay_log_requested_idx
  ON domain_event_replay_log(requested_by, replayed_at DESC);

CREATE TRIGGER domain_event_outbox_updated_at
  BEFORE UPDATE ON domain_event_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
