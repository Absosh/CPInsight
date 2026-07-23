CREATE TABLE retrieval_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(320) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_name VARCHAR(160) NOT NULL,
  source_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX retrieval_cache_user_source_idx
  ON retrieval_cache(user_id, source_name);

CREATE INDEX retrieval_cache_expires_idx
  ON retrieval_cache(expires_at);

CREATE TABLE evidence_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  package_id UUID NOT NULL UNIQUE,
  plan_id UUID,
  question_hash CHAR(64),
  retrieval_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  retrieved_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ignored_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  retrieval_statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX evidence_packages_user_created_idx
  ON evidence_packages(user_id, created_at DESC);

CREATE INDEX evidence_packages_question_hash_idx
  ON evidence_packages(question_hash);

CREATE TABLE retrieval_execution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  package_id UUID,
  plan_id UUID,
  retrieval_latency_ms INTEGER NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  contradiction_count INTEGER NOT NULL DEFAULT 0,
  missing_evidence_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  source_failure_count INTEGER NOT NULL DEFAULT 0,
  partial_failure BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(64) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX retrieval_execution_metrics_created_idx
  ON retrieval_execution_metrics(created_at DESC);

CREATE TABLE retrieval_source_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  package_id UUID,
  source_name VARCHAR(160) NOT NULL,
  status VARCHAR(64) NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX retrieval_source_metrics_source_created_idx
  ON retrieval_source_metrics(source_name, created_at DESC);

CREATE TABLE fusion_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  package_id UUID,
  fusion_latency_ms INTEGER NOT NULL DEFAULT 0,
  raw_evidence_count INTEGER NOT NULL DEFAULT 0,
  normalized_evidence_count INTEGER NOT NULL DEFAULT 0,
  ranked_evidence_count INTEGER NOT NULL DEFAULT 0,
  resolved_evidence_count INTEGER NOT NULL DEFAULT 0,
  contradiction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX fusion_metrics_created_idx
  ON fusion_metrics(created_at DESC);

