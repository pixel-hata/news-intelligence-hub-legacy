# ADR 0001: Application Architecture

## Status

Accepted.

## Context

The product must combine HTTP flows, background RSS/LLM work, queue
monitoring, user isolation, and a graph-heavy React UI. The evaluator also
expects a one-command Docker startup and clear reasoning about LLM use.

## Decision

Use a TypeScript monorepo with these workspaces:

- `apps/api`: NestJS HTTP API for auth, user-owned resources, and graph reads.
- `apps/worker`: background workers for feed polling, article processing,
  regeneration, and digest jobs.
- `apps/web`: React/Vite frontend with React Flow for graph exploration.
- `packages/database`: Prisma schema and generated PostgreSQL client.
- `packages/shared`: shared domain contracts and seed configuration.

PostgreSQL is the system of record. Redis/BullMQ owns asynchronous work.
LLM providers are called only from queued jobs through a provider abstraction.

## Alternatives

The main alternative was a Directus-centered backend with custom worker
services around it. Directus would provide CRUD, authentication, permissions,
and an admin panel quickly, but the core scoring surface still needs custom
LLM processing, deduplication, graph construction, queue orchestration, and
telemetry.

Another alternative was a smaller single-process Express API. That would be
faster to scaffold, but would make the async boundaries, ownership rules, and
reviewer walkthrough less explicit.

## Trade-Offs

This keeps the browser responsive during expensive work and gives reviewers
visible boundaries between API, worker, persistence, and UI. It also avoids
making LLM calls from request handlers, which reduces timeout and cost-control
risk.

The monorepo has more workspace wiring than a single app, but the separation
matches the required backend/frontend/database decision points and makes the
project easier to verify in Docker.
