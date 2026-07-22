# ADR-0008 Transport Abstraction

## Status
Accepted

## Date
2026-07-22

## Context

Telemetry transport requirements are not fixed. CPInsight may need HTTP batch upload, WebSocket live telemetry, gRPC for desktop clients, or a local desktop bridge. Collectors should not change when transport changes.

## Decision

The SDK publishes through a transport abstraction. `QueuedTransport` writes events to the durable queue, and the Phase 2.1 upload layer drains that queue through authenticated HTTP. Future transports can publish queued events to other backend systems without changing collectors or session lifecycle code.

## Consequences

Positive:

- Collectors remain transport-agnostic.
- Offline mode is supported by local queueing.
- Future realtime telemetry can coexist with durable queueing.

Negative:

- Backend ingestion exists, but future quota, compression, and live backpressure policy still need explicit design.

## Alternatives Considered

- Collector performs fetch calls: rejected because it couples DOM parsing to backend/network behavior.
- Event Bus hardcodes HTTP: rejected because future live and desktop transports would require rewrites.
- No transport layer until later: rejected because event publication boundaries should be established before Phase 2.

## Related Components

- Queued Transport
- Event Bus
- Persistent Store

## References

- [Telemetry](../architecture/telemetry.md)
- [Future Live Telemetry](../sequence/future-live-telemetry.md)
