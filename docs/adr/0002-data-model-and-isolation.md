# ADR 0002: Data Model and User Isolation

## Status

Accepted.

## Context

The system is multi-user. Feeds, articles, categories, axes, entities, graph
edges, LLM cache entries, telemetry, and digests must not leak across users.

## Decision

Every user-owned table carries `userId` and has indexes scoped by user.
Uniqueness constraints that may overlap between users are also scoped by
`userId`, including feed URLs, normalized article URLs, category names,
categorization axes, entity names, graph edges, and LLM cache keys.

## Alternatives

One alternative was a shared global article/entity pool with user-specific
subscriptions. That can reduce storage duplication, but it makes privacy,
deletion, duplicate handling, and reviewer isolation harder to reason about.

Another alternative was enforcing ownership only in service code while keeping
database constraints global. That is simpler at first, but allows accidental
cross-user conflicts and increases leak risk.

## Trade-Offs

Repository methods can enforce user ownership at the database query boundary.
The schema supports duplicate source URLs across different accounts while
still preventing duplicate records inside one account.

The design stores some duplicate article/entity records across users, but it
keeps the acceptance walkthrough deterministic and makes direct-ID access checks
straightforward.
