# ADR-0023 AI Task Orchestrator

## Status

Accepted

## Date

2026-07-23

## Context

Prompt Packages are provider-independent and grounded, but they do not decide what kind of AI work should be performed. A diagnostic question, a contest reflection, a coaching request, and an evidence explanation require different response schemas, reasoning modes, prompt strategies, evaluation rules, and safety policies.

The system needs a deterministic layer that plans the future LLM execution without invoking a model.

## Decision

Implement an AI Task Orchestrator with:

- plugin-based AI task registry
- prompt strategy registry
- output schema registry
- safety policy engine
- evaluation policy engine
- deterministic task routing
- task chaining
- immutable AI Execution Plans
- internal authenticated APIs
- persistence for task metadata, strategies, schemas, policies, execution plans, and execution metrics

## Consequences

Positive consequences:

- Future LLM runtime can execute a prepared plan instead of deciding task policy dynamically.
- Task routing is auditable and deterministic.
- Safety and evaluation policies are attached before model execution.
- New tasks and strategies can be registered without redesigning the orchestrator.

Negative consequences:

- Rule-based routing requires maintenance as user language evolves.
- Task chains are deterministic heuristics, not learned workflow plans.
- Output schemas are contracts for future execution and are not yet validated against model output.

## Alternatives Considered

Let the LLM choose the task:

- Rejected because this would make safety policy and schema selection nondeterministic.

Hardcode task routing in controllers:

- Rejected because it would couple HTTP handling to AI planning logic.

Execute prompts immediately:

- Rejected because Phase 3.4D ends at AI Execution Plan generation.

## Related Components

- `backend/src/ai/tasks`
- `backend/src/services/taskService.js`
- `backend/src/controllers/taskController.js`
- `backend/src/routes/taskRoutes.js`
- `backend/src/repositories/taskRepository.js`
- `backend/src/database/migrations/014_ai_task_orchestrator.sql`

## References

- [AI Task Orchestrator](../architecture/task-orchestrator.md)
- [Prompt Strategy Engine](../architecture/prompt-strategy-engine.md)
- [Output Schema Registry](../architecture/output-schema-registry.md)
- [Safety Policy Engine](../architecture/safety-policy-engine.md)
- [Task Routing](../sequence/task-routing.md)
- [Execution Plan Generation](../sequence/execution-plan-generation.md)

