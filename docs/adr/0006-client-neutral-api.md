# ADR 0006: Client-Neutral API For Future Mobile

## Status

Accepted.

## Context

The competition explicitly keeps a native mobile application outside the MVP.
The current deliverable is a responsive web application, but a future mobile
client should be able to reuse the same backend without changing ingestion,
LLM, graph, or queue logic.

## Decision

Keep the backend as a client-neutral JSON API. Authentication returns bearer
tokens, domain data is exposed through explicit `/api/*` resources, and shared
TypeScript contracts live in `packages/shared`. The React web client consumes
the same API shape a future mobile client would use.

The current scope remains a responsive web app. Mobile-specific code,
React Native/Flutter scaffolding, app-store packaging, push notifications, and
offline sync are intentionally deferred.

## Alternatives

One alternative was adding a mobile shell during the competition. That would add
another client stack and validation surface while the scoring focuses on the
web acceptance walkthrough, workers, LLM cost control, and architecture.

Another alternative was coupling the API to web-only assumptions. That would be
faster for the current UI, but would make a future mobile app depend on web
storage and screen-specific response shapes.

## Trade-Offs

The API may look slightly more explicit than a web-only backend-for-frontend,
but it keeps the core system reusable. A later mobile app can start from auth,
feeds, articles, entities, graph, digests, and queue status endpoints without
reworking backend ownership boundaries.
