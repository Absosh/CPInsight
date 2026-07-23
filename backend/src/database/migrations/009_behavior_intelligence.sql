CREATE TABLE feature_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_family VARCHAR(120) NOT NULL,
  version INTEGER NOT NULL,
  description TEXT NOT NULL,
  extractor_versions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_family, version)
);

CREATE TABLE behavior_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_session_id VARCHAR(180) NOT NULL,
  session_type VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  platform VARCHAR(80) NOT NULL,
  contest_id VARCHAR(180),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  problem_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  focus_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  navigation_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  reconstruction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reconstruction_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_session_id, reconstruction_version)
);

CREATE INDEX behavior_sessions_user_started_idx
  ON behavior_sessions(user_id, started_at DESC);

CREATE INDEX behavior_sessions_platform_contest_idx
  ON behavior_sessions(platform, contest_id);

CREATE TABLE behavior_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  behavior_session_id UUID REFERENCES behavior_sessions(id) ON DELETE SET NULL,
  source_session_id VARCHAR(180),
  feature_name VARCHAR(160) NOT NULL,
  feature_group VARCHAR(120) NOT NULL,
  value JSONB NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  window_key VARCHAR(80) NOT NULL,
  platform VARCHAR(80),
  contest_id VARCHAR(180),
  feature_version INTEGER NOT NULL,
  extractor_id VARCHAR(160) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX behavior_features_user_window_idx
  ON behavior_features(user_id, window_key, created_at DESC);

CREATE INDEX behavior_features_name_idx
  ON behavior_features(feature_name, created_at DESC);

CREATE INDEX behavior_features_session_idx
  ON behavior_features(behavior_session_id);

CREATE TABLE behavior_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_window VARCHAR(80) NOT NULL,
  platform VARCHAR(80),
  profile_version INTEGER NOT NULL,
  reading_style JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_style JSONB NOT NULL DEFAULT '{}'::jsonb,
  attention_pattern JSONB NOT NULL DEFAULT '{}'::jsonb,
  contest_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  persistence JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  stress_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  learning_style JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_management JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5, 4) NOT NULL,
  feature_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX behavior_profiles_user_window_idx
  ON behavior_profiles(user_id, profile_window, created_at DESC);

CREATE TABLE feature_extraction_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  run_id UUID NOT NULL,
  sessions_reconstructed INTEGER NOT NULL DEFAULT 0,
  features_extracted INTEGER NOT NULL DEFAULT 0,
  extraction_latency_ms INTEGER NOT NULL DEFAULT 0,
  confidence_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  incomplete_sessions INTEGER NOT NULL DEFAULT 0,
  failed_reconstructions INTEGER NOT NULL DEFAULT 0,
  feature_version INTEGER NOT NULL,
  status VARCHAR(64) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feature_extraction_metrics_user_created_idx
  ON feature_extraction_metrics(user_id, created_at DESC);
