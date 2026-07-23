# Evidence Fusion

Evidence Fusion normalizes retrieved source results into one ranked, contradiction-aware Evidence Package. It is deterministic and independent from any LLM.

## Fusion Pipeline

```mermaid
flowchart LR
  Raw["Raw Source Evidence"] --> Normalize["Normalize identifiers, timestamps, confidence, versions"]
  Normalize --> Dedupe["Deduplicate by source/type/id/version"]
  Dedupe --> Rank["Rank Evidence"]
  Rank --> Contradictions["Detect Contradictions"]
  Contradictions --> Resolve["Resolve / Ignore / Needs Review"]
  Resolve --> Package["Evidence Package"]
```

## Normalized Evidence

Each evidence row includes:

- `evidenceId`
- `source`
- `type`
- `identifier`
- `confidence`
- `timestamp`
- `version`
- `relationshipDistance`
- `payload`
- `references`
- `rankScore`

## Ranking Algorithm

Evidence is ranked with a weighted score:

| Signal | Purpose |
| --- | --- |
| Confidence | Prefer high-confidence source evidence |
| Freshness | Prefer recent evidence when relevance is otherwise similar |
| Planner priority | Prefer sources selected earlier by the Retrieval Planner |
| Evidence density | Prefer evidence types with multiple supporting rows |
| Relationship distance | Prefer closer graph relationships |
| Source reliability | Prefer healthier, more reliable adapters |

The score is deterministic. Ties are broken by confidence and evidence identity.

## Contradiction Resolution

The current implementation detects conflicting numeric feature values when evidence for the same feature differs by at least `0.5`.

Output categories:

- `resolvedEvidence`: ranked evidence after low-confidence conflicting rows are ignored.
- `ignoredEvidence`: low-confidence conflicting evidence excluded from the resolved set.
- `contradictions`: conflict records requiring review when both sides have high confidence.

This phase does not attempt natural-language explanation of contradictions.

## Evidence Package

An Evidence Package contains:

- package and plan identifiers
- question hash
- retrieval metadata
- retrieved source summaries
- resolved evidence
- ignored evidence
- contradictions
- confidence summary
- missing evidence
- retrieval and fusion statistics

The package is immutable at the engine boundary and ready for future context construction.

