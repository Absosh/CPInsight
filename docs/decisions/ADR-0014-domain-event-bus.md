# ADR-0014 Domain Event Bus

## Status
Accepted

## Date
2026-07-23

## Context

The telemetry processing pipeline created in Phase 2.2 is the canonical path for uploaded telemetry events. Without a backend event bus, future systems such as analytics, WebSocket fan-out, notifications, replay, recommendations, and AI enrichment would be tempted to call telemetry services directly or add logic inside the telemetry API.

That coupling would violate Separation of Concerns and make telemetry ingestion a coordination point for unrelated products. It would also make future publishers, such as VS Code telemetry or desktop clients, hard to introduce without modifying existing consumers.

The architecture needs a generic internal event backbone that can support many producers and subscribers while preserving local ordering guarantees and subscriber failure isolation.

## Decision

CPInsight now uses a generic in-process Domain Event Bus in the backend.

The bus exposes:

```text
publish(event)
subscribe(subscriber)
unsubscribe(subscriberId)
middleware
```

Every domain event uses the immutable contract:

- `eventId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `publishedAt`
- `aggregateType`
- `aggregateId`
- `source`
- `payload`
- `metadata`
- `correlationId`
- `causationId`

Subscribers implement a common contract and are registered independently. The bus serializes events per aggregate, supports middleware, isolates subscriber failures, retries failed subscribers according to subscriber policy, records dead-letter failures, and tracks dispatch metrics.

The telemetry pipeline publishes processed telemetry facts into the bus through a dedicated publication stage. The pipeline remains intact and does not know any subscriber implementation.

## Consequences

Positive consequences:

- Telemetry is a publisher, not a shared dependency for every future consumer.
- Future producers can publish new event types without changing existing subscribers.
- Future consumers can subscribe without modifying telemetry ingestion.
- Per-aggregate ordering preserves session-level event order without global serialization.
- Subscriber failures are contained and observable.
- The event contract gives future replay and integration systems a stable boundary.

Negative consequences:

- The current implementation is in-process; it does not yet provide cross-node broker semantics.
- Subscriber registration order and priority are operational configuration concerns.
- Durable distributed delivery will require a future outbox relay or external broker if the backend runs multiple nodes.

## Alternatives Considered

- Direct service calls from telemetry pipeline to analytics or streaming systems: rejected because it couples telemetry to every downstream consumer.
- Telemetry-specific event emitter: rejected because the bus must support authentication, profile, notification, AI, recommendation, and future client events.
- External broker immediately: rejected for this phase because it would add deployment and operational complexity before CPInsight has multiple backend nodes or high-volume asynchronous consumers.
- Database triggers for downstream processing: rejected because triggers hide application behavior inside storage and make subscriber retry and failure isolation harder to reason about.

## Related Components

- Backend Domain Event Bus.
- Telemetry processing pipeline.
- Domain event subscribers.
- Domain event persistence tables.
- Runtime verification scripts.

## References

- [Domain Event Bus](../architecture/domain-event-bus.md)
- [Telemetry Architecture](../architecture/telemetry.md)
- [Domain Event Dispatch](../sequence/domain-event-dispatch.md)
