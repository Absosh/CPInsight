# ADR-0008 Transport Abstraction

## Status
Accepted

## Date
2026-07-22

## Context

Telemetry transport requirements are not fixed. CPInsight may need HTTP batch upload, WebSocket live telemetry, gRPC for desktop clients, or a local desktop bridge. Collectors should not change when transport changes.

## Decision

The SDK publishes through a transport abstraction. The current implementation is `QueuedTransport`, which writes events to the durable queue. Future transports can publish queued events to backend systems without changing collectors or session lifecycle code.

## Consequences

Positive:

- Collectors remain transport-agnostic.
- Offline mode is supported by local queueing.
- Future realtime telemetry can coexist with durable queueing.

Negative:

- Current implementation does not upload Observability SDK events.
- Queue-drain policy must be designed before backend ingestion.

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
