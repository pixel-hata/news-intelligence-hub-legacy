# UA-Skills: News Intelligence Hub - бриф, рекомендації і план

Джерела:

- `UA-SKILLS.html` - локально збережена сторінка завдання.
- `UA-SKILLS_files/index-DpOUVQlC.js.download` - локальний JS-бандл сторінки з метаданими івенту.
- `01_source_structured.md` - структурований витяг специфікації без переказу.
- `02_source_raw_text.md` - сирий текстовий витяг специфікації без переказу.
- Скріншот форми здачі від користувача.

## Рекомендації на старті

1. Створити приватний GitHub-репозиторій до початку розробки і вести роботу в ньому з першого дня. Робити невеликі змістовні коміти після кожного завершеного блоку, пушити регулярно. Один фінальний коміт або очищена історія прямо ризикують відхиленням.
2. Як базовий стек взяти NestJS + React/Vite + PostgreSQL + Prisma або TypeORM + BullMQ/Redis + Tailwind + React Flow. Це простіше пояснити в ADR, ніж Directus, і легше тримати бізнес-логіку, воркери та LLM-пайплайн під контролем.
3. Спочатку реалізувати Must-функції і acceptance walkthrough. Should/Could додавати тільки після проходження основного сценарію.
4. Усі довгі або дорогі операції одразу проводити через BullMQ: RSS polling, обробка статті, перегенерація, дайджест. Прямі LLM-виклики з HTTP-хендлерів заборонені.
5. LLM використовувати тільки для семантичних задач. Парсинг RSS, нормалізація URL, хеші, pre-filter, базова дедуплікація, агрегації і побудова графа мають бути детермінованим кодом.
6. Додати mock/dev LLM-provider для локального демо без ключів, але обов'язково реалізувати OpenAI і Anthropic adapters та перемикання через env.
7. Не копіювати сирі фрагменти специфікації у README або код. README має бути власним поясненням реалізації, запуску, ADR і фактично зроблених Should/Could.
8. Пріоритет балів: архітектура, код і README/ADR разом важать 55 балів, Must-функціональність 30. Краще менше бонусів, але чиста архітектура, зрозумілий код і повний запуск.

## Суть проекту

Потрібно реалізувати `News Intelligence Hub` - multi-user вебзастосунок для агрегації RSS/Atom-новин і перетворення їх на аналітичну систему з графом зв'язків.

Користувач додає RSS-фіди, система забирає статті, відсікає сміття дешевим pre-filter, обробляє зміст через LLM, видобуває сутності, самарі, важливість, категорії й осі категоризації, виконує дедуплікацію статей і сутностей, показує стрічку, картки статей/сутностей, граф зв'язків, перегенерацію після зміни осей, дайджести та моніторинг черг.

MVP включає: auth, ізоляцію користувачів, RSS polling, LLM-пайплайн, graph UI, settings, Bull Board, Docker Compose, README з ADR.

Поза MVP: соціальний граф, шеринг фідів, push/email/telegram notifications, мобільний застосунок, платіжна функціональність, ML-моделі на користувацьких даних. Експорт CSV/JSON зазначений як опціональний бонус.

## Як здавати

За специфікацією: рішення здається як закритий Git-репозиторій на GitHub / GitLab / Bitbucket. На момент здачі репозиторій має містити повну історію розробки. Після закриття вікна приймання треба додати перевіряльника з read-доступом.

За скріншотом форми: форма очікує посилання на роботу у форматі GitHub і прямо просить додати в проект для перевірки акаунт `https://github.com/skills-reviewer`.

Практичний висновок: для цього івенту найбезпечніше створити приватний GitHub repo, вести всю роботу в ньому, регулярно commit/push, у фіналі вставити посилання на repo у Google Form і додати `skills-reviewer` з read access.

Форма здачі, знайдена в локальному JS-бандлі: `https://forms.gle/PH28tBijBAVuwZC96`.

## Кроки робіт

