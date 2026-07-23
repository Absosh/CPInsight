# Runtime Observability

Runtime observability records provider, request, token, cost, and failure behavior without storing raw prompts or completions.

## Metrics

Tracked fields include:

- provider latency
- request latency
- streaming latency
- retries
- failures
- fallbacks
- token usage
- cost
- cancellation
- queue length
- circuit breaker state

## Accounting

Token accounting tracks:

- estimated prompt tokens
- actual prompt tokens
- completion tokens
- cached tokens
- total tokens
- budget usage

Cost accounting tracks:

- estimated cost
- actual cost
- provider
- model

