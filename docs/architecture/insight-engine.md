# Insight Engine

The Insight Engine is the rule-based inference subsystem for behavior knowledge. It consumes `behavior_features`, executes registered insight rules, builds graph relationships, persists evidence, detects recurring patterns, and records inference metrics.

## Component Diagram

```mermaid
flowchart LR
  Service["KnowledgeService"] --> Repo["knowledgeRepository"]
  Service --> Registry["InsightRuleRegistry"]
  Registry --> Rules["InsightRule plugins"]
  Service --> Graph["KnowledgeGraphBuilder"]
  Service --> Patterns["PatternDetector"]
  Repo --> DB["PostgreSQL"]
```

## Rule Contract

Rules implement the common `InsightRule` contract in `backend/src/knowledge/rules/ruleContract.js`.

```text
initialize()
supports(context)
infer(context)
confidence()
version()
destroy()
```

Rules are interchangeable. Adding a new rule requires implementing the contract and registering it in the rule factory. Existing service, repository, graph, and API code do not need to change.

## Implemented Rules

| Rule | Insight Key | Category | Relationship |
| --- | --- | --- | --- |
| Conceptual Weakness | `conceptual_weakness` | `weakness` | `HAS_WEAKNESS` |
| Recovery Strength | `strong_recovery_ability` | `strength` | `HAS_STRENGTH` |
| Risk Management | `risk_management_weakness` | `weakness` | `HAS_WEAKNESS` |
| Time Management | `strong_time_management` | `strength` | `HAS_STRENGTH` |
| Recurring Late Panic | `repeated_late_panic` | `pattern` | `HAS_PATTERN` |
| Difficulty Avoidance | `difficulty_avoidance` | `pattern` | `HAS_PATTERN` |
| Fast Recognition | `fast_recognition` | `strength` | `HAS_STRENGTH` |

## Inference Lifecycle

```mermaid
sequenceDiagram
  participant API as Knowledge API
  participant Service as KnowledgeService
  participant Rules as InsightRuleRegistry
  participant Graph as KnowledgeGraphBuilder
  participant DB as PostgreSQL

  API->>Service: infer(userId, options)
  Service->>DB: load behavior_features
  loop registered rules
    Service->>Rules: initialize/supports/infer/destroy
    Rules-->>Service: immutable insights
  end
  Service->>Graph: build(userId, insights)
  Service->>DB: BEGIN
  Service->>DB: upsert knowledge_nodes
  Service->>DB: insert behavior_insights
  Service->>DB: insert insight_evidence
  Service->>DB: insert knowledge_edges
  Service->>DB: insert behavior_patterns
  Service->>DB: insert insight_inference_metrics
  Service->>DB: COMMIT
  Service-->>API: inference summary
```

## Confidence Model

Each insight confidence is clamped to `[0, 1]` and derived from supporting feature confidence. Pattern confidence is derived from recurring insight confidence. Low-confidence knowledge remains stored because it is evidence-backed, but future recommendation and AI systems should apply their own minimum confidence thresholds.

## Conflict Handling

Rules are independent and may emit contradictory knowledge if evidence supports it. The current implementation prevents one specific false positive by requiring the risk-management rule to see both high risk appetite and late contest panic. Broader conflict resolution is intentionally deferred until downstream analytics need ranking or explanation semantics.

## Observability

Each inference run records:

- Generated insight count.
- Rules fired.
- Inference latency.
- Confidence distribution.
- Graph node and edge counts.
- Pattern count.
- Completion or failure status.

