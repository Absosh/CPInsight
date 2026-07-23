# Insight Generation Sequence

Insight generation is rule-based and plugin-oriented. Rules translate numeric feature evidence into semantic insights.

```mermaid
flowchart TB
  Start["Behavior feature rows"] --> Registry["InsightRuleRegistry"]
  Registry --> Conceptual["ConceptualWeaknessRule"]
  Registry --> Recovery["RecoveryStrengthRule"]
  Registry --> Risk["RiskManagementRule"]
  Registry --> Time["TimeManagementRule"]
  Registry --> PatternRules["Pattern rules"]
  Conceptual --> InsightSet["Immutable insight set"]
  Recovery --> InsightSet
  Risk --> InsightSet
  Time --> InsightSet
  PatternRules --> InsightSet
  InsightSet --> Evidence["supportingFeatures + evidenceSessions"]
  InsightSet --> Confidence["confidence in [0, 1]"]
  InsightSet --> Target["target graph node"]
```

## Rule Examples

| Input Evidence | Emitted Insight |
| --- | --- |
| High reading time and low confidence indicator | `conceptual_weakness` |
| High persistence and high recovery rate | `strong_recovery_ability` |
| High risk appetite and late contest panic | `risk_management_weakness` |
| High attention stability and low late panic | `strong_time_management` |
| Repeated late panic observations | `repeated_late_panic` |
| Repeated difficulty avoidance observations | `difficulty_avoidance` |
| Fast problem scanning and high confidence indicator | `fast_recognition` |

## Pattern Detection

```mermaid
sequenceDiagram
  participant Service as KnowledgeService
  participant Detector as PatternDetector
  participant DB as behavior_patterns

  Service->>Detector: detect(userId, insertedInsights, windowKey)
  Detector->>Detector: group recurring pattern insights
  Detector->>Detector: calculate recurrence and confidence
  Detector-->>Service: pattern records
  Service->>DB: persist patterns
```

Pattern rows include `pattern_key`, `pattern_type`, confidence, recurrence count, first and last seen timestamps, supporting insight IDs, evidence JSON, and version.

