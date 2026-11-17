# ADR 0003: LLM Cost Control

## Status

Accepted.

## Context

LLM processing is required, but the task explicitly rewards deterministic
pre-filtering, caching, token limits, telemetry, and avoiding unnecessary
provider calls.

## Decision

Article processing will run in this order:

1. Normalize URL and content hashes.
2. Save discovered or filtered articles before any LLM call.
3. Run deterministic pre-filter rules for minimum text, duplicate hashes, and
   obvious junk.
4. Build a cache key from normalized prompt version, model, task, article hash,
   and active axes.
5. Call the selected provider only from the worker when no cache hit exists.
6. Persist token usage, duration, cache hits, failures, and estimated cost.

## Alternatives

One alternative was sending every discovered article to the LLM immediately.
That would simplify the worker, but it would inflate token spend and process
spam, duplicates, and empty content unnecessarily.

Another alternative was relying only on provider-side rate limits and logs.
That would leave the application without local cost evidence for the telemetry
requirements.

## Trade-Offs

The system remains demonstrable with a mock provider and can switch to OpenAI
or Anthropic through environment variables without changing the pipeline.

The local pre-filter/cache path adds more code and tests, but it makes cost,
cache hits, skipped articles, and regeneration expense visible to users and
reviewers.
