# ADR-0016 Redis Event Distribution Layer

## Status
Accepted

## Date
2026-07-23

## Context

The Domain Event Bus and Transactional Outbox provide reliable in-process event publication. Future CPInsight services need distributed event delivery for WebSocket gateways, analytics workers, replay workers, notification workers, recommendation systems, and AI workers.

Consumers must not read directly from the outbox. The outbox is a reliability boundary for committed events, while distributed consumers need a transport designed for fan-out, consumer groups, pending recovery, and horizontal scaling.

## Decision

CPInsight uses Redis Streams as the first distributed event transport.

The Domain Event Bus remains the abstraction. Redis is integrated through a dedicated `redis-event-publisher` subscriber. When Redis distribution is enabled, the Outbox Relay requires that subscriber to succeed before marking an outbox row as published.

The stream topology is versioned:

- `cpinsight:v1:telemetry.events`
- `cpinsight:v1:contest.events`
- `cpinsight:v1:user.events`
- `cpinsight:v1:analytics.events`
- `cpinsight:v1:system.events`

Consumers use a reusable Redis Stream Consumer framework with initialization, consumption, acknowledgement, pending recovery, dead-letter routing, metrics, and graceful shutdown.

## Consequences

Positive:

- Distributed consumers can scale horizontally through Redis Consumer Groups.
- Pending entries can be recovered after consumer crashes.
- The outbox still owns reliable post-commit publication.
- Future transports can be added behind the Domain Event Bus without changing business logic.
- Stream versioning creates a path for schema evolution.

Negative:

- Redis becomes part of the event delivery path when enabled.
- Operators must monitor stream length, pending entries, dead-letter streams, and publisher failures.
- Redis Streams provide at-least-once delivery; consumers must remain idempotent by `eventId`.

## Alternatives Considered

- Consumers reading the outbox directly: rejected because it couples workers to database relay internals.
- Redis Pub/Sub: rejected because it does not provide durable pending recovery.
- Kafka immediately: rejected because Redis is already an operational dependency and is sufficient for the current scale.
- In-process consumers only: rejected because future workers need cross-process distribution.

## Related Components

- Transactional Outbox.
- Outbox Relay Worker.
- Domain Event Bus.
- Redis Event Publisher.
- Redis Stream Consumer framework.

## References

- [Redis Event Distribution](../architecture/redis-event-distribution.md)
- [Transactional Outbox](../architecture/transactional-outbox.md)
- [Domain Event Bus](../architecture/domain-event-bus.md)
- [Redis Event Distribution Sequence](../sequence/redis-event-distribution.md)
