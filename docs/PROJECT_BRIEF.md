# Project Brief

## Goal

Build a production-style MVP for `News Intelligence Hub`: a web application that turns RSS/Atom feeds into a searchable, categorized news graph.

## Required Product Surface

- User registration, dev-mode email confirmation, login and logout.
- Per-user feed, category, axis, article and graph isolation.
- Feed CRUD with validation and status.
- Category CRUD.
- Categorization-axis CRUD with seeded examples.
- Scheduled and manual RSS polling through a background worker.
- Article processing through a queued pipeline.
- Deterministic pre-filter before any LLM call.
- Internal LLM abstraction with OpenAI and Anthropic adapters.
- Article and entity deduplication.
- Cost control and LLM telemetry.
- Article feed with filters and detail cards.
- Entity detail view.
- Interactive React Flow graph.
- Axis regeneration flow.
- Bull Board or equivalent queue monitoring.
- Docker Compose startup.
- README with Architectural Decisions.

## Delivery Strategy

Keep Must requirements first. Add Should/Could items only after the acceptance walkthrough is already passable.

Architecture, code quality, and documentation together outweigh raw feature count, so each implementation step should leave the system explainable and clean.

## Reuse Candidates To Review

The existing `ai-news-system-web-private` project may provide UI/state ideas and news-reader domain vocabulary. Direct reuse is expected to be limited because that project is Flutter-based while this event requires React/TypeScript/Tailwind.

The broader AI News System workspace may provide reusable thinking for RSS normalization, article deduplication, heuristic filtering, evaluation, and knowledge extraction. Code should be ported only when it fits the new TypeScript architecture and competition constraints.
