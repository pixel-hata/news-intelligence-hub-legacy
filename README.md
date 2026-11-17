# UA-Skills News Intelligence Hub

Приватний репозиторій для змагання UA-Skills AI-Skills Prompt Engineering.

Цільовий продукт - multi-user news intelligence hub, який приймає RSS/Atom feeds,
обробляє статті через deterministic і LLM-assisted pipeline, дедуплікує статті
та сутності і показує результат як article feed та interactive relationship
graph.

## Поточний стан

Репозиторій містить робочий TypeScript monorepo з Docker Compose,
Prisma/PostgreSQL persistence, NestJS API, BullMQ workers, React/Vite/Tailwind
frontend, React Flow graph UI, LLM provider adapters, queue monitoring і demo
data seeding. Також додано native Flutter Android client, який повторно
використовує той самий API contract для mobile bonus path.

## Локальний запуск

Після створення `.env` з `.env.example` основна команда для перевіряльника:

```bash
Copy-Item .env.example .env
docker compose up -d --build
```

На macOS/Linux використати `cp .env.example .env`.

Сервіс `migrate` застосовує Prisma schema до запуску API та worker. Після цього
сервіс `seed` завантажує demo data для перевірки до запуску API та worker, тому
після `docker compose up -d --build` додаткові команди не потрібні. Seed створює
підтвердженого demo user, 3 demo feeds, 5 processed articles, 1 pre-filtered article,
categories, axes, entities, graph data, LLM telemetry і demo digest.

Seed є idempotent. Для debug його можна запустити повторно вручну:

```bash
docker compose run --rm seed
```

Demo login:

- Email: `demo@example.com`
- Password: `demo-password`

Demo account уже email-confirmed і не потребує registration flow.

Поточні порти:

- API: `http://localhost:3000/api`
- Queue monitor: `http://localhost:3000/admin/queues`
- Web: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Smoke checks:

```bash
curl http://localhost:3000/api/health
```

Відкрити:

- Web app: `http://localhost:5173`
- Queue monitor: `http://localhost:3000/admin/queues`

Стандартні queue monitor credentials беруться з `.env`: `admin` / `change-me`.

Повний шлях перевірки: [Acceptance Walkthrough](docs/ACCEPTANCE_WALKTHROUGH.md).

Опційний native Android client:

```bash
cd apps/mobile
flutter run
```

Стандартний API URL для emulator: `http://10.0.2.2:3000/api`. Для physical device
передати IP машини:

```bash
flutter run --dart-define=NIH_API_BASE_URL=http://192.168.1.10:3000/api
```

## Реалізований API surface

- `GET /api/health`
- `GET /api/meta/seeds`
- `POST /api/auth/register`
- `POST /api/auth/confirm-email`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/feeds`
- `POST /api/feeds`
- `GET /api/feeds/:id`
- `PATCH /api/feeds/:id`
- `DELETE /api/feeds/:id`
- `POST /api/feeds/:id/poll`
- `GET /api/categories`
- `POST /api/categories`
- `GET /api/categories/:id`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/axes`
- `POST /api/axes`
- `POST /api/axes/regenerate`
- `GET /api/axes/regeneration-status`
- `GET /api/axes/:id`
- `PATCH /api/axes/:id`
- `DELETE /api/axes/:id`
- `GET /api/articles`
- `GET /api/articles/:id`
- `GET /api/entities`
- `GET /api/entities/:id`
- `GET /api/graph`
- `GET /api/digests`
- `POST /api/digests/generate`
- `GET /api/telemetry/llm`
- `GET /admin/queues`

Registration endpoint повертає dev confirmation token, щоб локальний demo flow міг
підтвердити account без mail provider.

## Архітектурні рішення

## ADR-1: Backend на NestJS замість Directus

Контекст: Проекту потрібні автентифікація, CRUD для ресурсів користувача,
черги для RSS-пулінгу, LLM-обробка, читання графа, телеметрія і one-command
Docker startup. Найважливіша backend-розвилка в ТЗ - Directus або власний
NestJS-сервіс.

Рішення: Використати TypeScript monorepo: `apps/api` як NestJS API,
`apps/worker` як BullMQ workers, `packages/database` як Prisma/PostgreSQL шар,
`apps/web` як React-клієнт. Directus не використовується, бо основна зона
оцінки - кастомна LLM-оркестрація, дедуплікація, побудова графа, телеметрія і
поведінка черг.

