# Knowledge Inference Sequence

This sequence shows how existing behavior features become persisted knowledge graph rows.

```mermaid
sequenceDiagram
  autonumber
  participant Client as Authenticated Client
  participant API as /api/knowledge/infer
  participant Service as KnowledgeService
  participant Repository as KnowledgeRepository
  participant Rules as Insight Rules
  participant Graph as KnowledgeGraphBuilder
  participant Patterns as PatternDetector
  participant DB as PostgreSQL

  Client->>API: POST /api/knowledge/infer
  API->>Service: infer(userId, body)
  Service->>Repository: getBehaviorFeatures(userId, options)
  Repository->>DB: SELECT behavior_features
  DB-->>Repository: feature rows
  Repository-->>Service: features
  loop each registered rule
    Service->>Rules: initialize()
    Service->>Rules: supports({features, options})
    Service->>Rules: infer({features, options})
    Rules-->>Service: immutable insight records
    Service->>Rules: destroy()
  end
  Service->>Graph: build({userId, insights})
  Graph-->>Service: nodes and edges
  Service->>DB: BEGIN
  Service->>Repository: insertNode(...)
  Service->>Repository: insertInsight(...)
  Service->>Repository: insertEvidence(...)
  Service->>Repository: insertEdge(...)
  Service->>Patterns: detect({userId, insights, windowKey})
  Patterns-->>Service: pattern records
  Service->>Repository: insertPattern(...)
  Service->>Repository: insertMetrics(status=completed)
  Service->>DB: COMMIT
  Service-->>API: run summary
  API-->>Client: 202 Accepted
```

## Failure Path

```mermaid
sequenceDiagram
  participant Service as KnowledgeService
  participant DB as PostgreSQL
  participant Metrics as insight_inference_metrics

  Service->>DB: BEGIN
  Service->>DB: write graph and insights
  DB-->>Service: error
  Service->>DB: ROLLBACK
  Service->>Metrics: insert failed run metadata
```

No partial graph write should survive a failed transaction.

