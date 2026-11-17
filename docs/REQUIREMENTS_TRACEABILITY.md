# Requirements Traceability Review

Source reviewed: official UA-Skills tournament page, the local saved page, the
local extracted structured specification, event metadata bundle, and the
submission-form screenshot.

This document is an implementation checklist. It summarizes requirements in our
own words and intentionally avoids copying raw task text into the submitted
repository.

## Project Summary

Build a multi-user News Intelligence Hub. A confirmed user adds RSS/Atom feeds,
the system polls them through workers, stores discovered articles, applies
deterministic filtering and deduplication, uses an LLM only for semantic
analysis, and exposes the result through a responsive article feed, entity
views, graph exploration, settings, regeneration, digests, telemetry, and queue
monitoring.

The highest-risk interpretation is that the scoring table is not separate from
the specification. Architecture, code quality, README/ADR, and UI together
outweigh raw feature count, so the project must stay explainable, testable,
observable, and easy to run.

## Hidden And Cross-Section Requirements

| Source area | Requirement derived by reading sections together | Implementation impact |
| --- | --- | --- |
| Intro + penalties | Do not paste raw specification fragments into README/source; avoid generated-looking artifacts and unexplained code. | Keep source extracts local and ignored; write project docs in our own words. |
| US-3 + persistence model | Deleting a feed must detach already processed articles from the live source, not delete articles. | Article `feedId` must be nullable with `onDelete: SetNull`. |
| US-5 + FR-8 + scoring | Axes are user-editable examples, not hardcoded constants. | Seed 4-5 axes per user, store labels in DB, expose CRUD/UI. |
| US-6 + FR-9 + FR-10 | Regeneration is a queued operation with progress, cache reuse, concurrency limits, and telemetry. | Axis changes enqueue jobs; worker checks cache before LLM calls. |
| US-7 + FR-4 + FR-5 | The article feed must show filtered articles and similar-count data, not only successfully processed articles. | Preserve filtered status and duplicate groups in DB/API/UI, with reviewer-visible filters and article detail. |
| US-9 + FR-7 examples | Graph nodes are article/entity; required edge types are mentions and co-mention, with similar as optional. | Keep category as a filter, not a graph node type in the MVP graph contract. |
| US-10 + FR-6 examples | Entity view needs aliases, mention article ids, co-mentions, and first/last seen activity. | Store aliases and first/last seen timestamps or compute them reliably. |
| Scope + Should list | Period digests appear in product scope and FR-11, while marked Should in priority list. | Treat digests as a high-score requirement after Must path works. |
| Scope boundary | Mobile app is explicitly outside MVP, but future clients should not require backend rewrites. | API remains client-neutral; optional Flutter Android client now reuses the same endpoints. |
| Stack + NFR-4 | TypeScript and Tailwind are mandatory; Google TS style must be linted. | Add Tailwind, keep lint config active, avoid dead placeholders. |
| Principles + FRs | LLM calls are forbidden in HTTP handlers and in deterministic tasks. | LLM only inside BullMQ worker pipeline. |
| Principle 5 + gate | `docker compose up` must bring up DB, Redis, API, frontend, workers, Bull Board, migrations, and demo data. | Compose runs migrations and the demo seed before API/worker startup; README documents the one-command path. |
| NFR-3 + US-1 | Unconfirmed accounts cannot use protected functionality. | Login denied until confirmation; frontend must surface DEV MODE confirmation. |
| NFR-5 + scoring | Meaningful tests are not Must, but code-quality scoring makes them important. | Implemented focused API/worker tests for pre-filtering, RSS/Atom parsing, URL discovery dedupe, exact duplicate groups, LLM validation/failover, and user isolation. |
| NFR-6 + submission | Git history is a deliverable. | Continue small commits and pushes; avoid squashing. |
| 9.2 + 9.4 | Demo data is effectively required so the graph can be evaluated quickly. | Provide seed script/demo feed and document it. |

## Requirement Matrix

