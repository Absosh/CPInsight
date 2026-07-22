# Outbox Replay Sequence

Replay republishes selected published or dead-letter outbox events through the same Domain Event Bus contract.

```mermaid
sequenceDiagram
  participant Admin as Authorized Operator
  participant R as Outbox Relay
  participant DB as PostgreSQL
  participant B as Domain Event Bus
  participant S as Subscribers

  Admin->>R: replay(filters, reason)
  R->>DB: find replay candidates
  DB-->>R: ordered outbox records
  loop selected event
    R->>B: publish(domainEvent with replay context)
    B->>S: dispatch idempotently
    R->>DB: record replay log
  end
  R-->>Admin: replay results
```

Replay must be treated as an administrative operation. Future public replay endpoints must require explicit authorization.
