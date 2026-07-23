# Safety Policy Engine

The Safety Policy Engine attaches deterministic safety and evaluation policies to AI Execution Plans.

## Safety Policies

Core grounding policy:

- Never fabricate evidence.
- Never recommend unsupported improvements.
- Always expose uncertainty.
- Separate observations, inferences, and recommendations.
- Cite evidence identifiers for every behavioral claim.

Task-specific policies extend the core policy for coaching and prediction tasks.

## Evaluation Policies

Evaluation policies define future quality checks. Examples:

- Evidence coverage.
- Reasoning completeness.
- Confidence threshold.
- Historical consistency.
- Actionability.
- Personalization.
- Milestone quality.
- Goal alignment.
- Feasibility.

Policies are attached to execution plans but are not used to score model output until a future LLM runtime exists.

