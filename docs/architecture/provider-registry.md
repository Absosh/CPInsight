# Provider Registry

The Provider Registry owns provider adapter registration and health reporting.

## Provider Contract

```text
initialize()
supportsModel()
listModels()
estimateTokens()
estimateCost()
buildRequest()
invoke()
stream()
health()
cancel()
destroy()
```

Implemented adapters:

- OpenAI
- Anthropic
- Google Gemini
- Azure OpenAI
- Ollama
- vLLM
- OpenRouter

Provider credentials are read from environment variables when invoked. Missing credentials mark remote providers as unconfigured instead of breaking application startup.

## Security

Provider keys must not be logged, persisted in request metadata, included in prompt packages, or exposed through health endpoints.

