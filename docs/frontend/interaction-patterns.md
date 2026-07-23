# AI Coach Interaction Patterns

The AI Coach Workspace exposes product interactions without embedding backend AI logic.

## Conversation

- Submit question.
- Display planning and evidence retrieval progress as streaming status text.
- Abort active generation.
- Retry failed message.
- Regenerate completed response.
- Copy response.
- Export response into workspace saved reports.

## Evidence

Evidence interactions are handled through the design-system `EvidenceExplorer` and `EvidenceCard` composition:

- expand and collapse citations;
- inspect evidence;
- open timeline;
- filter evidence by type.

## Reasoning

Reasoning uses `ReasoningPanel`:

- progressive disclosure with native `details`;
- reasoning chain display;
- primary and secondary findings;
- contradictions;
- missing evidence;
- confidence and grounding context.

## Recommendations

Recommendation actions are tracked in workspace state:

- accept;
- dismiss;
- save;
- complete;
- remind later.

These actions do not mutate backend evidence. Future APIs can persist them as user preference or task state.

## Search

Workspace search covers:

- sessions;
- reflections;
- recommendations;
- evidence.

Search is implemented as client-side filtering over already-loaded workspace state. It does not perform backend retrieval.
