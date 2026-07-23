# ADR-0020 Intent Classification and Retrieval Planner

## Status

Accepted

## Date

2026-07-23

## Context

CPInsight now has telemetry ingestion, processing, event distribution, behavior features, and a behavior knowledge graph. The next architectural step toward AI assistance is not an LLM call. The system first needs a deterministic planning layer that decides what evidence would be needed to answer a question.

Without this layer, future retrieval, prompt construction, recommendation, and RAG systems would each duplicate intent detection and evidence selection logic. That would make answers inconsistent and make safety boundaries harder to audit.

Constraints:

- Do not redesign existing telemetry, event, realtime, behavior intelligence, or behavior knowledge systems.
- Do not perform retrieval in this phase.
- Do not implement vector search, embeddings, prompt generation, chat, recommendations, or LLM calls.
- Persist plans and planner metrics without storing raw natural-language question text.

## Decision

Implement a rule-based Intent Classification and Retrieval Planning Engine.

The engine includes:

- Intent taxonomy.
- Deterministic classifier.
- Retrieval source registry.
- Retrieval strategy registry.
- Plugin planning rules.
- Retrieval plan merger.
- Internal authenticated APIs.
- Persistence for classifications, plans, rule versions, and metrics.

The planner outputs structured retrieval plans containing intents, required evidence, selected sources, selected strategies, confidence requirements, evidence sufficiency, token budget estimates, latency/cost estimates, and execution priority.

## Consequences

Positive consequences:

- Future retrieval engines can consume plans instead of reclassifying questions.
- The system can audit why a source or strategy was selected.
- Rule plugins preserve the Open/Closed Principle for new planning behavior.
- Question hashes support observability without storing raw question text.

Negative consequences:

- Rule-based classification is less flexible than model-based classification.
- Keyword weights must be maintained as product language evolves.
- Evidence sufficiency is provisional because actual retrieval does not occur in this phase.

Future implications:

- A future LLM classifier can be evaluated against this deterministic baseline.
- Vector stores and conversation memory can be activated as sources without changing plan consumers.
- Retrieval engines should treat the plan as the contract and report execution evidence back separately.

## Alternatives Considered

LLM-based intent classification:

- Rejected for this phase because the LLM layer does not exist and deterministic planning is needed as a stable safety boundary.

Direct retrieval from the chat endpoint:

- Rejected because it couples user interaction, retrieval policy, and evidence selection too early.

Hardcoded source selection inside controllers:

- Rejected because it would violate Separation of Concerns and block new source/strategy registration.

Storing raw questions:

- Rejected because the planner only needs hashes for idempotency, observability, and metrics in this phase.

## Related Components

- `backend/src/ai/planner`
- `backend/src/services/plannerService.js`
- `backend/src/controllers/plannerController.js`
- `backend/src/routes/plannerRoutes.js`
- `backend/src/repositories/plannerRepository.js`
- `backend/src/database/migrations/011_intent_retrieval_planner.sql`

## References

- [Intent Classification](../architecture/intent-classification.md)
- [Retrieval Planner](../architecture/retrieval-planner.md)
- [Question Planning](../sequence/question-planning.md)
- [Retrieval Plan Generation](../sequence/retrieval-plan-generation.md)
- [Behavior Knowledge Layer](../architecture/behavior-knowledge.md)

