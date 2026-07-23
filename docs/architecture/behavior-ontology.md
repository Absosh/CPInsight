# Behavior Ontology

The Behavior Ontology is the canonical vocabulary used by the Reasoning Context Engine. Findings reference ontology concepts instead of free-form behavioral labels.

## Versioning

The implemented ontology version is `1`. Ontology rows are persisted through `ontology_versions` for future migration and audit workflows.

## Categories

| Category | Concepts |
| --- | --- |
| Cognitive Behaviors | `deep_reading`, `fast_recognition`, `decision_delay`, `hesitation`, `problem_decomposition`, `pattern_recognition` |
| Contest Strategies | `risk_taking`, `difficulty_escalation`, `difficulty_avoidance`, `time_allocation`, `recovery_strategy`, `submission_strategy` |
| Learning Behaviors | `rapid_improvement`, `plateau`, `regression`, `consistency`, `topic_mastery` |
| Psychological Signals | `confidence`, `panic`, `persistence`, `focus`, `fatigue` |
| Behavioral Weaknesses | `graph_hesitation`, `dp_avoidance`, `implementation_errors`, `time_mismanagement`, `stress_response`, `conceptual_weakness` |

## Mapping

Evidence rows are mapped through stable identifiers:

- `payload.insight_key`
- `payload.feature_name`
- `payload.featureName`
- `payload.pattern_key`
- `payload.node_key`
- evidence identifier and type

Unmatched evidence maps to `unmapped_behavior` so uncertainty is explicit.

