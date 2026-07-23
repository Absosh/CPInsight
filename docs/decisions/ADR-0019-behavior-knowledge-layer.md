# ADR-0019 Behavior Knowledge Layer

## Status

Accepted

## Date

2026-07-23

## Context

The Behavior Intelligence Engine produces numeric features such as reading time, persistence, risk appetite, focus stability, and difficulty avoidance. Those features are useful for analytics, but they are not a stable knowledge contract for future recommendation, RAG, or coaching systems.

CPInsight needs a layer that converts observations into semantic, evidence-backed knowledge while preserving the boundary that future AI systems must not reinterpret raw telemetry directly. The design must remain deterministic, inspectable, and versioned.

Constraints:

- Do not redesign the Observability SDK, upload layer, processing pipeline, outbox, domain event bus, Redis distribution, realtime gateway, or behavior intelligence engine.
- Do not implement LLMs, embeddings, vector search, RAG, recommendations, chat, or natural language generation.
- Preserve evidence and confidence for every inferred insight.
- Keep rules modular so future behavioral research can add rules without changing the service boundary.

## Decision

Implement a Behavior Knowledge Layer composed of:

- Rule-based insight plugins.
- A knowledge graph builder.
- Persistent versioned nodes and edges.
- Evidence-backed insight records.
- Recurring pattern detection.
- Inference metrics.
- Authenticated internal retrieval APIs under `/api/knowledge`.

The layer persists machine-readable knowledge in PostgreSQL tables introduced by migration `010_behavior_knowledge_graph.sql`.

This decision keeps knowledge derivation deterministic and auditable. Each rule emits immutable insight objects containing an insight key, category, confidence, supporting feature IDs, evidence session IDs, relationship type, target node, and rule metadata.

## Consequences

Positive consequences:

- Future analytics and AI systems can consume semantic knowledge instead of raw telemetry.
- Rule output is explainable because every insight records supporting features and sessions.
- Knowledge graph rows can evolve through versioning.
- The plugin rule model keeps the Open/Closed Principle intact for inference logic.

Negative consequences:

- Rule-based inference is less expressive than probabilistic or model-based inference.
- Contradictory insights can coexist until a downstream ranking or conflict-resolution layer is introduced.
- Graph persistence currently uses PostgreSQL tables rather than a specialized graph database.

Future implications:

- RAG and recommendation systems should use this layer as their canonical behavioral knowledge source.
- If graph traversal needs exceed relational query ergonomics, a graph projection can be built from these canonical tables.
- New rules should increment versions when thresholds or semantics change.

## Alternatives Considered

Directly use behavior features in analytics and AI:

- Rejected because it would force every downstream consumer to duplicate interpretation logic.

Generate insights with an LLM:

- Rejected for this phase because it would add nondeterminism, cost, privacy concerns, and explainability gaps before the machine-readable knowledge contract exists.

Use a graph database immediately:

- Rejected because the current repository already depends on PostgreSQL and the required Phase 3.3 relationships fit a relational edge table. A graph database can later consume the same canonical rows as a projection.

Hardcode insights inside API controllers:

- Rejected because it violates Separation of Concerns and makes future rule expansion brittle.

## Related Components

- `backend/src/knowledge/rules`
- `backend/src/knowledge/graph/graphBuilder.js`
- `backend/src/knowledge/patterns/patternDetector.js`
- `backend/src/services/knowledgeService.js`
- `backend/src/repositories/knowledgeRepository.js`
- `backend/src/routes/knowledgeRoutes.js`
- `backend/src/database/migrations/010_behavior_knowledge_graph.sql`

## References

- [Behavior Knowledge Layer](../architecture/behavior-knowledge.md)
- [Insight Engine](../architecture/insight-engine.md)
- [Knowledge Inference Sequence](../sequence/knowledge-inference.md)
- [Insight Generation Sequence](../sequence/insight-generation.md)
- [Behavior Intelligence Engine](../architecture/behavior-intelligence.md)