Альтернативи: Directus з окремими custom workers; менший single-process
Express API.

Trade-offs: NestJS дає повний контроль, явні межі ownership і прозору
інтеграцію queue/LLM. Ціна - більше власного коду, ніж у Directus, бо auth,
CRUD, permissions і admin-like views реалізовані в застосунку.

## ADR-2: Детермінований pipeline перед LLM

Контекст: Принцип 1 вимагає відділити детермінований код від LLM-роботи.
RSS parsing, validation, deduplication, category rules, graph construction і
telemetry мають бути передбачуваними та тестованими.

Рішення: Залишити feed fetching, RSS/Atom parsing, URL/content normalization,
pre-filtering, exact duplicate checks, user category rules, graph edge
construction і queue state у детермінованому коді. LLM abstraction
використовується тільки у worker jobs для article analysis, summaries, entity
extraction і digest text. HTTP handlers не викликають providers напряму.

Альтернативи: Відправляти кожну статтю і кожне classification decision до LLM;
або повністю відмовитися від LLM і покладатися тільки на keyword rules.

Trade-offs: Такий поділ знижує cost, робить demo відтворюваним і дає змістовні
тести. Ціна - більше pipeline-коду, а локальний mock output навмисно
консервативніший за live provider.

## ADR-3: Дедуплікація сутностей і якість графа

Контекст: FR-6 вимагає дедупліковані сутності і корисні graph relationships.
Raw article text часто містить aliases, repeated forms, pronouns, weekdays,
verbs та інші low-value tokens, які роблять граф шумним.

Рішення: Нормалізувати entity labels, scope uniqueness by user and entity type,
merge exact/alias matches, фільтрувати low-quality entity candidates і будувати
typed graph edges з persisted article/entity records. Entity cleanup виконується
до graph rendering, щоб UI не приховував погані дані тільки візуальними
фільтрами.

Альтернативи: Зберігати кожен extracted token як entity; використати external
NER або embedding service для semantic alias resolution.

Trade-offs: Поточна стратегія пояснювана, дешева і достатньо детермінована для
MVP graph. Вона не повністю вирішує semantic aliases на кшталт rebrands або
multilingual variants без майбутнього embedding/NER support.

## ADR-4: LLM cost control, caching і telemetry

Контекст: FR-10 вимагає видимий LLM usage, cost control, caching і telemetry.
Regeneration може множити кількість викликів, тому застосунку потрібні локальні
докази spend, а не тільки provider-side billing.

Рішення: Запускати deterministic pre-filters перед provider calls, будувати
cache keys з task/model/prompt version/article hash/axes, зберігати cache hits
і LLM call records, рахувати estimated cost з configured token pricing.
Telemetry UI показує calls, tokens, cache hits, provider/task breakdowns і
estimated USD cost.

Альтернативи: Покладатися тільки на provider billing dashboards; викликати
provider для кожної discovered article і кожного regeneration request без
caching.

Trade-offs: Local telemetry робить докази для перевіряльника і cost awareness
користувача зрозумілими. Відображена cost - application estimate, що залежить від
configured model pricing, тому зміни live-provider pricing треба відображати в
env/config.

## ADR-5: Обробка помилок LLM provider і failover

Контекст: Принцип 2 вимагає стратегію для provider errors. Provider timeouts,
invalid responses або missing keys не мають робити весь web application
непридатним до використання.

Рішення: Використати internal worker-side `LlmAdapter` contract для mock,
OpenAI і Anthropic providers. Validate structured responses перед writes,
record failures у telemetry/job state і підтримати failover через
`LLM_FAILOVER_ENABLED` та `LLM_FALLBACK_PROVIDERS`. Якщо всі providers fail,
queued job fails visibly замість silently inventing data.

Альтернативи: Розмістити SDK calls напряму в API controllers; silently replace
failed provider output with fake successful data; підтримувати тільки одного
provider.

Trade-offs: Explicit failover і validation роблять failures observable і
зберігають API requests responsive. Ціна - додаткова worker orchestration і
більше configuration для documentation.

## ADR-6: Client-neutral API і опційний native mobile client

