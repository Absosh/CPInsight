CREATE TABLE validated_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  validation_id UUID NOT NULL UNIQUE,
  execution_plan_id UUID,
  reasoning_context_id UUID,
  evidence_package_id UUID,
  validated_response JSONB NOT NULL,
  validation_report JSONB NOT NULL,
  quality_report JSONB NOT NULL,
  response_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX validated_responses_user_created_idx
  ON validated_responses(user_id, created_at DESC);

CREATE TABLE response_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  validation_id UUID NOT NULL,
  grounding_coverage NUMERIC(5, 4) NOT NULL DEFAULT 0,
  citation_quality NUMERIC(5, 4) NOT NULL DEFAULT 0,
  recommendation_support NUMERIC(5, 4) NOT NULL DEFAULT 0,
  actionability NUMERIC(5, 4) NOT NULL DEFAULT 0,
  readability NUMERIC(5, 4) NOT NULL DEFAULT 0,
  completeness NUMERIC(5, 4) NOT NULL DEFAULT 0,
  conciseness NUMERIC(5, 4) NOT NULL DEFAULT 0,
  contradiction_count INTEGER NOT NULL DEFAULT 0,
  overall_quality_score NUMERIC(5, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX response_quality_validation_idx
  ON response_quality(validation_id);

CREATE TABLE reflection_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_type VARCHAR(160) NOT NULL,
  version INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reflection_type, version)
);

CREATE TABLE reflection_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reflection_id UUID NOT NULL UNIQUE,
  validation_id UUID,
  reflection_type VARCHAR(160) NOT NULL,
  behavior_finding VARCHAR(240) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  importance NUMERIC(5, 4) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reflection_memory_user_created_idx
  ON reflection_memory(user_id, created_at DESC);

CREATE TABLE reflection_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id UUID NOT NULL,
  evidence_id VARCHAR(240) NOT NULL,
  link_type VARCHAR(120) NOT NULL DEFAULT 'supporting_evidence',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reflection_links_reflection_idx
  ON reflection_links(reflection_id);

CREATE TABLE human_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  response_id UUID,
  feedback_type VARCHAR(80) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX human_feedback_user_created_idx
  ON human_feedback(user_id, created_at DESC);

CREATE TABLE feedback_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_type VARCHAR(80) NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE validation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  validation_id UUID,
  validation_latency_ms INTEGER NOT NULL DEFAULT 0,
  grounding_failures INTEGER NOT NULL DEFAULT 0,
  citation_failures INTEGER NOT NULL DEFAULT 0,
  confidence_mismatch NUMERIC(5, 4) NOT NULL DEFAULT 0,
  recommendation_rejections INTEGER NOT NULL DEFAULT 0,
  reflection_count INTEGER NOT NULL DEFAULT 0,
  regeneration_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(80) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX validation_metrics_created_idx
  ON validation_metrics(created_at DESC);