| Area | Required behavior | Current status |
| --- | --- | --- |
| Delivery | Private GitHub repo with meaningful history and reviewer access at the end. | Done for repo/history; reviewer access remains final step. |
| Stack | Node, TypeScript, React/Next, Tailwind, NestJS/Directus, Postgres/MySQL, Redis/BullMQ, React Flow, Docker Compose. | Done with React/Vite instead of Next, which is allowed. Bull Board is exposed at `/admin/queues`. |
| Auth | Register, dev email confirmation, login, logout, session persistence. | Done for local demo flow with JWT persistence and DEV confirmation token. |
| Multi-user isolation | All user-owned resources scoped by user at data-access level. | Implemented across current resource APIs with service-level tests for article/feed direct-id scoping. |
| Feeds | CRUD, status, RSS/Atom validation, pause/resume/delete, manual and scheduled polling. | Implemented with manual/scheduled BullMQ polling, parser, status/error fields, feed-delete article detachment, and UI status/delete controls. |
| Categories | User CRUD, no LLM involvement. | API and Settings UI create/edit/delete implemented. |
| Axes | 4-5 seeds, editable labels, stored in DB, used by LLM. | API, Settings UI create/edit/delete/enable-disable, seed data, and LLM input integration implemented. |
| Article pipeline | Poll feed, normalize URL/content, deterministic pre-filter, cache, one LLM semantic pass, graph update. | Implemented through worker pipeline; graph is computed from stored article/entity relations. |
| LLM abstraction | Own interface, OpenAI and Anthropic adapters, env provider/model, structured output validation. | Implemented with mock/OpenAI/Anthropic providers, schema validation, cache, call telemetry, and env-enabled failover. |
| Deduplication | URL hash, content hash, entity alias matching, similar count. | Partial: URL uniqueness and exact content-hash duplicate groups are implemented and tested. Entity alias matching and semantic similarity pending. |
| Article feed | Filter by category/feed/importance/status/period, show article summary, source, categories, axes, entities, and similar articles. | Implemented in the feed tab with local filters, text search, and `GET /api/articles/:id` detail panel. |
| Graph | React Flow article/entity graph with typed edges and filters by node type/category. | API and React Flow screen implemented with category/node-type filters, text search, time-window filter, node detail panel, and JSON export of the filtered graph. |
| Entity card | Type, description, aliases, mentioning articles, related entities, activity over time. | Entity detail panel exposes type, description, aliases, first/last-seen data from API, and mentioning articles. Related entity counts can still be expanded. |
| Regeneration | Queued axis regeneration with progress, cache reuse, graph rebuild. | Implemented as `POST /api/axes/regenerate`, BullMQ worker, queue logs, and article reprocessing. |
| Digests | Queued period digest with deterministic aggregation and LLM summary. | Implemented as deterministic queued period digest; LLM-written digest summary remains optional. |
| Queue monitoring | Bull Board or equivalent, basic-auth from env, admin link controlled by env. | Bull Board route added at `/admin/queues`; reviewer uses direct URL and credentials from `.env`. |
| Observability | Structured logs, worker operation context, LLM telemetry aggregates. | Implemented for workers, queue job logs, LLM calls, metric cards, and top category/entity aggregates. |
| Security | bcrypt/argon2 passwords, JWT/sessions, env-only secrets, denied cross-user direct IDs. | Partial: bcrypt + JWT + scoped CRUD with service-level user isolation tests. Env docs can still be tightened. |
| Documentation | README runbook, ADR minimum 5 decisions, structure, demo data, Should/Could status. | README, submission docs, traceability doc, acceptance walkthrough, and 7 ADRs are present; startup docs now describe automatic Compose seeding. |
| Optional mobile | Native mobile app is outside the gate but can add bonus value if Must scope remains intact. | Flutter Android app added under `apps/mobile` with login, feed, article detail, graph/entity overview, digests, and explicit push stub. |
| Gate | Clean `docker compose up`, frontend reachable, acceptance walkthrough passes. | Compose build/up, API health, web, Bull Board auth, demo seed, login, digests, regeneration, and browser walkthrough were validated on 2026-05-26. |

## Current Work Assessment

The chosen direction matches the project: a TypeScript monorepo with a NestJS
API, React/Vite frontend, worker process, Prisma/PostgreSQL, Redis/BullMQ, and
Docker Compose directly maps to the required architecture and stack.

The implementation now covers the main acceptance path: auth, user-scoped feed
settings, RSS polling, article processing, LLM abstraction, entity extraction,
graph view, queue monitoring, regeneration, digests, demo seeding, browser
walkthrough, focused API/worker tests, extended Should filters, and an optional
native Android client.

## Implementation Priority From Here

1. Keep the final reviewer path focused on Docker web/API startup.
2. Use the Flutter app as optional bonus evidence, not as a gate dependency.
3. Add `skills-reviewer` read access and submit the GitHub URL through the form.
