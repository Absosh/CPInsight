CREATE TABLE ontology_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_version INTEGER NOT NULL UNIQUE,
  concepts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(160) NOT NULL,
  template_version INTEGER NOT NULL,
  template JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_key, template_version)
);

CREATE TABLE reasoning_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  context_id UUID NOT NULL UNIQUE,
  evidence_package_id UUID,
  plan_id UUID,
  question_hash CHAR(64),
  context_version INTEGER NOT NULL,
  ontology_version INTEGER NOT NULL,
  primary_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  secondary_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  causal_chains JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
  token_budget JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  context_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reasoning_contexts_user_created_idx
  ON reasoning_contexts(user_id, created_at DESC);

CREATE TABLE prompt_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prompt_package_id UUID NOT NULL UNIQUE,
  reasoning_context_id UUID,
  prompt_package_version INTEGER NOT NULL,
  provider_independent BOOLEAN NOT NULL DEFAULT TRUE,
  system_prompt TEXT NOT NULL,
  developer_instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_block JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  grounding_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  citation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX prompt_packages_user_created_idx
  ON prompt_packages(user_id, created_at DESC);

CREATE TABLE reasoning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  context_id UUID,
  reasoning_latency_ms INTEGER NOT NULL DEFAULT 0,
  average_findings NUMERIC(10, 4) NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  ontology_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_reductions INTEGER NOT NULL DEFAULT 0,
  context_size_tokens INTEGER NOT NULL DEFAULT 0,
  prompt_size_tokens INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
  status VARCHAR(64) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reasoning_metrics_created_idx
  ON reasoning_metrics(created_at DESC);

CREATE TABLE compression_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  context_id UUID,
  original_evidence_count INTEGER NOT NULL DEFAULT 0,
  used_evidence_count INTEGER NOT NULL DEFAULT 0,
  discarded_evidence_count INTEGER NOT NULL DEFAULT 0,
  compression_ratio NUMERIC(8, 4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX compression_metrics_created_idx
  ON compression_metrics(created_at DESC);

