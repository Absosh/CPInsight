# Database Schema

This document describes the implemented PostgreSQL schema from `backend/src/database/migrations`.

## `users`

Stores login identity.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key, generated with `gen_random_uuid()` |
| `username` | VARCHAR(32) | Required |
| `email` | VARCHAR(255) | Required |
| `password_hash` | TEXT | bcrypt hash |
| `created_at` | TIMESTAMPTZ | Default now |
| `updated_at` | TIMESTAMPTZ | Trigger maintained |

Indexes:

- `users_username_lower_idx` unique on `LOWER(username)`.
- `users_email_lower_idx` unique on `LOWER(email)`.

## `user_profiles`

One profile row per user.

Columns include `display_name`, `timezone`, `country`, `avatar_url`, `preferences`, `college_id`, `avatar_thumbnail`, and `avatar_updated_at`.

Primary key and foreign key: `user_id REFERENCES users(id) ON DELETE CASCADE`.

## `platform_accounts`

Stores one connected handle per user and platform.

Important columns:

- `platform cp_platform`
- `handle`
- `handle_normalized`
- `profile_url`
- `rating`
- `max_rating`
- `rank_label`
- `metadata JSONB`
- `sync_status`
- `last_synced_at`

Uniqueness:

- `(user_id, platform)`
- `(platform, handle_normalized)`

## `contest_history`

Stores contest participation facts for a platform account.

Uniqueness: `(platform_account_id, external_contest_id)`.

Indexes:

- `(platform_account_id, participated_at DESC)`
- `(platform, participated_at DESC)`

## `submission_history`

Stores submission or solved-problem facts.

Important columns:

- `platform`
- `external_submission_id`
- `problem_key`
- `problem_name`
- `contest_key`
- `verdict`
- `language`
- `difficulty`
- `tags TEXT[]`
- `submitted_at`
- `metadata JSONB`

Indexes:

- `(platform_account_id, submitted_at DESC)`
- `(platform, problem_key)`
- GIN on `tags`

## `analytics_cache`

Stores persisted computed analytics payloads.

Uniqueness: `(user_id, cache_key, window_key)`.

Indexes support user/platform lookup and expiry cleanup.

## `refresh_tokens`

Stores refresh token hashes.

Important columns:

- `token_hash CHAR(64) UNIQUE`
- `family_id`
- `expires_at`
- `revoked_at`
- `replaced_by_token_id`

Indexes support active-token lookup and token-family lookup.

## `leetcode_extension_uploads`

Stores idempotency and provenance for authenticated LeetCode extension uploads.

Important columns:

- `session_id VARCHAR(180) UNIQUE`
- `payload_hash`
- `collector_version`
- `provider_version`
- `request_metadata JSONB`
- `received_at`
- `completed_at`

This table does not store the full uploaded payload. It stores upload metadata and idempotency state.
