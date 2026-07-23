CREATE TABLE insight_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_family VARCHAR(120) NOT NULL,
  version INTEGER NOT NULL,
  rule_versions JSONB NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (insight_family, version)
);

CREATE TABLE knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  node_type VARCHAR(120) NOT NULL,
  node_key VARCHAR(240) NOT NULL,
  label VARCHAR(240) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, node_type, node_key, version)
);

CREATE INDEX knowledge_nodes_user_type_idx
  ON knowledge_nodes(user_id, node_type);

CREATE TABLE knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relationship_type VARCHAR(120) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX knowledge_edges_user_relationship_idx
  ON knowledge_edges(user_id, relationship_type);

CREATE INDEX knowledge_edges_source_idx
  ON knowledge_edges(source_node_id);

CREATE TABLE behavior_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type VARCHAR(120) NOT NULL,
  insight_key VARCHAR(240) NOT NULL,
  category VARCHAR(120) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  supporting_features UUID[] NOT NULL DEFAULT '{}',
  evidence_sessions UUID[] NOT NULL DEFAULT '{}',
  time_window VARCHAR(80) NOT NULL,
  version INTEGER NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX behavior_insights_user_category_idx
  ON behavior_insights(user_id, category, created_at DESC);

CREATE INDEX behavior_insights_key_idx
  ON behavior_insights(insight_key, created_at DESC);

CREATE TABLE behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_key VARCHAR(240) NOT NULL,
  pattern_type VARCHAR(120) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  recurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  trend VARCHAR(64) NOT NULL,
  supporting_insights UUID[] NOT NULL DEFAULT '{}',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX behavior_patterns_user_type_idx
  ON behavior_patterns(user_id, pattern_type, created_at DESC);

CREATE TABLE insight_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES behavior_insights(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES behavior_features(id) ON DELETE SET NULL,
  behavior_session_id UUID REFERENCES behavior_sessions(id) ON DELETE SET NULL,
  evidence_type VARCHAR(120) NOT NULL,
  weight NUMERIC(5, 4) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX insight_evidence_insight_idx
  ON insight_evidence(insight_id);

CREATE TABLE insight_inference_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  run_id UUID NOT NULL,
  insights_generated INTEGER NOT NULL DEFAULT 0,
  rules_fired INTEGER NOT NULL DEFAULT 0,
  inference_latency_ms INTEGER NOT NULL DEFAULT 0,
  confidence_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  graph_nodes INTEGER NOT NULL DEFAULT 0,
  graph_edges INTEGER NOT NULL DEFAULT 0,
  pattern_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(64) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX insight_inference_metrics_user_created_idx
  ON insight_inference_metrics(user_id, created_at DESC);
