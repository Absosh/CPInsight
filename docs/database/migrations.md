# Database Migrations

Migrations are SQL files in `backend/src/database/migrations`. They are executed by `backend/src/database/migrate.js`.

## Migration Order

| File | Purpose |
| --- | --- |
| `001_initial_schema.sql` | Creates core users, profiles, platform accounts, contests, submissions, analytics cache, refresh tokens, update trigger |
| `002_leetcode_extension_uploads.sql` | Adds LeetCode extension upload idempotency table |
| `003_profile_management.sql` | Adds college and avatar profile fields |
| `004_profile_country_text.sql` | Changes `user_profiles.country` from `CHAR(2)` to `VARCHAR(80)` |
| `005_telemetry_ingestion.sql` | Adds telemetry batch, event, upload attempt, and event failure storage |
| `006_telemetry_processing_pipeline.sql` | Adds processed telemetry events, pipeline metrics, and dead-letter storage |
| `007_domain_event_bus.sql` | Adds domain event persistence, audit log, subscriber failure, and dispatch metric storage |
| `008_transactional_outbox.sql` | Adds transactional outbox, replay log, outbox indexes, and subscriber idempotency constraints |
| `009_behavior_intelligence.sql` | Adds behavior sessions, immutable features, profiles, feature versions, and extraction metrics |
| `010_behavior_knowledge_graph.sql` | Adds behavior knowledge graph nodes, edges, insights, patterns, evidence, and inference metrics |
| `011_intent_retrieval_planner.sql` | Adds intent classification, retrieval plan, planner rule version, and planner metric storage |
| `012_hybrid_retrieval_engine.sql` | Adds retrieval cache, evidence package, retrieval metrics, source metrics, and fusion metrics storage |

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

## `010_behavior_knowledge_graph.sql`

Adds the Behavior Knowledge Layer schema:

- `insight_versions`
- `knowledge_nodes`
- `knowledge_edges`
- `behavior_insights`
- `behavior_patterns`
- `insight_evidence`
- `insight_inference_metrics`

This migration depends on `users`, `behavior_sessions`, and `behavior_features`. It keeps behavior knowledge separate from raw telemetry and feature extraction rows while preserving evidence links back to source features and reconstructed sessions.

## `011_intent_retrieval_planner.sql`

Adds planning-only AI infrastructure:

- `planner_rule_versions`
- `intent_classifications`
- `retrieval_plans`
- `planner_metrics`

The migration stores question hashes, intent classifications, selected sources, selected strategies, confidence plans, token budgets, estimates, and planner metrics. It does not store raw question text.

## `012_hybrid_retrieval_engine.sql`

Adds the Hybrid Retrieval Engine schema:

- `retrieval_cache`
- `evidence_packages`
- `retrieval_execution_metrics`
- `retrieval_source_metrics`
- `fusion_metrics`

The migration stores evidence packages and retrieval observability. It does not duplicate canonical behavior, knowledge, contest, or submission tables.
