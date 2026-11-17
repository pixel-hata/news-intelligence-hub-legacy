# ADR 0004: LLM Provider Contract

## Status

Accepted.

## Context

Article analysis needs OpenAI and Anthropic support, a mock mode for local demo,
structured output validation, cache keys, and telemetry. Provider calls must not
appear in HTTP handlers.

## Decision

Use an internal `LlmAdapter` interface in the worker. The active provider is
selected through env. The mock adapter is deterministic and needs no secrets.
The OpenAI adapter calls the Responses API with a JSON schema response format.
The Anthropic adapter calls the Messages API with a forced tool schema. All
provider results are validated locally before database writes.

Provider failover is available through `LLM_FAILOVER_ENABLED` and
`LLM_FALLBACK_PROVIDERS`. The worker tries the primary adapter first, logs
provider failures with article context, and continues through configured
fallback adapters before marking the job failed.

## Alternatives

The main alternative was using a high-level LLM orchestration framework. That
would add hidden behavior and make cost control harder to explain.

## Trade-Offs

Direct REST calls require more local code, but the request shape, validation,
timeouts, cache keys, and telemetry stay visible and testable.

Failover adds a small orchestration layer, but keeps the provider boundary
explicit and avoids moving retry/fallback logic into HTTP handlers.
