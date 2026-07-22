CREATE TABLE processed_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_event_row_id UUID REFERENCES telemetry_events(id) ON DELETE SET NULL,
  event_id UUID NOT NULL UNIQUE,
  batch_id UUID NOT NULL,
  request_id UUID NOT NULL,
  sequence_number BIGINT NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  classification VARCHAR(120) NOT NULL,
  normalized_timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL,
  processing_latency_ms INTEGER NOT NULL,
  sdk_version VARCHAR(120) NOT NULL,
  schema_version INTEGER NOT NULL,
  collector_version VARCHAR(160) NOT NULL,
  platform VARCHAR(80) NOT NULL,
  processing_metadata JSONB NOT NULL,
  classification_metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX processed_telemetry_events_user_sequence_idx
  ON processed_telemetry_events(user_id, sequence_number);

CREATE INDEX processed_telemetry_events_user_type_idx
  ON processed_telemetry_events(user_id, event_type);

CREATE INDEX processed_telemetry_events_batch_idx
  ON processed_telemetry_events(batch_id);

CREATE INDEX processed_telemetry_events_classification_idx
  ON processed_telemetry_events(classification);

CREATE TABLE telemetry_pipeline_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  batch_id UUID,
  request_id UUID,
  status VARCHAR(32) NOT NULL,
  events_received INTEGER NOT NULL DEFAULT 0,
  events_processed INTEGER NOT NULL DEFAULT 0,
  duplicates_removed INTEGER NOT NULL DEFAULT 0,
  validation_failures INTEGER NOT NULL DEFAULT 0,
  processing_errors INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  queue_depth INTEGER NOT NULL DEFAULT 0,
  pipeline_throughput INTEGER NOT NULL DEFAULT 0,
  average_processing_latency_ms INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(120),
  error_message TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telemetry_pipeline_metrics_user_recorded_idx
  ON telemetry_pipeline_metrics(user_id, recorded_at DESC);

CREATE INDEX telemetry_pipeline_metrics_batch_idx
  ON telemetry_pipeline_metrics(batch_id);

CREATE TABLE telemetry_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  batch_id UUID,
  event_id UUID,
  sequence_number BIGINT,
  failure_category VARCHAR(120) NOT NULL,
  failure_code VARCHAR(120) NOT NULL,
  failure_message TEXT NOT NULL,
  transient BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telemetry_dead_letters_user_created_idx
  ON telemetry_dead_letters(user_id, created_at DESC);

CREATE INDEX telemetry_dead_letters_batch_idx
  ON telemetry_dead_letters(batch_id);

CREATE TRIGGER processed_telemetry_events_updated_at
  BEFORE UPDATE ON processed_telemetry_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
