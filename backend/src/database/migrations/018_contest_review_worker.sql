ALTER TABLE contest_review_jobs
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_stage TEXT,
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_id UUID,
  ADD COLUMN IF NOT EXISTS retry_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_timings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS contest_review_jobs_live_session_unique_idx
  ON contest_review_jobs(live_session_id);

CREATE INDEX IF NOT EXISTS contest_review_jobs_claim_idx
  ON contest_review_jobs(status, next_attempt_at, requested_at);

CREATE INDEX IF NOT EXISTS contest_review_jobs_lease_idx
  ON contest_review_jobs(status, lease_expires_at);

CREATE TABLE IF NOT EXISTS contest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL UNIQUE REFERENCES telemetry_live_sessions(live_session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contest_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  validated_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_package JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  roadmap JSONB NOT NULL DEFAULT '{}'::jsonb,
  reflections JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contest_reviews_user_created_idx
  ON contest_reviews(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contest_reviews_contest_idx
  ON contest_reviews(user_id, platform, contest_id);

CREATE TABLE IF NOT EXISTS contest_review_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES contest_review_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contest_review_execution_logs_job_idx
  ON contest_review_execution_logs(job_id, created_at);

CREATE TABLE IF NOT EXISTS contest_review_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES contest_review_jobs(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES telemetry_live_sessions(live_session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  failure_reason TEXT NOT NULL,
  stack_trace TEXT,
  retry_count INTEGER NOT NULL,
  last_stage TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contest_review_dead_letters_user_idx
  ON contest_review_dead_letters(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contest_review_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  worker_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contest_review_metrics_name_time_idx
  ON contest_review_metrics(metric_name, created_at DESC);

CREATE TABLE IF NOT EXISTS contest_roadmap_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES telemetry_live_sessions(live_session_id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES contest_reviews(id) ON DELETE CASCADE,
  roadmap JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation_tracking JSONB NOT NULL DEFAULT '[]'::jsonb,
  behavior_evolution JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contest_roadmap_updates_user_time_idx
  ON contest_roadmap_updates(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS contest_roadmap_updates_review_unique_idx
  ON contest_roadmap_updates(review_id);
