# Acceptance Walkthrough

This walkthrough is the quickest reviewer path through the implemented
requirements.

## 1. Start The Stack

Create `.env` from `.env.example`, then start the application:

```bash
Copy-Item .env.example .env
docker compose up -d --build
```

On macOS/Linux, use `cp .env.example .env`.

The `seed` service runs automatically during startup after migrations and
before API/worker containers are allowed to start. Expected seed logs include
`"status": "seeded"`. It creates the confirmed demo user, 3 demo feeds, 5
processed articles, categories, axes, entities, graph data, LLM telemetry, and
a demo digest.

To inspect the seed result:

```bash
docker compose logs seed
```

To reset all local data and repeat the reviewer path from a clean volume:

```bash
docker compose down -v
docker compose up -d --build
```

## 2. Smoke Checks

```bash
curl http://localhost:3000/api/health
curl http://localhost:5173
```

Expected result: API returns `status: ok`, and the web app responds.

Queue monitor:

- URL: `http://localhost:3000/admin/queues`
- User: `admin`
- Password: `change-me`

## 3. Demo Login

Open `http://localhost:5173` and sign in:

- Email: `demo@example.com`
- Password: `demo-password`

The seeded account is already email-confirmed. Registration still returns a
DEV confirmation token for manual auth-flow review.

API path check from PowerShell:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body (@{ email = 'demo@example.com'; password = 'demo-password' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri http://localhost:3000/api/auth/me -Headers $headers
Invoke-RestMethod -Uri http://localhost:3000/api/articles -Headers $headers
Invoke-RestMethod -Uri http://localhost:3000/api/graph -Headers $headers
Invoke-RestMethod -Uri http://localhost:3000/api/digests -Headers $headers
```

Expected UI state after login: feed tab has demo feeds and 5 articles, graph tab
has article/entity nodes, settings tab has categories and axes, telemetry tab
has metrics and at least one digest.

## 4. Feature Path

1. Feed tab: confirm demo feeds and processed demo articles are visible.
2. Feed tab: pause/resume a feed, then poll it manually; the job appears in Bull
   Board.
3. Feed tab: use article filters by search, category, feed, importance,
   status, and period; `Clear` resets the article list.
4. Feed tab: open article details from a title or `Details`; confirm summary,
   source link, categories, axis labels, entities, and similar articles are
   visible.
5. Feed tab: click an entity chip to open the entity detail panel with aliases
   and mentioning articles.
6. Graph tab: inspect article/entity nodes and mentions/co-mention/similar
   edges.
7. Graph tab: filter by text search, category, time window, and node type, then
   click a graph node to open the node detail panel.
8. Graph tab: press `Export` and confirm the current filtered graph downloads
   as JSON.
9. Settings tab: create, edit, and delete categories.
10. Settings tab: create, edit, enable/disable, and delete axes and labels.
11. Settings tab: press `Regenerate`; the axis-regeneration queue should enqueue
   article reprocessing.
12. Telemetry tab: confirm top category/entity aggregates are visible, then
   press `Generate`; a new period digest should appear after the
   worker finishes.
13. Bull Board: confirm `feed-polling`, `article-processing`,
   `axis-regeneration`, and `digest-generation` queues exist.
14. Optional mobile app: run `flutter run` from `apps/mobile`, log in with the
   demo user, and verify Feed, Graph, Digests, Profile, and the push-stub state.

## 5. Validation Commands

If Node is installed on the host, run from the repository root:

```bash
npm run typecheck
npm test
npm run build
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
cd apps/mobile && flutter build apk --debug
```

Otherwise run the same checks inside the already built API container:

```bash
docker compose exec api npm run typecheck
docker compose exec api npm test
docker compose exec api npm run build
```
