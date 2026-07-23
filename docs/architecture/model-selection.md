# Model Selection

The Model Selection Engine selects a provider-independent model for an AI Execution Plan.

## Model Metadata

Each model exposes:

- name
- provider
- context window
- streaming support
- JSON support
- tool support
- vision support
- max output tokens
- pricing
- status

## Selection Signals

Automatic selection considers:

- manual overrides
- required context size
- output schema requirements
- reasoning mode
- provider health
- circuit breaker state
- context window
- pricing
- provider priority

Manual overrides require both provider and model.

