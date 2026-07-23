# ADR-0022 Reasoning Context Engine

## Status

Accepted

## Date

2026-07-23

## Context

CPInsight now has intent planning and hybrid retrieval. Evidence Packages contain ranked evidence, contradictions, missing evidence, confidence summaries, and retrieval statistics. Future LLM systems should not receive raw evidence directly because raw packages contain too much redundant detail and do not encode deterministic reasoning decisions.

The system needs a reasoning layer that interprets evidence, maps it to a canonical ontology, extracts findings, constructs causal chains, handles contradictions, compresses evidence, estimates confidence, and prepares provider-independent prompts without invoking an LLM.

## Decision

Implement a Reasoning Context Engine and Prompt Orchestrator.

The engine:

- maps evidence to ontology concepts
- extracts primary and secondary findings
- builds deterministic causal chains
- carries contradictions and missing evidence forward
- compresses evidence for token budgets
- emits Reasoning Contexts
- emits provider-independent Prompt Packages
- persists contexts, packages, metrics, ontology versions, templates, and compression metrics

## Consequences

Positive consequences:

- Future LLM calls receive prepared, grounded context instead of raw evidence.
- Findings are auditable because every finding references ontology concepts and evidence IDs.
- Prompt Packages are provider-independent and reusable across future providers.
- Token-budget trimming is deterministic and recorded.

Negative consequences:

- Causal reasoning is template-based and less expressive than a learned causal model.
- Ontology mappings require maintenance as new behavioral concepts are added.
- The prompt package is not provider-optimized until future provider adapters exist.

## Alternatives Considered

Pass Evidence Packages directly to an LLM:

- Rejected because it would offload evidence interpretation to a nondeterministic model and weaken auditability.

Use an LLM to extract findings:

- Rejected because Phase 3.4C explicitly ends before LLM invocation.

Use free-form behavioral labels:

- Rejected because downstream systems need stable ontology-backed concepts for analytics, retrieval, and prompt grounding.

Provider-specific prompt formatting now:

- Rejected because provider execution is not implemented yet and would prematurely couple context generation to one model API.

## Related Components

- `backend/src/ai/reasoning`
- `backend/src/services/reasoningService.js`
- `backend/src/controllers/reasoningController.js`
- `backend/src/routes/reasoningRoutes.js`
- `backend/src/repositories/reasoningRepository.js`
- `backend/src/database/migrations/013_reasoning_context_engine.sql`

## References

- [Behavior Ontology](../architecture/behavior-ontology.md)
- [Reasoning Context Engine](../architecture/reasoning-context-engine.md)
- [Prompt Orchestration](../architecture/prompt-orchestration.md)
- [Reasoning Pipeline](../sequence/reasoning-pipeline.md)
- [Prompt Generation](../sequence/prompt-generation.md)
- [Hybrid Retrieval](../architecture/hybrid-retrieval.md)

