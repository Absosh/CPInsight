CREATE TABLE planner_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id VARCHAR(160) NOT NULL,
  version INTEGER NOT NULL,
  supported_intents TEXT[] NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rule_id, version)
);

CREATE TABLE intent_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  question_hash CHAR(64) NOT NULL,
  primary_intent VARCHAR(120) NOT NULL,
  secondary_intents TEXT[] NOT NULL DEFAULT '{}',
  confidence NUMERIC(5, 4) NOT NULL,
  ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
  classified_intents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX intent_classifications_user_created_idx
  ON intent_classifications(user_id, created_at DESC);

CREATE INDEX intent_classifications_question_hash_idx
  ON intent_classifications(question_hash);

CREATE TABLE retrieval_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL UNIQUE,
  question_hash CHAR(64) NOT NULL,
  primary_intent VARCHAR(120) NOT NULL,
  secondary_intents TEXT[] NOT NULL DEFAULT '{}',
  selected_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_strategies JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_budget JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_context_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_latency_ms INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  execution_priority JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX retrieval_plans_user_created_idx
  ON retrieval_plans(user_id, created_at DESC);

CREATE INDEX retrieval_plans_intent_idx
  ON retrieval_plans(primary_intent, created_at DESC);

CREATE TABLE planner_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  question_hash CHAR(64),
  planner_latency_ms INTEGER NOT NULL DEFAULT 0,
  primary_intent VARCHAR(120),
  intent_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_source_count INTEGER NOT NULL DEFAULT 0,
  source_selection_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  average_retrieval_cost_estimate NUMERIC(10, 4) NOT NULL DEFAULT 0,
  average_confidence_estimate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  planning_failure BOOLEAN NOT NULL DEFAULT FALSE,
  unknown_intent BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX planner_metrics_created_idx
  ON planner_metrics(created_at DESC);

