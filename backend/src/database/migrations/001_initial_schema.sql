CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_username_lower_idx ON users (LOWER(username));
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(80),
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  country CHAR(2),
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE cp_platform AS ENUM ('codeforces', 'codechef', 'leetcode', 'atcoder');

CREATE TABLE platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform cp_platform NOT NULL,
  handle VARCHAR(120) NOT NULL,
  handle_normalized VARCHAR(120) NOT NULL,
  profile_url TEXT,
  rating INTEGER,
  max_rating INTEGER,
  rank_label VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  sync_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform),
  UNIQUE (platform, handle_normalized)
);

CREATE INDEX platform_accounts_user_id_idx ON platform_accounts(user_id);

CREATE TABLE contest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  platform cp_platform NOT NULL,
  external_contest_id VARCHAR(120) NOT NULL,
  contest_name TEXT NOT NULL,
  rank INTEGER,
  rating_before INTEGER,
  rating_after INTEGER,
  rating_delta INTEGER,
  participated_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform_account_id, external_contest_id)
);

CREATE INDEX contest_history_account_time_idx ON contest_history(platform_account_id, participated_at DESC);
CREATE INDEX contest_history_platform_time_idx ON contest_history(platform, participated_at DESC);

CREATE TABLE submission_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  platform cp_platform NOT NULL,
  external_submission_id VARCHAR(120) NOT NULL,
  problem_key VARCHAR(255) NOT NULL,
  problem_name TEXT NOT NULL,
  contest_key VARCHAR(120),
  verdict VARCHAR(80),
  language VARCHAR(120),
  difficulty INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform_account_id, external_submission_id)
);

CREATE INDEX submission_history_account_time_idx ON submission_history(platform_account_id, submitted_at DESC);
CREATE INDEX submission_history_problem_idx ON submission_history(platform, problem_key);
CREATE INDEX submission_history_tags_gin_idx ON submission_history USING GIN(tags);

CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform cp_platform,
  cache_key VARCHAR(180) NOT NULL,
  window_key VARCHAR(40) NOT NULL DEFAULT 'all',
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cache_key, window_key)
);

CREATE INDEX analytics_cache_user_platform_idx ON analytics_cache(user_id, platform);
CREATE INDEX analytics_cache_expires_at_idx ON analytics_cache(expires_at);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_token_id UUID REFERENCES refresh_tokens(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX refresh_tokens_user_active_idx ON refresh_tokens(user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens(family_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER platform_accounts_updated_at BEFORE UPDATE ON platform_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contest_history_updated_at BEFORE UPDATE ON contest_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER submission_history_updated_at BEFORE UPDATE ON submission_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER analytics_cache_updated_at BEFORE UPDATE ON analytics_cache FOR EACH ROW EXECUTE FUNCTION set_updated_at();
