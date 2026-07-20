---
status: proposed
---

# Reusable realtime-first TanStack Query reactive-data pattern

Every collaborative surface (channels, goals, tasks, presence) consumes one reusable app-level reactive-data pattern rather than reinventing realtime + cache reconciliation. Ratified from the 2026-07-20 reactive-data research grill (framework + spec grounded, dual adversarial review); both owner-gated decisions are now answered (below). It remains proposed until the pattern is validated on the smallest real surface.

## Framework does the heavy lifting

`@questpie/tanstack-query` already ships the realtime primitive: `createQuestpieQueryOptions`, the `{realtime:true}` streaming branch (streamedQuery over `realtime.stream(topic)` with a full-snapshot **replace** reducer, `refetchMode:"append"`, `realtimeRetry`), the multiplexer reconnect/replay ledger + channel gap error, `q.channels.*.subscription/presence`, `q.key(parts)=buildKey(keyPrefix,parts)`, `setupRouterSsrQueryIntegration`, and the request-scoped QueryClient. The app pattern is ~5 thin typing/policy modules over this — never a parallel transport, store, or bus.

## Decisions

- **Bounded live collection/global snapshots ARE truth.** Every surface that must stay live is prefetched PLAIN in the loader (`ensureQueryData`, SSR-safe, dehydrated) and mounted LIVE in the component (`useSuspenseQuery` + `{realtime:true}`) on the IDENTICAL query key. Because the framework omits `queryConfig` from the key, the plain and live forms of identical options share ONE cache entry with different queryFns, so hydration static-loads then the stream upgrades in place. A pure `Route.useLoaderData()` read is correct only for genuinely request-scoped data that re-runs the route when it changes (e.g. slug→id resolve).
- **One-arm-per-logical-read invariant.** The shared-key feature is a risk if two concurrent consumers disagree on options; the query-factory (not the call site) owns both the `{realtime}` decision and the `limit`, and exposes paired `.visible` / `.visibleLive` arms with identical options.
- **Typed key-factory contract.** One module (`src/lib/data/query-keys.ts`) owns the segment vocabulary for BOTH framework-generated collection prefixes (`keys.collection(name)`) and app-projection keys (`keys.company.shell(id)`, `keys.team.roster(id)`, …), and names consistency-group fan-outs where truth spans the two namespaces (a single prefix cannot span `collections.*` and a custom projection). This resolves the spec's no-handwritten-key oracle and makes channel-event → invalidate one typed op. **Agents are actors with `kind:"agent"`, not a collection** — `keys.onAgentChange` must fan out over `keys.collection("actors")`, never a non-existent `agents` collection (which prefix-matches zero queries and silently leaves reads stale).
- **Channel-event reconciliation is invalidation-only and narrowly scoped.** The single `use-channel-reconciler.ts` consumer of `q.channels.*` is a dumb typed switch: presence/typing/hints go to SEPARATE ephemeral cache keys (never merged into a truth query), and semantic domain events (`message.persisted`, `run.linked`, `state.changed`) `invalidateQueries` the typed keys — NEVER `setQueryData` a channel payload into a truth list, and NEVER treat the subscription append-reducer as message history (message history is a bounded live collection find). Realtime collection queries self-heal on reconnect with zero app code (multiplexer re-POSTs `sinceSeq`, server re-sends a full snapshot, replace reducer applies it), so the reconciler targets ONLY ephemeral signals and derived/non-realtime projections a live snapshot cannot cover — never used to keep live lists fresh (that would recreate the forbidden invalidation bus).
- **Optimistic mutations are acknowledgement-only, on plain/derived queries only.** A `{realtime:true}` query's full-snapshot replace reducer overwrites any `onMutate` patch on the next server snapshot, so realtime lists take NO `onMutate` and reconcile the persisted row by identity (clientNonce/sequence/projection key) when the snapshot arrives. Optimism (a minimal pending marker + rollback) applies only to the one acted-on plain/derived query; the one-transaction send fires exactly one route mutation and never fabricates cross-entity derived state.
- **Channel-query retry is pinned false; the reconciler owns the gap path.** Channel subscription/presence queryOptions carry no `retry` key (unlike collection realtime), so without pinning `retry:false`, a replay-gap error would retry-loop the stream instead of surfacing. On the gap error only (not a clean abort — a clean abort must NOT refetch), the reconciler refetches truth.

## Owner decisions (ratified 2026-07-20)

- **Shell nav liveness = LIVE mid-session.** The company shell's spaces-nav live-updates during a session. `company.shell` (a `q.custom.query` composite with no `{realtime}` form) is decomposed into the live raw factories (`spaces.visibleLive` + an actors `kind:"agent"` live find), and the existing PURE `deriveCompanyShell` re-runs client-side as a `select`/`useMemo`. Truth stays bounded live snapshots; no new channel is introduced.
- **Mid-stream access-revocation = SURFACE-DENIED.** A non-retryable realtime rejection or a 403 on a truth read marks only THAT surface denied (a graceful degraded/denied UI); the session continues. A genuine 401 (session invalid) still forces global invalidation + redirect to `/sign-in`. This separates "access to one thing" from "the session".

## Validation before surfaces build on it

The smallest fork-INDEPENDENT surface is the raw `spaces.visible(companyId)` bounded live snapshot on the access-guarded spaces route: loader `ensureQueryData(spaces.visible)` + component `useSuspenseQuery(spaces.visibleLive)` on the identical key (prove static-hydrate → stream-upgrade on one cache entry), plus a `spaces/create` optimistic-acknowledgement mutation whose persisted row arrives on the live snapshot and reconciles by identity. This validates the pattern before the shell-liveness decision and before space/channel management.

## Upstream gaps (none block the validation surface)

Typed realtime `findOne`/live-item builder in `@questpie/tanstack-query` (interim: `find({where:{id},limit:1},{realtime:true})` works today); the rest is conditional on the shell-liveness answer.
