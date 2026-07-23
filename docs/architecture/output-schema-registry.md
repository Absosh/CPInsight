# Output Schema Registry

The Output Schema Registry provides structured response schemas for future LLM runtimes. Schemas are selected during AI Execution Plan generation.

## Implemented Schemas

| Schema | Fields |
| --- | --- |
| Diagnostic | `problem`, `causes`, `evidence`, `confidence`, `recommendations` |
| Reflection | `summary`, `successes`, `mistakes`, `lessons`, `nextActions` |
| Comparison | `contestA`, `contestB`, `differences`, `trends`, `evidence` |
| Roadmap | `goal`, `currentState`, `milestones`, `practicePlan`, `confidence` |
| Explanation | `claim`, `observations`, `inferences`, `evidence`, `uncertainty` |
| Summary | `summary`, `keyPoints`, `evidence`, `uncertainty` |

The registry is provider-independent and does not validate model output because model execution is not implemented in this phase.

