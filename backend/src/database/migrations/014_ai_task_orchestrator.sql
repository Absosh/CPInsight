CREATE TABLE ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(160) NOT NULL,
  task_version INTEGER NOT NULL,
  reasoning_mode VARCHAR(120) NOT NULL,
  schema_name VARCHAR(120) NOT NULL,
  strategy_name VARCHAR(160) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_type, task_version)
);

CREATE TABLE prompt_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id VARCHAR(160) NOT NULL,
  strategy_version INTEGER NOT NULL,
  supported_tasks TEXT[] NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (strategy_id, strategy_version)
);

CREATE TABLE output_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name VARCHAR(160) NOT NULL,
  schema_version INTEGER NOT NULL,
  schema_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schema_name, schema_version)
);

CREATE TABLE evaluation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(160) NOT NULL,
  policy_version INTEGER NOT NULL,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_name, policy_version)
);

CREATE TABLE safety_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(160) NOT NULL,
  policy_version INTEGER NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_name, policy_version)
);

CREATE TABLE execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  execution_plan_id UUID NOT NULL UNIQUE,
  execution_plan_version INTEGER NOT NULL,
  question_hash CHAR(64),
  reasoning_context_id UUID,
  prompt_package_id UUID,
  primary_task VARCHAR(160) NOT NULL,
  task_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_strategies JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_schemas JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX execution_plans_user_created_idx
  ON execution_plans(user_id, created_at DESC);

CREATE INDEX execution_plans_primary_task_idx
  ON execution_plans(primary_task, created_at DESC);

CREATE TABLE execution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  execution_plan_id UUID,
  primary_task VARCHAR(160),
  strategy_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning_mode_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_routing_latency_ms INTEGER NOT NULL DEFAULT 0,
  execution_plan_latency_ms INTEGER NOT NULL DEFAULT 0,
  unknown_task BOOLEAN NOT NULL DEFAULT FALSE,
  policy_violation_count INTEGER NOT NULL DEFAULT 0,
  average_complexity NUMERIC(5, 4) NOT NULL DEFAULT 0,
  status VARCHAR(64) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX execution_metrics_created_idx
  ON execution_metrics(created_at DESC);

