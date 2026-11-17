# Reuse Review: AI News System

## Reviewed Projects

- `G:\AI Agent System\ai-news-system-web-private`
- `G:\AI Agent System\ai-news-system`

## Summary

The previous AI News work is useful as product and pipeline reference, but it is not a suitable codebase to copy into this competition project.

`ai-news-system-web-private` is a Flutter Web client. The competition requires TypeScript, React/Next, Tailwind, React Flow, NestJS or Directus, BullMQ/Redis, Docker Compose, and a full-stack multi-user system. Directly copying Flutter/Dart code would create dead code and violate the expected stack.

The broader `ai-news-system` workspace contains better reusable thinking: RSS/Atom parsing, item normalization, URL/hash deduplication, article fetching/parsing, heuristic enrichment, and review/evaluation flow. Those ideas should be ported deliberately into TypeScript instead of copied wholesale.

## Reusable Ideas

- Feed source registry shape and seed sources.
- RSS/Atom parsing behavior.
- Item normalization: clean title/summary, normalize publication date, preserve source metadata.
- Deduplication split: stable source item id, raw hash, normalized hash.
- Heuristic pre-filter/evaluation keyword approach.
- Refresh job polling pattern.
- Feed / Saved / Knowledge / Evaluation product flow as an inspiration for UI organization.
- EN/UA interface vocabulary and language-toggle approach.

## Not Safe To Reuse Directly

- Flutter/Dart UI code.
- Old `/reader/*` API contract as-is.
- Hive local cache as a persistence model.
- File-based runtime state.
- Render/ngrok deployment assumptions.
- Empty feature folders or unused DTOs from the old app.
- Any raw challenge text in README/source.

## Decision

Start this project from a clean TypeScript monorepo.

Port selected concepts from the old system only when they map cleanly to the new architecture:

- `source intake -> normalize -> dedup -> fetch/parse -> pre-filter -> queued LLM analysis -> persist -> graph update`
- deterministic work before LLM
- explicit queued jobs for expensive/long tasks
- observable processing state

This keeps the repository aligned with the event requirements and avoids inherited architecture that would reduce the score.
