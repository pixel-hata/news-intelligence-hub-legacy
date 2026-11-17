# Should / Could Review

Date: 2026-05-27

This is a concise review of the high-score items after the final mobile and
filtering pass.

## Should Items

| Item | Status | Evidence |
| --- | --- | --- |
| LLM provider failover | Done | OpenAI/Anthropic/mock adapters, env selection, fallback chain, worker tests. |
| Meaningful tests for critical logic | Done | API scoping/search tests; worker tests for RSS/Atom parsing, pre-filtering, dedupe, LLM output validation, and failover; mobile API/push/widget tests. |
| Graph time-window filter | Done | API accepts `from`/`to`; web graph has a time-window control. |
| Graph text search | Done | API accepts `q`; web graph has search across graph node labels/metadata. |
| Period digests | Done | Queued digest generation, digest list, demo seed digest, mobile digest tab. |
| LLM telemetry aggregates in UI | Done | Telemetry tab shows core metrics plus top category/entity aggregates. |

## Could Items

| Item | Status | Evidence / Limit |
| --- | --- | --- |
| Edge animation over time | Partial | React Flow uses animated co-mention edges. Timestamp-direction playback is deferred. |
| Timeline graph mode with slider | Deferred | Not implemented; graph time-window filter covers the practical review need. |
| Visual graph clustering by categories | Deferred | Category filtering is implemented; cluster layout is left as future polish. |
| Top entities/categories dashboard | Done | Telemetry tab includes top category and entity lists. |
| Full-text article search | Partial | Article text search is implemented over title, summary, URL, categories, axes, and entities. Dedicated DB full-text indexes are deferred. |
| Graph export | Done | Web graph tab exports the current filtered graph as JSON. |
| Semantic article similarity | Partial | Exact URL/content duplicate groups and similar edges are implemented; embedding-based semantic similarity is deferred. |

## Extra Scope

| Item | Status | Evidence |
| --- | --- | --- |
| Native mobile app | Done as optional bonus | `apps/mobile` Flutter Android app with login, feed, article detail, graph/entity overview, digests, profile, tests, and debug APK build. |
| Push notifications | Stubbed intentionally | Mobile `PushNotifications` service exposes explicit stub state. Real provider registration remains behind a future backend contract. |

## Current Best Next Improvement

The next highest-value improvement would be dedicated semantic similarity with
embeddings. It has higher cost and API-key risk than the completed UI/export
items, so it remains deferred.
