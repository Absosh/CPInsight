# Domain Event Dispatch

This sequence describes how a processed backend fact moves through the generic Domain Event Bus.

```mermaid
sequenceDiagram
  participant P as Publisher
  participant B as Domain Event Bus
  participant M as Middleware
  participant Q as Aggregate Queue
  participant S1 as Persistence Subscriber
  participant S2 as Metrics Subscriber
  participant S3 as Audit Subscriber
  participant DL as Failure Store

  P->>B: publish(domainEvent)
  B->>M: validate, trace, log
  M-->>B: accepted event
  B->>Q: enqueue by aggregate
  Q->>S1: handle(event)
  S1-->>Q: success
  Q->>S2: handle(event)
  S2-->>Q: success
  Q->>S3: handle(event)
  S3-->>Q: failure
  Q->>S3: retry
  S3-->>Q: failure
  Q->>DL: record subscriber failure
  Q-->>B: dispatch result
  B-->>P: publish result
```

Guarantees:

- Events for the same aggregate are dispatched in publication order.
- Subscriber failures are isolated.
- Middleware runs before subscriber dispatch.
- Duplicate subscriber ids are rejected.
- Publishers do not know subscriber implementations.
