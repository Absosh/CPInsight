# ADR-0015 Transactional Outbox Pattern

## Status
Accepted

## Date
2026-07-23

## Context

Phase 2.3 introduced a generic backend Domain Event Bus. The telemetry pipeline published events directly to the bus during request execution. That was sufficient for in-process decoupling, but it did not provide atomic publication guarantees.

Direct publication has two distributed-systems failure modes:

- A process can publish an event before the database transaction commits, creating a phantom event if the transaction rolls back.
- A process can commit database changes and crash before publication, losing the event.

CPInsight needs a model that survives process crashes, deployment restarts, relay restarts, and future horizontal scaling. It also needs to prepare for future Redis Streams, Kafka, RabbitMQ, NATS, or another broker without changing business logic.

## Decision

CPInsight now uses the Transactional Outbox pattern.

Business processing writes domain events into `domain_event_outbox` inside the same PostgreSQL transaction as telemetry and processed telemetry records. After commit, an Outbox Relay Worker leases pending records, publishes them to the Domain Event Bus, and marks them published.

Outbox states are:

- `pending`
- `publishing`
- `published`
- `failed`
- `dead_letter`

The relay uses lease ownership, publication tokens, retry metadata, dead-letter state, and replay logs. Subscriber side effects use event identity as an idempotency boundary.

## Consequences

Positive consequences:

- Database writes and event creation are atomic.
- Rollbacks do not leak events.
- Committed events survive process and deployment crashes.
- Relay workers can be run on multiple backend replicas using PostgreSQL leases and `FOR UPDATE SKIP LOCKED`.
- Future external brokers can be introduced behind the relay without modifying business logic.
- Replay is possible from durable outbox state.

Negative consequences:

- Domain events are no longer dispatched synchronously during request execution.
- Operational monitoring must track pending rows, retry counts, lease expiration, and dead letters.
- Logical exactly-once publication depends on subscriber idempotency by `eventId`, because no distributed system can make arbitrary side effects exactly once without participant cooperation.

## Alternatives Considered

- Continue direct publication after telemetry persistence: rejected because a crash after commit can lose events.
- Publish before commit: rejected because rollback can create phantom events.
- External broker inside the request transaction: rejected because common brokers do not participate in PostgreSQL transactions without significant complexity.
- Database triggers: rejected because they hide application-level event contracts and make retry/replay behavior harder to test.
- Poll telemetry tables directly: rejected because it couples every downstream consumer to telemetry storage and does not support future non-telemetry publishers.

## Related Components

- Telemetry processing pipeline.
- Domain Event Bus.
- Outbox Relay Worker.
- Domain event subscribers.
- PostgreSQL migrations.
- Runtime verification scripts.

## References

- [Transactional Outbox](../architecture/transactional-outbox.md)
- [Domain Event Bus](../architecture/domain-event-bus.md)
- [Outbox Relay Sequence](../sequence/outbox-relay.md)
- [Outbox Replay Sequence](../sequence/outbox-replay.md)
