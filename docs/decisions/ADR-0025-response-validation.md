# ADR-0025 Response Validation and Grounding Layer

## Status
Accepted

## Date
2026-07-23

## Context

Phase 3.5A introduced provider-agnostic LLM invocation and intentionally returned raw provider responses. Raw responses are not safe as canonical AI Coach output because providers may return malformed JSON, unsupported claims, fabricated citations, overconfident conclusions, unsupported recommendations, or inconsistent structures.

The existing deterministic pipeline already produces Retrieval Plans, Evidence Packages, Reasoning Contexts, Prompt Packages, and AI Execution Plans. The validation layer therefore needed to protect that deterministic evidence chain without redesigning retrieval, reasoning, task orchestration, or runtime invocation.

Alternatives considered included accepting provider JSON directly, relying on prompt instructions alone, performing validation inside provider adapters, and storing reflections from raw model output. Each alternative either weakened auditability or coupled safety checks to provider-specific runtime behavior.

## Decision

CPInsight uses a dedicated AI Quality Layer after runtime invocation. The layer normalizes provider output into one canonical response schema, validates schema and grounding, checks citations and recommendations, aligns confidence with deterministic evidence, evaluates response quality, generates validated reflection objects, and stores feedback metrics.

The layer is provider-independent and deterministic. It consumes:

- AI Execution Plan
- Reasoning Context
- Evidence Package
- Raw LLM Response

It produces:

- Validated AI Coach Response
- Validation Report
- Quality Report
- Behavior Reflections

## Consequences

Positive consequences:

- Raw provider output cannot bypass grounding checks.
- Fabricated citations are detected before response acceptance.
- Recommendations require evidence support.
- Reflections are stored only after validation.
- Feedback can improve future routing and evaluation metrics without mutating evidence.
- Provider adapters remain focused on invocation.

Negative consequences and trade-offs:

- Some useful free-form provider responses may be rejected or downgraded if they do not cite evidence.
- Validation adds another persistence and API layer.
- Deterministic validators cannot detect every subtle semantic contradiction without future deeper reasoning.
- Regeneration is planned but not executed in this phase.

## Alternatives Considered

- Prompt-only safety: rejected because prompt instructions cannot guarantee grounded output.
- Provider-specific validation: rejected because it would couple safety logic to adapter implementations.
- Directly storing raw model reflections: rejected because unsupported reflections would become future retrieval evidence.
- Human review before storage: rejected for normal runtime because it would block automation and does not scale.

## Related Components

- LLM Runtime Engine
- Response Normalizer
- Grounding Validator
- Citation Validator
- Recommendation Validator
- Quality Evaluator
- Reflection Memory
- Human Feedback
- Quality Repository

## References

- [Response Validation](../architecture/response-validation.md)
- [Grounding Engine](../architecture/grounding-engine.md)
- [Quality Evaluation](../architecture/quality-evaluation.md)
- [Reflection Memory](../architecture/reflection-memory.md)
- [Human Feedback](../architecture/human-feedback.md)
- [Validation Pipeline Sequence](../sequence/validation-pipeline.md)
