CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  event_type VARCHAR(160) NOT NULL,
  event_version INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  aggregate_type VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(240) NOT NULL,
  source VARCHAR(160) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  causation_id UUID,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX domain_events_aggregate_order_idx
  ON domain_events(aggregate_type, aggregate_id, occurred_at, event_id);

CREATE INDEX domain_events_type_published_idx
  ON domain_events(event_type, published_at DESC);

CREATE INDEX domain_events_correlation_idx
  ON domain_events(correlation_id);

CREATE TABLE domain_event_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  aggregate_type VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(240) NOT NULL,
  subscriber_id VARCHAR(160) NOT NULL,
  action VARCHAR(120) NOT NULL,
  status VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX domain_event_audit_event_idx
  ON domain_event_audit_log(event_id);

CREATE INDEX domain_event_audit_aggregate_idx
  ON domain_event_audit_log(aggregate_type, aggregate_id, created_at DESC);

CREATE UNIQUE INDEX domain_event_audit_once_idx
  ON domain_event_audit_log(event_id, subscriber_id, action);

CREATE TABLE domain_event_subscriber_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  subscriber_id VARCHAR(160) NOT NULL,
  aggregate_type VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(240) NOT NULL,
  error_code VARCHAR(160) NOT NULL,
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX domain_event_failures_subscriber_idx
  ON domain_event_subscriber_failures(subscriber_id, created_at DESC);

CREATE INDEX domain_event_failures_event_idx
  ON domain_event_subscriber_failures(event_id);

CREATE TABLE domain_event_dispatch_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  aggregate_type VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(240) NOT NULL,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  dispatch_latency_ms INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX domain_event_dispatch_metrics_recorded_idx
  ON domain_event_dispatch_metrics(recorded_at DESC);

CREATE INDEX domain_event_dispatch_metrics_aggregate_idx
  ON domain_event_dispatch_metrics(aggregate_type, aggregate_id, recorded_at DESC);

CREATE UNIQUE INDEX domain_event_dispatch_metrics_once_idx
  ON domain_event_dispatch_metrics(event_id);
