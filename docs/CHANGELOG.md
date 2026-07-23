# Changelog

This changelog follows the structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning terminology. The repository does not currently publish versioned packages from the root; versions below describe engineering milestones.

## [Unreleased]

### Planned

- Realtime telemetry transport.
- Live dashboard projections.
- RAG and AI mentor architecture after telemetry ingestion exists.
- Additional collector plugins for future platforms.

## [1.0.0 Foundation] - 2026-07-22

### Added

- Reliable Observability SDK telemetry upload infrastructure.
- Authenticated backend telemetry ingestion endpoint at `/api/telemetry/upload`.
- Telemetry batch, raw event, upload attempt, and event failure tables.
- Extension upload scheduler, batch builder, retry policy, authenticated HTTP telemetry transport, and upload state store.
- Runtime verification harness for telemetry upload reliability scenarios.
- Modular backend telemetry processing pipeline with composable stages.
- Processed telemetry metadata, pipeline metrics, and dead-letter persistence.
- Runtime verification harness for telemetry processing pipeline behavior.
- Generic backend Domain Event Bus with immutable event contract, middleware, aggregate ordering, subscriber retry, audit, persistence, and dispatch metrics.
- Runtime verification harness for Domain Event Bus behavior.
- Transactional Outbox and relay worker for post-commit domain event publication.
- Outbox migration with leasing, retry state, replay log, dead-letter state, and subscriber idempotency indexes.
- Runtime verification harness for transactional outbox reliability behavior.
- Redis Streams event distribution platform with publisher, connection manager, stream topology, consumer framework, pending recovery, and dead-letter routing.
- Runtime verification harness for Redis event distribution behavior.
- Authenticated WebSocket Gateway for Redis-backed realtime domain event delivery.
- Runtime verification harness for realtime gateway connection, routing, backpressure, heartbeat, and Redis consumption behavior.
- Behavior Intelligence Engine with session reconstruction, contest reconstruction, plugin feature extractors, immutable feature store, profiles, metrics, and protected APIs.
- Runtime verification harness for behavior reconstruction, confidence, plugin registration, historical aggregation, and 100k-event processing.
- Behavior Knowledge Layer with rule-based insight inference, knowledge graph persistence, pattern detection, evidence records, and protected APIs.
- Runtime verification harness for behavior knowledge inference, graph construction, pattern detection, confidence validation, and 50k-feature processing.
- Intent Classification and Retrieval Planner with deterministic multi-intent classification, source registry, strategy registry, plugin planning rules, confidence planning, token budgeting, and protected APIs.
- Runtime verification harness for retrieval planning, ambiguity, unknown intents, evidence requests, deterministic output, and 1000 mixed questions.
- Hybrid Retrieval Engine with source adapters, parallel execution, cache support, evidence fusion, ranking, contradiction detection, immutable Evidence Packages, and protected APIs.
- Runtime verification harness for hybrid retrieval, cache hits, partial failures, timeouts, contradiction detection, deterministic packages, and 1000 mixed retrieval plans.
- Reasoning Context Engine with behavior ontology, finding extraction, causal chains, evidence compression, token budgeting, prompt orchestration, provider metadata, and protected APIs.
- Runtime verification harness for ontology mapping, context generation, prompt determinism, provider independence, 4k token budgeting, and 1000 Evidence Packages.
- AI Task Orchestrator with task registry, prompt strategy engine, output schema registry, safety policies, evaluation policies, task chaining, execution plans, and protected APIs.
- Runtime verification harness for task routing, multi-task routing, chaining, strategies, schemas, policies, unknown tasks, determinism, and 1000 mixed questions.
- LLM Runtime Engine with provider registry, model registry, request builder, model selection, streaming collection, retry, failover, rate limiting, token accounting, cost accounting, and protected APIs.
- Runtime verification harness for non-streaming, streaming, retries, failover, manual overrides, rate limits, cancellation, model selection, accounting, and 1000 execution plans.
- AI Quality Layer with response normalization, schema validation, grounding validation, citation validation, recommendation validation, confidence validation, consistency checks, quality scoring, reflection memory, human feedback, and protected APIs.
- Runtime verification harness for malformed responses, grounding failures, citation failures, recommendation failures, confidence clamping, reflection creation, human feedback, regeneration requests, deterministic validation, and 1000 raw responses.
- AI Design System with semantic tokens, dark/light/high-contrast themes, core AI components, composite components, layout primitives, animation classes, Storybook configuration, and accessibility guidance.
- Static AI Design System verification harness for token coverage, presentational boundaries, reduced motion, focus styling, and Storybook coverage.
- AI Coach Workspace with three-panel layout, session state, conversation composer, structured response rendering, evidence exploration, reasoning panels, recommendation actions, reflection timeline, roadmap view, contextual insights, keyboard shortcuts, and API adapter.
- Static AI Coach Workspace verification harness for session lifecycle, API wiring, design-system integration, interaction affordances, responsive layout, and frontend/backend boundary checks.
- Live Contest Monitoring for Codeforces with extension popup controls, contest detection, official API polling, submission diffing, offline queueing, signed backend live sessions, telemetry pipeline reuse, WebSocket dashboard consumer, and contest review job creation.
- Static Live Monitoring verification harness for backend endpoints, extension SDK contracts, Codeforces API usage, sensitive data boundaries, dashboard integration, and review job queueing.
- User authentication with registration, login, refresh-token rotation, and logout.
- JWT access token and refresh token infrastructure.
- PostgreSQL schema for users, profiles, platform accounts, contests, submissions, analytics cache, refresh tokens, and LeetCode extension uploads.
- Redis-backed analytics cache support.
- Static frontend pages for authentication, dashboard, analytics, calendar, comparison, profile, platforms, roadmap, and landing page.
- Backend route-controller-service-repository structure.
- Platform account connection and synchronization infrastructure.
- Analytics endpoints for platform and combined analytics.
- LeetCode authenticated Chrome extension collection and upload path.
- Idempotent LeetCode extension upload records.
- Chrome Manifest V3 extension runtime with service worker, content scripts, popup, message bus, and storage.
- Codeforces and CodeChef support in platform services and Observability SDK collectors.
- Platform-agnostic Observability SDK.
- Collector Registry, Session Engine, Lifecycle Manager, Event Bus, Event Pipeline, Schema Validator, Persistence Layer, and Transport abstraction.
- Durable local telemetry queue for Observability SDK events.
- Runtime verification harness for observability session lifecycle behavior.
- Architecture documentation suite under `docs/`.
- Architecture Decision Records ADR-0001 through ADR-0028.
- Operations, testing, security, contributing, changelog, and glossary documentation.

### Security

- Password hashing with bcrypt.
- Refresh tokens stored by hash.
- Helmet middleware.
- Rate limiting for global, authentication, and analytics routes.
- Joi validation for public request boundaries.
- `.env.deploy` ignored by Git.

### Documentation

- System architecture, backend, frontend, database, authentication, telemetry, Chrome extension, Observability SDK, deployment, API, sequence, roadmap, and ADR documentation.

## Versioning Notes

Future releases should add sections in this format:

```text
## [X.Y.Z] - YYYY-MM-DD
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
```