1. Підготовка репозиторію: приватний GitHub repo, базовий README skeleton, `.gitignore`, workspace structure, Docker Compose skeleton, перший коміт.
2. Архітектурний каркас: вибір NestJS/Directus, React/Next, PostgreSQL/MySQL; ADR draft; env strategy; logging strategy.
3. База і доменна модель: users, feeds, articles, entities, categories, axes, labels, graph edges, LLM telemetry, queue jobs.
4. Auth: registration, dev email confirmation link, login/logout, session/JWT, user isolation checks.
5. Feeds: CRUD, RSS/Atom validation, feed statuses, manual polling, scheduled polling через BullMQ.
6. Article pipeline: content extraction, status model, deterministic pre-filter, content hash, URL normalization, cache key.
7. LLM layer: provider-independent interface, OpenAI adapter, Anthropic adapter, structured output validation, errors/timeouts, token/call telemetry.
8. Deduplication: exact URL, content hash, semantic/alias-aware entity matching, duplicate counters, normalized entity records.
9. UI feed: article list, filters, statuses, summaries, entity/category chips, duplicate counters, article card.
10. Graph: React Flow nodes for articles/entities, typed edges, filters by node type/category, side panel details, entity card/page.
11. Settings and regeneration: category CRUD, axes CRUD with 4-5 seeds, background regeneration, progress, graph rebuild.
12. Queue monitoring and observability: Bull Board behind basic-auth, structured worker logs, LLM cost aggregates.
13. Tests and quality: lint, critical unit tests, no secrets, no dead code, no invisible Unicode, responsive UI check.
14. Documentation and final gate: README runbook, `.env.example`, demo data, ADR minimum 5 decisions, acceptance walkthrough, final push, reviewer access, form submission.

## Must

- Registration, dev email confirmation, login, logout.
- Multi-user data isolation.
- CRUD feeds with status.
- CRUD categories.
- CRUD categorization axes with 4-5 seeds.
- Feed polling worker by schedule and manually.
- Article processing worker: pre-filter, LLM entities, summary, importance, category/axis binding.
- LLM abstraction with OpenAI and Anthropic adapters, env switch.
- Article deduplication with similar count.
- Entity deduplication.
- Cost control: token limit, LLM cache, pre-filter.
- Structured logs and basic LLM telemetry.
- Article feed with filters and article cards.
- React Flow graph with typed edges and filters.
- Axes settings UI with regeneration.
- Bull Board or equivalent.
- One-command startup through Docker Compose.
- README with Architectural Decisions.
- Responsive, minimal, clean Tailwind UI.

## Should

- LLM provider failover.
- Meaningful unit tests for critical parts.
- Extended graph filters: time window and graph text search.
- Period digests.
- Convenient UI for LLM telemetry aggregates.

## Could

- Edge animation over timestamp.
- Timeline graph mode with slider.
- Visual clustering by category.
- Dashboard of top entities/categories.
- Full-text article search.
- Graph export.
- Semantic similarity between articles.

## Functional Requirements

- `FR-1`: frontend, backend API, background workers, database, Redis/queues, LLM abstraction.
- `FR-2`: article lifecycle from feed intake to graph update; deterministic filter before LLM; LLM result cache; incremental graph update.
- `FR-3`: own LLM abstraction, OpenAI and Anthropic adapters, env-selected provider/model, structured output validation.
- `FR-4`: heuristic pre-filter before any LLM call; filtered articles saved with status.
- `FR-5`: article deduplication by normalized URL, content hash, and optionally semantic similarity.
- `FR-6`: entity deduplication with aliases and spelling variants.
- `FR-7`: graph model with article/entity nodes and typed edges.
- `FR-8`: user categories and categorization axes.
- `FR-9`: background regeneration after axis changes.
- `FR-10`: LLM cost control, caching, concurrency limits, telemetry.
- `FR-11`: period digests through background queue.

## Non-Functional Requirements

- UI remains responsive during background work.
- Structured logs and observable queues.
- Passwords hashed with argon2 or bcrypt.
- Auth through JWT or server sessions.
- Secrets only through env; complete `.env.example`.
- TypeScript everywhere.
- Google TypeScript Style Guide checked by linter.
- No dead code, no generated-looking clutter, no invisible Unicode markers.
- Meaningful tests are rewarded; empty coverage tests are not.
- Git history must show the real development process.
- README must let a new reviewer run and understand the project without reading all code.

## Submission Gate

The project must pass these before scoring:

- `docker compose up` works on a clean machine after filling `.env` from `.env.example`.
- Frontend is reachable after startup.
- Must functions work.
- Acceptance walkthrough passes without blocking failures.
- Reviewer has repository read access.

## Scoring

| Category | Points | What is evaluated |
| --- | ---: | --- |
| Must functionality | 30 | Required functions work through acceptance walkthrough |
| Architecture | 25 | LLM as a focused tool, clean layer boundaries, deduplication, cost control, error handling, ADR awareness |
| Code quality | 20 | Google TS style, readability, no dead code, no AI artifacts, no invisible Unicode, meaningful tests |
| UI/UX | 15 | Minimal, clean, responsive UI and frontend user stories |
| README and ADR | 10 | Complete launch instructions and justified architectural decisions |

Bonuses: Should up to +10, Could up to +10.

Penalties: up to -30 for dead code, poor architecture, implementing optional work while Must is incomplete, inability to explain own code, unedited AI-generation artifacts.

Disqualification risks: project does not start, acceptance walkthrough has blocking failures, reviewer access is not granted in time, development history is absent or artificial, plagiarism.
