CREATE TABLE llm_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(160) NOT NULL UNIQUE,
  status VARCHAR(80) NOT NULL,
  supports_streaming BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(240) NOT NULL,
  provider_name VARCHAR(160) NOT NULL,
  context_window INTEGER NOT NULL,
  supports_streaming BOOLEAN NOT NULL,
  supports_json BOOLEAN NOT NULL,
  supports_tools BOOLEAN NOT NULL,
  supports_vision BOOLEAN NOT NULL,
  max_output_tokens INTEGER NOT NULL,
  pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_name, model_name)
);

CREATE TABLE llm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  runtime_request_id UUID NOT NULL UNIQUE,
  execution_plan_id UUID,
  prompt_package_id UUID,
  provider_name VARCHAR(160) NOT NULL,
  model_name VARCHAR(240) NOT NULL,
  request_mode VARCHAR(40) NOT NULL,
  status VARCHAR(80) NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  fallbacks INTEGER NOT NULL DEFAULT 0,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX llm_requests_user_created_idx
  ON llm_requests(user_id, created_at DESC);

CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  runtime_request_id UUID,
  provider_name VARCHAR(160) NOT NULL,
  model_name VARCHAR(240) NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  budget_usage NUMERIC(10, 6) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX llm_usage_user_created_idx
  ON llm_usage(user_id, created_at DESC);

CREATE TABLE provider_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(160) NOT NULL,
  model_name VARCHAR(240),
  latency_ms INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  fallbacks INTEGER NOT NULL DEFAULT 0,
  circuit_open BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX provider_metrics_provider_created_idx
  ON provider_metrics(provider_name, created_at DESC);

CREATE TABLE runtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  runtime_request_id UUID,
  request_latency_ms INTEGER NOT NULL DEFAULT 0,
  streaming_latency_ms INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  fallback_count INTEGER NOT NULL DEFAULT 0,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancellation_count INTEGER NOT NULL DEFAULT 0,
  queue_length INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(80) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX runtime_metrics_created_idx
  ON runtime_metrics(created_at DESC);

