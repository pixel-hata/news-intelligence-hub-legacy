# ADR 0007: Native Mobile Client

## Status

Accepted

## Context

The original MVP keeps the native mobile app outside the acceptance gate, but it
is listed as a possible scope extension. The backend was already designed as a
client-neutral API, so a mobile client should reuse the same auth, article,
entity, graph, and digest endpoints.

There is an existing local `dispatcher_app` Flutter codebase with useful
patterns: explicit app config, repository-layer API access, local session
storage, debug logging, and push notification wiring.

## Decision

Add `apps/mobile` as a Flutter Android app. Keep it outside Docker Compose and
the npm workspaces, because Flutter is an optional native-client toolchain and
should not affect the required web/API reviewer path.

The app implements:

- JWT login and saved session bootstrap
- article feed and article detail
- graph/entity overview and entity detail
- read-only digest listing
- hub screen with API configuration and telemetry visibility
- push notification integration point as a deliberate stub

## Alternatives

One alternative was React Native. It would share more frontend concepts with the
React web client, but the user's existing local `dispatcher_app` work and
installed Android workflow already point to Flutter.

Another alternative was a simple responsive-only web experience. That would
remain enough for the official MVP, but it would leave the mobile extension
purely theoretical.

## Trade-Offs

The optional mobile path can be built as an APK without changing the backend.
Future Firebase/APNS work can replace the push stub behind the existing
`PushNotifications` service after a backend token-registration contract is
defined.

The main competition gate still remains the Dockerized web/API stack. Mobile
validation is documented through Flutter checks and a debug APK build.

Keeping Flutter outside Docker avoids making the required one-command reviewer
startup depend on Android tooling. The trade-off is that mobile validation is
separate from the core web/API acceptance path.
