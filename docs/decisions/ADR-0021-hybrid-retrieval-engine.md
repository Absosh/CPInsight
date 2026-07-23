# ADR-0021 Hybrid Retrieval Engine

## Status

Accepted

## Date

2026-07-23

## Context

Phase 3.4A introduced deterministic intent classification and retrieval planning. Plans describe which sources and strategies should be used, but they intentionally do not retrieve data. CPInsight now needs a retrieval execution layer that can query heterogeneous evidence sources and produce a unified package for future context construction.

Constraints:

- Do not redesign the planner, behavior knowledge graph, behavior intelligence engine, telemetry pipeline, realtime gateway, Redis distribution, outbox, event bus, upload infrastructure, or Observability SDK.
- Do not call LLMs, build prompts, generate recommendations, use embeddings, or implement provider integrations.
- Preserve partial-failure tolerance because future evidence sources will have different latency and reliability profiles.
- Keep source-specific retrieval isolated behind adapter contracts.

## Decision

Implement a Hybrid Retrieval Engine with:

- Source adapter registry.
- SQL-backed adapters for implemented data sources.
- Stub adapters for future vector store and conversation memory.
- Parallel execution engine with timeout, retry, partial-failure, and cache support.
- Evidence fusion pipeline.
- Deterministic ranking.
- Contradiction detection.
- Immutable Evidence Package output.
- Internal authenticated retrieval APIs.
- Persistence for packages, execution metrics, source metrics, fusion metrics, and future durable cache.

## Consequences

Positive consequences:

- Retrieval execution is decoupled from planning.
- New evidence sources require adapter registration instead of engine redesign.
- Partial failures are captured without losing successful evidence.
- Future context builders can consume one stable Evidence Package contract.
- Ranking and contradiction handling are inspectable and testable.

Negative consequences:

- The current cache is process-local; durable cross-process cache invalidation is deferred.
- Contradiction resolution handles numeric conflicts first and does not yet rank semantic conflicts across all relationship types.
- SQL-backed adapters are intentionally bounded by current repository schema and may need additional indexes as data grows.

Future implications:

- Vector retrieval can replace the stub adapter without changing the engine.
- Context builders should consume Evidence Packages and not call source adapters directly.
- A distributed cache or Redis-backed cache can use the `retrieval_cache` table or Redis with version-aware invalidation.

## Alternatives Considered

Direct source retrieval from controllers:

- Rejected because it would couple HTTP handling to source-specific retrieval, timeout handling, fusion, and ranking.

Embedding-first retrieval:

- Rejected because embeddings and vector infrastructure are explicitly out of scope for this phase.

Single SQL mega-query:

- Rejected because sources have different evidence semantics, reliability, cost, and future extensibility needs.

Fail-fast execution:

- Rejected because one unavailable evidence source should not prevent a usable package from being produced.

## Related Components

- `backend/src/ai/retrieval`
- `backend/src/services/retrievalService.js`
- `backend/src/controllers/retrievalController.js`
- `backend/src/routes/retrievalRoutes.js`
- `backend/src/repositories/retrievalRepository.js`
- `backend/src/database/migrations/012_hybrid_retrieval_engine.sql`

## References

- [Hybrid Retrieval Engine](../architecture/hybrid-retrieval.md)
- [Evidence Fusion](../architecture/evidence-fusion.md)
- [Retrieval Execution](../sequence/retrieval-execution.md)
- [Evidence Fusion Sequence](../sequence/evidence-fusion.md)
- [Retrieval Planner](../architecture/retrieval-planner.md)

