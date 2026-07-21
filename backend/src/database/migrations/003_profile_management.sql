ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS college_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS avatar_thumbnail TEXT,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_profiles_college_id_idx ON user_profiles(college_id);
