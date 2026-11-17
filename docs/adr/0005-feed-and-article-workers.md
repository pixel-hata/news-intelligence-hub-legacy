# ADR 0005: Feed And Article Workers

## Status

Accepted.

## Context

Feed polling, article processing, LLM analysis, regeneration, and digests are
long or expensive operations. The specification requires these operations to run
through queues so the UI and API remain responsive.

## Decision

Use BullMQ queues for feed polling and article processing. The feed worker fetches
RSS/Atom feeds, records feed errors in feed status, stores discovered articles,
and enqueues article-processing jobs. The article worker runs deterministic
pre-filtering and exact content deduplication before any LLM call, then applies
validated semantic analysis from the configured LLM adapter.

## Alternatives

The simpler alternative was doing feed validation and article analysis inside API
requests. That would make the first demo easier but would violate the async
boundary and create timeout/cost-control risk.

## Trade-Offs

The queued design adds Redis/BullMQ setup and more moving parts. In return, work
is observable, retryable, rate-limited, and aligned with the acceptance
walkthrough.
