# ADR-0024 LLM Runtime Engine

## Status

Accepted

## Date

2026-07-23

## Context

CPInsight now has deterministic planning, retrieval, reasoning, prompt packaging, and AI task orchestration. The next boundary is model invocation. Runtime execution must remain provider-agnostic and must not absorb response validation, hallucination detection, citation injection, memory, tools, or agent workflows.

## Decision

Implement an LLM Runtime Engine with:

- provider adapter registry
- provider-independent model registry
- model selection engine
- request builder
- streaming collector
- retry engine
- failover engine
- rate limiter
- token accounting
- cost accounting
- runtime observability
- internal authenticated APIs
- persistence for provider/model/request/usage/metrics metadata

## Consequences

Positive consequences:

- Providers are isolated behind one contract.
- Model selection is deterministic and auditable.
- Runtime failures can retry and fail over without mutating execution plans.
- Usage and cost are tracked per provider and model.

Negative consequences:

- Provider request translations require maintenance as provider APIs evolve.
- Actual provider invocation depends on external credentials and availability.
- Raw responses are not validated in this phase.

## Alternatives Considered

Single-provider runtime:

- Rejected because CPInsight needs failover and future provider independence.

Validate responses in the runtime:

- Rejected because validation, grounding verification, citation injection, and hallucination detection belong to Phase 3.5B.

Persist raw prompts and completions:

- Rejected for privacy and security. Runtime persistence stores metadata, usage, and accounting only.

## Related Components

- `backend/src/ai/runtime`
- `backend/src/services/runtimeService.js`
- `backend/src/controllers/runtimeController.js`
- `backend/src/routes/runtimeRoutes.js`
- `backend/src/repositories/runtimeRepository.js`
- `backend/src/database/migrations/015_llm_runtime_engine.sql`

## References

- [LLM Runtime Engine](../architecture/llm-runtime.md)
- [Provider Registry](../architecture/provider-registry.md)
- [Model Selection](../architecture/model-selection.md)
- [Runtime Observability](../architecture/runtime-observability.md)
- [Runtime Execution](../sequence/runtime-execution.md)
- [Provider Failover](../sequence/provider-failover.md)

