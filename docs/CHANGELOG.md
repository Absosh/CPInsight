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
- Architecture Decision Records ADR-0001 through ADR-0015.
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
