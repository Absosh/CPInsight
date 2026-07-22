# Telemetry Flow Sequence

The current telemetry flow persists locally and uploads acknowledged batches to the backend.

```mermaid
sequenceDiagram
  participant Collector
  participant SDK
  participant SessionEngine
  participant EventBus
  participant SdkPipeline as SDK Event Pipeline
  participant Store
  participant Transport
  participant API as Backend Telemetry API
  participant Processing as Processing Pipeline
  participant Outbox as Transactional Outbox
  participant DomainBus as Domain Event Bus
  participant DB as PostgreSQL

  Collector->>SDK: Generic page context via snapshot
  SDK->>SessionEngine: handlePageSnapshot
  SessionEngine->>EventBus: emit(event)
  EventBus->>SdkPipeline: process(event)
  SdkPipeline->>SdkPipeline: Normalize and validate
  SdkPipeline->>Store: Check dedupe key
  SdkPipeline-->>EventBus: Frozen event
  EventBus->>Store: appendEvent(event)
  EventBus->>Transport: publish(event)
  Transport->>Store: enqueue(event)
  Store->>Transport: Scheduler reads ordered queue
  Transport->>API: POST /api/telemetry/upload
  API->>Processing: Process authenticated batch
  Processing->>Processing: Validate schema, ordering, idempotency
  Processing->>Processing: Enrich and classify immutable events
  Processing->>DB: Store raw events and processed metadata
  Processing->>Outbox: Persist domain events inside transaction
  Processing-->>API: Acknowledgement
  API-->>Transport: acknowledgedEventIds
  Transport->>Store: Remove acknowledged events only
  Outbox->>DomainBus: Relay committed events after commit
  DomainBus->>DB: Store domain events, audit, metrics, failures
```

Collectors remain unaware of upload transport and backend ingestion.