Контекст: Native mobile app поза основним MVP gate, але згаданий як extension
path. Backend не має бути прив'язаний до web-only storage або response shapes.

Рішення: Залишити backend як client-neutral JSON API з bearer sessions і
явними `/api/*` resources. React web app і Flutter Android client споживають
той самий core API, а ingestion, LLM, graph і digest work залишаються на
backend.

Альтернативи: Зробити тільки responsive web client; створити окремий mobile
backend-for-frontend.

Trade-offs: API трохи явніший, ніж web-only shortcut, але mobile client
залишається display/control surface без дублювання backend logic.

Повні ADR-файли:

- [ADR 0001: Application Architecture](docs/adr/0001-application-architecture.md)
- [ADR 0002: Data Model and User Isolation](docs/adr/0002-data-model-and-isolation.md)
- [ADR 0003: LLM Cost Control](docs/adr/0003-llm-cost-control.md)
- [ADR 0004: LLM Provider Contract](docs/adr/0004-llm-provider-contract.md)
- [ADR 0005: Feed And Article Workers](docs/adr/0005-feed-and-article-workers.md)
- [ADR 0006: Client-Neutral API For Future Mobile](docs/adr/0006-client-neutral-api.md)
- [ADR 0007: Native Mobile Client](docs/adr/0007-native-mobile-client.md)

## Відстеження вимог

- [Requirements Traceability Review](docs/REQUIREMENTS_TRACEABILITY.md)
- [Acceptance Walkthrough](docs/ACCEPTANCE_WALKTHROUGH.md)

## Перші етапи

1. Monorepo scaffold з Docker Compose. Виконано.
2. Domain schema і persistence layer. Виконано.
3. Auth з dev email confirmation. Виконано.
4. Feed CRUD і RSS polling worker. Виконано.
5. Category та axis settings API. Виконано.
6. Article processing pipeline з deterministic pre-filter. Виконано.
7. LLM abstraction і adapters. Виконано.
8. Article feed, entity cards, graph UI. Виконано.
9. Regeneration, telemetry, Bull Board, README ADR. Виконано.
10. Tests, фінальний demo walkthrough і submission hardening. Виконано.

## Статус Should / Could

Реалізовані Should items:

- LLM provider failover через env.
- Meaningful unit tests для API scoping, RSS/Atom parsing, pre-filtering,
  discovery dedupe, exact duplicate groups, structured LLM output і provider
  failover.
- Розширені graph filters за text і time window.
- Graph JSON export для поточного filtered graph.
- Period digests через queued worker.
- Telemetry view з article/feed/entity/graph counts і digest controls.
- LLM telemetry dashboard з provider/task aggregates, token counts, cache hits
  і estimated cost.
- Native Flutter Android client з login, feed, article detail, graph/entity
  overview, read-only digest/config/telemetry views і push-notification stub.

Реалізовані Could items:

- Timeline slider для graph filtering за article timestamp.
- Timestamp-aware animated graph edges через edge metadata.
- Category-clustered graph layout для article nodes.
- Period dashboard для top entities і categories.
- Article search за title, summary, excerpt, source, entities і stored article
  body.
- Graph JSON export для поточного filtered graph.

## Відомі обмеження

- Digest summaries проходять через ту саму LLM abstraction, що й article
  analysis. У local demo mode mock provider генерує deterministic text,
  придатний для перевіряльника, і фіксує `digest-generation` token/cost telemetry.
- Exact URL/content dedupe і entity alias dedupe реалізовані. Full
  embedding-based semantic article similarity відкладено.
- Entity cards показують type, description, aliases і mentioning articles.
  Related entity frequency та activity charts можна розширити.
- Push notifications підключені в native app як explicit stub до появи backend
  token-registration contract.
- Graph timeline і clustering реалізовані як pragmatic MVP implementations, а
  не як full playback/force-layout exploration mode.

## Контроль якості

Перевірено 2026-05-27:

```bash
npm run quality:scan
npm run lint
npm run typecheck
npm test
npm run build
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
cd apps/mobile && flutter build apk --debug
```

Docker Compose stack, browser walkthrough, API health check, web entrypoint,
demo seed, Bull Board route, regeneration queue і digest generation також
перевірені локально.
