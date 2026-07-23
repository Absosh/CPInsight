# Prompt Orchestration

Prompt Orchestration converts a Reasoning Context into a provider-independent Prompt Package. It prepares the future LLM input contract but does not call any provider.

## Prompt Package

Components:

- system prompt
- developer instructions
- evidence block
- reasoning context
- output schema
- grounding rules
- citation rules
- safety rules
- response constraints
- audit metadata

## Provider Abstraction

Provider adapters are metadata-only in this phase. Registered providers:

- OpenAI
- Anthropic
- Gemini
- Local Models
- Ollama
- vLLM
- Azure OpenAI

The package remains provider-independent. Provider-specific request formatting belongs to a future phase.

## Grounding Rules

Every package requires future models to:

- never invent evidence
- never infer unsupported behavior
- distinguish observations, inferences, and recommendations
- cite evidence identifiers
- expose uncertainty

## Auditability

Prompt packages persist:

- prompt package version
- reasoning context identifier
- prompt size estimate
- context size estimate
- evidence size estimate
- grounding and citation constraints

No raw LLM responses are stored because no LLM is invoked.

