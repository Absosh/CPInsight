# ADR-0017 Realtime Event Gateway

## Status
Accepted

## Date
2026-07-23

## Context

CPInsight now has reliable domain event publication through the Transactional Outbox and Redis Streams. Future dashboards and live experiences need realtime delivery, but they must not couple directly to telemetry tables, the outbox, or business services.

The gateway needs to be generic, authenticated, horizontally scalable, and stateless except for active socket state.

## Decision

CPInsight introduces a WebSocket Gateway that consumes Redis Streams through the reusable Redis consumer framework and routes immutable Domain Events to authenticated clients.

The gateway owns:

- WebSocket upgrade handling.
- JWT authentication.
- Connection registry.
- User presence derived from active sockets.
- Channel subscription management.
- Channel authorization.
- Message serialization.
- Heartbeats and idle disconnect.
- Per-connection outbound queue backpressure.
- Graceful shutdown.

The gateway does not perform analytics, telemetry queries, outbox reads, AI processing, notifications, or recommendation logic.

## Consequences

Positive:

- Realtime delivery is decoupled from telemetry and business logic.
- Redis Consumer Groups support horizontal gateway replicas.
- Clients receive only authorized channel events.
- Slow clients are isolated by bounded outbound queues.
- Token refresh remains centralized in the HTTP authentication flow.

Negative:

- WebSocket connections require load balancer support for upgrades.
- Redis availability affects realtime delivery.
- Missed-event replay is a protocol hook in this phase; durable replay remains owned by Redis/outbox infrastructure.

## Alternatives Considered

- Dashboard polling: rejected because it does not provide low-latency realtime delivery.
- Direct outbox reads from the gateway: rejected because consumers must use Redis distribution, not outbox internals.
- Embedding business logic in WebSocket handlers: rejected because the gateway must remain a generic transport service.
- Adding a third-party WebSocket dependency immediately: rejected because the current implementation can use Node's native HTTP upgrade and socket APIs without expanding dependencies.

## Related Components

- Redis Event Distribution.
- Domain Event Bus.
- Transactional Outbox.
- JWT authentication.
- Realtime gateway.

## References

- [WebSocket Gateway](../architecture/websocket-gateway.md)
- [Redis Event Distribution](../architecture/redis-event-distribution.md)
- [Realtime Event Flow](../sequence/realtime-event-flow.md)
- [Client Reconnect](../sequence/client-reconnect.md)
