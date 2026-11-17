# NIH Mobile

Native Flutter Android client for UA-Skills News Intelligence Hub.

This app is based on the proven `dispatcher_app` structure: explicit app
config, debug logging, local session storage, API repository layer, and a push
notification integration point. The domain is adapted to NIH instead of
dispatcher tickets.

## Features

- JWT login against `POST /api/auth/login`
- saved session bootstrap through `GET /api/auth/me`
- mobile article feed with search and article details
- graph overview with search, entity relation list, and entity detail navigation
- digest list with top entities, top categories, and key articles
- read-only Hub screen for feeds, category rules, axes, LLM telemetry, API base
  URL, account, and push status
- push notification service is wired as a stub until a real provider contract is
  added

The mobile client is intentionally read-only for the news domain. Feed polling,
category and axis edits, digest generation, regeneration, and queue work stay on
the backend and web admin surface.

## Run

Start the backend stack from the repository root first:

```bash
docker compose up -d --build
```

For Android emulator, the default API URL is:

```bash
http://10.0.2.2:3000/api
```

Run the app:

```bash
flutter run
```

Override the API base URL if needed:

```bash
flutter run --dart-define=NIH_API_BASE_URL=http://192.168.1.10:3000/api
```

## Push Stub

`PushNotifications` is initialized after login and exposes the current state in
the Hub tab. It intentionally does not call Firebase or a backend endpoint
yet. The next production step is to add a backend mobile-token contract and then
replace the stub internals without changing the app shell.

## Checks

```bash
flutter analyze
flutter test
flutter build apk --debug
```
