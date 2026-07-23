# ADR-0029 Contest Review Worker

## Status
Accepted

## Date
2026-07-23

## Context

Live contest monitoring stops inside an authenticated HTTP request, but contest review generation requires behavior extraction, knowledge graph refresh, retrieval, reasoning, LLM execution, validation, reflection storage, roadmap updates, persistence, and client notification. Executing that work synchronously would couple user-facing latency to external providers and long-running analysis. It would also make crash recovery and duplicate prevention difficult.

The repository already contains durable telemetry ingestion, a processing pipeline, a transactional outbox, Redis event distribution, a WebSocket gateway, and deterministic AI preparation layers. The missing component is autonomous background orchestration after `contest_review_jobs` are queued.

## Decision

CPInsight will use a PostgreSQL-backed Contest Review Worker. Stopping a live telemetry session creates or reuses one durable job per `live_session_id`. Worker processes atomically claim jobs with `FOR UPDATE SKIP LOCKED`, store a lease owner and lease expiration, execute existing services in order, persist the final review and roadmap update, and publish review lifecycle events through the transactional outbox.

The worker can run embedded in the API process for simple deployments and as a dedicated `worker:reviews` process for production. The implementation favors explicit database state over in-memory queues so jobs survive crashes and deployments.

Direct synchronous review generation was rejected because it would block HTTP requests and lose progress on process termination. Redis-only job queues were rejected for this phase because PostgreSQL already owns the session and review persistence boundary, and atomic claims can be implemented without introducing another reliability surface. Duplicating behavior, knowledge, retrieval, or AI validation logic inside the worker was rejected because those components are already canonical services.

## Consequences

Positive consequences:

- Review generation is automatic after monitoring stops.
- Multiple workers can run concurrently without duplicate execution.
- Provider outages and transient database failures retry with durable state.
- Dead-letter records preserve operational evidence for failed reviews.
- WebSocket clients can observe progress through existing event distribution.

Negative consequences:

- Review completion depends on an active worker process.
- PostgreSQL queue polling adds database load proportional to worker count.
- Failed LLM providers can delay review readiness until retries complete or the job dead-letters.

Future implications:

- The same job model can be moved behind Redis Streams or another broker later without changing AI pipeline services.
- Administrative replay tooling can be added on top of dead-letter records.
- Queue cleanup should become a scheduled maintenance task when production retention requirements are finalized.

## Alternatives Considered

- **Synchronous HTTP processing:** rejected because review generation is long-running and depends on external providers.
- **In-memory queue:** rejected because process crashes would lose jobs.
- **Redis-only queue:** rejected for this phase because the job must remain transactionally close to the live session and review persistence records.
- **New AI review service:** rejected because it would duplicate already implemented AI orchestration layers.

## Related Components

- Live Telemetry Session API
- Contest Review Worker
- Behavior Intelligence
- Behavior Knowledge Graph
- Retrieval Planner
- Hybrid Retrieval
- Reasoning Context Engine
- AI Task Orchestrator
- LLM Runtime
- AI Quality Layer
- Transactional Outbox
- Redis Event Distribution
- WebSocket Gateway

## References

- [Contest Review Worker](../backend/review-worker.md)
- [Job Processing](../backend/job-processing.md)
- [Review Queue](../backend/review-queue.md)
- [Dead Letter Queue](../backend/dead-letter-queue.md)
- [Live Telemetry Session API](../backend/telemetry-session.md)
