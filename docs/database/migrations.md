# Database Migrations

Migrations are SQL files in `backend/src/database/migrations`. They are executed by `backend/src/database/migrate.js`.

## Migration Order

| File | Purpose |
| --- | --- |
| `001_initial_schema.sql` | Creates core users, profiles, platform accounts, contests, submissions, analytics cache, refresh tokens, update trigger |
| `002_leetcode_extension_uploads.sql` | Adds LeetCode extension upload idempotency table |
| `003_profile_management.sql` | Adds college and avatar profile fields |
| `004_profile_country_text.sql` | Changes `user_profiles.country` from `CHAR(2)` to `VARCHAR(80)` |

## Migration Principles

- Migrations are append-only.
- Existing migration files should not be edited after deployment.
- Schema changes should be explicit SQL.
- Data backfills should be separate from structural migrations when they are large or risky.
- JSONB metadata is used for platform-specific fields that do not yet justify relational columns.

## Trigger Model

`001_initial_schema.sql` defines `set_updated_at()` and attaches update triggers to mutable tables. Later tables also attach the same trigger.

## Operational Flow

With Docker Compose, run the migration service profile:

```text
docker compose --profile tools run --rm migrate
```

The backend should be deployed only after required migrations have succeeded.
