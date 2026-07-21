# Realtime TanStack Query Patterns

Status: **Reference pattern guide**
Researched: **2026-07-21**
Library baseline: **TanStack Query v5** (latest published `5.101.2`, June 2026)
Our transport: **SSE full-snapshot _replace_ reducer over `experimental_streamedQuery`, `refetchMode: "append"`, multiplexer replays `sinceSeq` on reconnect**
Scope: how to keep a realtime UI cheap — never refetch data the stream is already delivering, and invalidate only the reads the stream does _not_ heal.

This guide follows each claim to the primary source that owns it. Where a fact is version-sensitive, the v4→v5 delta is flagged inline and collected in the last section. Our architecture is QUESTPIE live queries (access-filtered authoritative snapshots) plus typed Channels for semantic events — see [`framework-capability-reuse.md`](./framework-capability-reuse.md) §"Realtime split". This document is the client-cache half of that contract.

---

## 1. `invalidateQueries` vs `setQueryData` on a realtime event

These are the two levers, and they trade the same axis: **server round-trip vs. trust in the payload**.

`invalidateQueries` marks matching queries stale (overriding any `staleTime`) and refetches the ones that are actively rendered; it is the async, always-server-consistent option ([TanStack, Query Invalidation guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)). The cache result is whatever the server returns, so ordering, partial payloads, and authorization are the server's problem, not the client's. Cost: a network request per active matched query.

`setQueryData` "is a synchronous function that can be used to immediately update a query's cached data" **without triggering a refetch** ([TanStack, `setQueryData` reference](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientsetquerydata)). Zero network. But the event must carry authoritative, complete data, and updates "must be performed in an _immutable_ way" (ibid). Because you are hand-writing the cache, you inherit every hazard the server used to absorb: out-of-order events, partial payloads that silently drop fields, additions/deletions the updater forgot to handle, and slow cache divergence from the real dataset.

| | `invalidateQueries` (signal → refetch) | `setQueryData` (push data → write cache) |
| --- | --- | --- |
| Network on event | Yes (active queries only) | No |
| Server-consistent | Always (server is the source) | Only if the payload is complete + authoritative + ordered |
| Handles add/delete | Trivially (server returns the new set) | You must write it, per shape |
| Handles ordering / partials | Server absorbs it | You absorb it; risk of divergence |
| Payload requirement | Just an id/entity signal | Full authoritative object(s) |
| TypeScript ergonomics | Clean | Dynamic updater, weaker types |

**When each wins.** Prefer `invalidateQueries` as the default: it is simpler, type-safe, and self-correcting. Prefer `setQueryData` only for high-frequency, self-contained, additive streams where a refetch per event would be wasteful and the event demonstrably carries the whole authoritative object — the canonical example is a chat "new message" append or a live price tick ([LogRocket, "TanStack Query and WebSockets", 2023-05-08](https://blog.logrocket.com/tanstack-query-websockets-real-time-react-data-fetching/); [Leapcell, "Advanced Data Fetching with TanStack Query"](https://leapcell.io/blog/advanced-data-fetching-with-tanstack-query-optimistic-updates-pagination-and-websocket-integration)). Note that our full-snapshot-replace model (§7) is a _structured_ variant of `setQueryData`: the reducer replaces the whole collection with each authoritative snapshot, which sidesteps the partial/ordering hazards that make ad-hoc `setQueryData` risky.

---

## 2. TkDodo's two canonical approaches

Source: TkDodo (Dominik Dorfmeister, TanStack Query maintainer), ["Using WebSockets with React Query"](https://tkdodo.eu/blog/using-web-sockets-with-react-query), first published 2021-06-06, code kept current to v5 signatures.

### (a) Push a signal → invalidate (his recommendation)

The event carries only _which entity changed_; the client turns that into a query key and invalidates.

```js
const useReactQuerySubscription = () => {
  const queryClient = useQueryClient()
  React.useEffect(() => {
    const websocket = new WebSocket('wss://echo.websocket.org/')
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const queryKey = [...data.entity, data.id].filter(Boolean)
      queryClient.invalidateQueries({ queryKey })
    }
    return () => websocket.close()
  }, [queryClient])
}
```

His rationale, verbatim: this approach _"avoids the problem of over pushing, because if we receive an event for an entity that we are not interested in at the moment, nothing will happen."_ Invalidation only refetches active queries, so an event for data no one is looking at costs nothing until that data is next used ([tkdodo.eu](https://tkdodo.eu/blog/using-web-sockets-with-react-query)). Events map naturally to key granularity: `["posts","list"]` invalidates the list, `["posts","detail", 5]` a single post, `["posts"]` everything post-related.

### (b) Push the full data → `setQueryData`

The event carries the payload; the client writes it into every matching cache entry with `setQueriesData` (plural — so one message can update both list and detail views):

```js
websocket.onmessage = (event) => {
  const data = JSON.parse(event.data)
  queryClient.setQueriesData(data.entity, (oldData) => {
    const update = (entity) =>
      entity.id === data.id ? { ...entity, ...data.payload } : entity
    return Array.isArray(oldData) ? oldData.map(update) : update(oldData)
  })
}
```

### His actual recommendation and caveats

He prefers (a). Verbatim: _"It's a bit too dynamic for my taste, doesn't handle addition or deletion, and TypeScript won't like it very much, so I'd personally rather stick to query invalidation."_ ([tkdodo.eu](https://tkdodo.eu/blog/using-web-sockets-with-react-query)). The named caveats for the `setQueryData` path are exactly the three that bite in production: **no add/delete handling**, **dynamic/untyped updaters**, and the implicit requirement that the payload be complete.

He pairs the invalidation approach with a **high `staleTime`** so the initial `useQuery` fetch is the _only_ automatic one and everything after comes from cache + explicit invalidation. Verbatim: _"Consider setting a high `staleTime`… data will be fetched initially via `useQuery`, and then always come from the cache. Refetching only happens via the explicit query invalidation."_ His example uses `staleTime: Infinity` (ibid).

---

## 3. When to rely on the stream vs. invalidate — avoiding the double-fetch

The double-fetch you are trying to avoid is: the stream delivers new data **and** something also fires a refetch for the same data. Three facts control this.

**`invalidateQueries` only refetches _active_ queries.** `refetchType` defaults to `'active'`: matching queries are all marked invalid, but only ones "actively being rendered via `useQuery` and friends will be refetched in the background"; `'inactive'`, `'all'`, and `'none'` are the other choices ([TanStack, `invalidateQueries` reference](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientinvalidatequeries)). So invalidating broadly is cheaper than it looks — unmounted reads just wait. TkDodo leans on exactly this to justify broad invalidation: _"Invalidation merely refetches all active Queries that it matches, and marks the rest as `stale`, so that they get refetched when they are used the next time"_ ([TkDodo, "Automatic Query Invalidation after Mutations", 2024-05-25](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations)).

**`staleTime` decides whether mount/focus/reconnect refetch at all.** By default `staleTime` is `0` — data is stale immediately, so "every time you e.g. mount a new component instance, you will get a background refetch," and stale queries also refetch on window focus and network reconnect ([TkDodo, "React Query as a State Manager", 2021-08-20](https://tkdodo.eu/blog/react-query-as-a-state-manager); [TanStack, Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)). Raising `staleTime` suppresses all of those: _"As long as data is fresh, it will always come from the cache only. You will not see a network request"_ (ibid). For any query the stream keeps current, a high/`Infinity` `staleTime` (and usually `refetchOnWindowFocus: false`) is what stops mount and focus from double-fetching.

**The decision rule for a given event + read:**

- Read is a **mounted arm of the live stream** → **rely on the stream, invalidate nothing.** The stream already writes the authoritative snapshot; an invalidation here just refetches (or, for a `streamedQuery` arm, tears down and re-opens the connection — see §7).
- Read is **not fed by the stream** (a REST detail, a paginated history page, an export) → **invalidate it.** The invalidation _is_ the refetch, and it only pays the network cost if that read is currently on screen.
- Read is fed by the stream but **currently unmounted** → do nothing; `refetchOnMount` + `staleTime` handle it when it remounts.

**If you invalidate on a firehose of events, debounce it — do not reach for `refetchType:'none'` hacks.** A user who combined `refetchType:'none'` with `cancelRefetch:false` and a `refetchInterval` to suppress redundant calls ended up dropping invalidations that arrived mid-flight, showing stale data. TkDodo's diagnosis: _"setting `cancelRefetch: false` does nothing if you combine it with `refetchType: 'none'`. If you are not refetching, there is nothing to cancel,"_ and invalidations landing between a call's start and return are lost. His fix is to **debounce/throttle the invalidation in the socket callback** (he names `p-debounce`), not to defeat the refetch machinery ([TanStack Discussion #7180](https://github.com/TanStack/query/discussions/7180)).

---

## 4. Cross-entity invalidation from one event

One semantic event ("label X applied to issue Y") can invalidate reads across several entities. The goal is **targeted** invalidation — hit the affected keys, nothing more.

**Structure keys so a prefix _is_ a scope.** Keys go generic→specific: `['todos','list',{filters}]`, `['todos','detail', id]`. A [Query Key Factory](https://tkdodo.eu/blog/effective-react-query-keys) colocates them per feature so invalidation targets are declarative, not stringly-typed ([TkDodo, "Effective React Query Keys", 2021-06-13, upd. 2022-04-23](https://tkdodo.eu/blog/effective-react-query-keys)):

```ts
const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: string) => [...todoKeys.lists(), { filters }] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
}
```

**Match at the right width.** Prefix/fuzzy match invalidates a whole subtree (`{ queryKey: ['todos'] }` also hits `['todos', {page:1}]`); `exact: true` restricts to one key; a `predicate` function gives arbitrary precision ([TanStack, Query Invalidation guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)):

```ts
queryClient.invalidateQueries({
  predicate: (query) =>
    query.queryKey[0] === 'todos' && query.queryKey[1]?.version >= 10,
})
```

**Central event→keys map vs. colocated/declarative.** Two shapes, both from TkDodo's mutation-invalidation piece — they transfer directly to realtime events ([TkDodo, 2024-05-25](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations)):

- _Declarative / colocated_: tag the affected key-sets on the operation via `meta`, and let one handler read the tag. For events, the server-side event descriptor plays the role of `meta.invalidates`:
  ```ts
  meta: { invalidates: [['issues'], ['labels']] }
  ```
- _Central map_: a single `MutationCache`/subscription handler that maps `event.type → QueryKey[]` and invalidates each. TkDodo's global-invalidate baseline (`mutationCache.onSuccess: () => queryClient.invalidateQueries()`) is the extreme end of "central" — coarse but safe.

His stance on the tradeoff is a genuine finding: broad invalidation is usually the right default because the miss is worse than the over-fetch — _"I would prefer fetching some data more often than strictly necessary over missing a refetch"_ — and it stays cheap because non-active matches don't refetch (ibid). For us: keep a **central `channelEvent → affected non-live query keys` map**, invalidate targeted by prefix/predicate, and let `refetchType:'active'` cap the cost. Do not enumerate keys at each call site; the map is the single place semantic events meet the cache.

---

## 5. TanStack's own realtime primitives: `streamedQuery` and the subscriptions story

**There is no first-class subscription/WebSocket primitive, by design.** Tanner Linsley (creator): WebSocket support _"will not be making a first-class appearance in React Query for the time being"_ — messages are too schema-specific for the library to own. The recommended pattern is `useQuery` for the initial read + a subscription that then invalidates or writes the cache ([TanStack maintainer, AnswerOverflow](https://www.answeroverflow.com/m/1075105176395993130)). The internal `Subscribable`/observer base class is framework-integration plumbing, not a public realtime API.

**`streamedQuery` is the one built-in that consumes a live source.** It "is a helper function to create a query function that streams data from an AsyncIterable. Data will be an Array of all the chunks received." The query is `pending` until the first chunk, then `success`, and stays in `fetchStatus: 'fetching'` until the stream ends ([TanStack, `streamedQuery` reference](https://tanstack.com/query/latest/docs/reference/streamedQuery)). It is exported as `experimental_streamedQuery` and is **explicitly experimental** — "marked as `experimental` because we want to gather feedback from the community" (ibid; still experimental as of `5.101.x`). It is **v5-only**; no v4 equivalent exists. It landed in a 2025 v5 release ([Feedback discussion #9065, TkDodo, 2025-04](https://github.com/TanStack/query/discussions/9065)).

Options that matter for realtime:

- **`streamFn`**: `(ctx) => Promise<AsyncIterable<TChunk>>` — our SSE topic subscription.
- **`reducer(acc, chunk)`**: folds each chunk into `TData`. Default appends chunks into an array; **required when `TData` is not an array** — this is the seam where a _replace_ reducer lives.
- **`refetchMode: 'reset' | 'append' | 'replace'`** (default `'reset'`): governs what a **refetch/reconnect** does to existing data.
- **`initialValue`** (default `[]`): the accumulator seed; mandatory alongside a custom reducer.

`refetchMode` semantics, confirmed against [query-core source `streamedQuery.ts`](https://github.com/TanStack/query/blob/main/packages/query-core/src/streamedQuery.ts):

| Mode | Start of a refetch | Per chunk | Net effect on a live stream |
| --- | --- | --- | --- |
| `reset` (default) | Resets to pending, **erases data** | writes cache each chunk | UI blanks on every reconnect — wrong for live |
| `append` | Keeps existing data | writes cache each chunk via `reducer(prev ?? initialValue, chunk)` | Incremental, visible immediately, no blank |
| `replace` | Keeps existing data | **buffers** in memory | Writes once **when the stream ends** — never fires for an infinite stream |

The reducer is applied as `reducer(prev === undefined ? initialValue : prev, chunk)`, and in `append`/`reset` the cache is written after each chunk; `replace` only calls `setQueryData` once, after completion and only if not cancelled (source, ibid). On abort the consume loop breaks on a `cancelled` flag. TkDodo notes reconnection is meant to ride the normal `retry` path — _"Does the Promise reject if the connection drops? If so, I'd expect our `retry` to kick in"_ — and that the stream **restarts from the beginning** on a fresh fetch; there is no built-in resume-from-cursor or chunk de-duplication (deferred to the `reducer`) ([#9065](https://github.com/TanStack/query/discussions/9065)).

---

## 6. Reconnect / gap handling

TanStack gives you the _triggers_ and the _online/focus model_; it does **not** give you replay-since-a-sequence — that is transport-layer (our multiplexer).

- **`refetchOnReconnect`** (default `true`) refetches stale queries when the network reconnects ([TanStack, Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)). For a `streamedQuery` arm, "refetch" means re-invoking `streamFn` — i.e. re-establishing the subscription. This is the mechanism that re-opens a dropped live arm; keep it on (or let the transport's own reconnect do it — see below).
- **`onlineManager`** owns online state. It "manages the online state within TanStack Query," listens to `window` `online`/`offline`, **pauses queries while offline and resumes on reconnect**, and is customizable via `setEventListener`/`setOnline` (e.g. React Native NetInfo) ([TanStack, `onlineManager`](https://tanstack.com/query/latest/docs/reference/onlineManager)). It starts optimistically online rather than trusting `navigator.onLine` (which false-negatives in Chromium).
- **`focusManager`** owns focus state behind `refetchOnWindowFocus`, customizable via `setEventListener`/`setFocused` ([TanStack, `focusManager`](https://tanstack.com/query/latest/docs/reference/focusManager)). For live arms you generally want focus refetch **off**, so tab-switching doesn't churn the stream (this is the operational reason behind TkDodo's high-`staleTime` advice, §2).
- **Replay-since-a-sequence and full-snapshot-replace are ours, not TanStack's.** `streamedQuery` has no cursor/gap primitive ([#9065](https://github.com/TanStack/query/discussions/9065)); our multiplexer replaying `sinceSeq` and re-emitting a full snapshot is exactly the resumability the library declines to own. The clean division: **transport heals the data (replay/snapshot); TanStack only needs to be told when to re-open the stream** — and with `refetchMode:'append'` + a replace reducer, the re-emitted snapshot lands as an in-place replacement with no pending flash.

One caveat about **two reconnect layers**: if the SSE transport (e.g. an `EventSource`) reconnects on its own, and TanStack _also_ refetches on `onlineManager` reconnect, you can double-open. Decide which layer owns reconnect. If the transport auto-reconnects and replays, treat TanStack's `refetchOnReconnect` as a secondary safety net (or disable it for the arm and drive re-subscription from the transport); if TanStack owns it, make sure the transport does not independently reconnect the same subscription.

---

## 7. The full-snapshot-replace SSE model (our model), and what invalidation is still for

Our live arm is `streamedQuery` where **each chunk is the entire access-controlled result set** and the **reducer replaces the accumulator** with that snapshot:

```ts
// one live collection arm; every chunk is a full authoritative snapshot
streamedQuery({
  streamFn: (ctx) => subscribeTopic(topicFor(ctx.queryKey), ctx.signal), // AsyncIterable<Snapshot>
  reducer: (_prev, snapshot) => snapshot,   // replace, not append-into-array
  initialValue: EMPTY_SNAPSHOT,
  refetchMode: 'append',
})
```

**Why `refetchMode:'append'` is the only correct mode here** (from §5's source-confirmed table): the live topic never "ends," so `'replace'` would buffer forever and never write; `'reset'` would blank the UI on every reconnect. `'append'` keeps the current snapshot visible and, because the reducer _replaces_, each new snapshot (including the post-reconnect replay snapshot) overwrites in place — self-heal with no pending flash. "Append" is the mode name; "replace" is the reducer's job. ([source](https://github.com/TanStack/query/blob/main/packages/query-core/src/streamedQuery.ts))

**Deriving many projections from one arm.** UI projections built with `select` over the single live arm recompute whenever the arm's cache updates, and TanStack's structural sharing keeps references stable when nothing actually changed, so unaffected projections don't re-render ([TanStack, Important Defaults — structural sharing](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)). One stream heals every `select` projection over it — **no invalidation is involved in that fan-out.**

### Does a mounted live arm ever need manual invalidation?

**No — and invalidating it is actively harmful.** A mounted `streamedQuery` arm sits in `fetchStatus: 'fetching'` for the life of the stream ([reference](https://tanstack.com/query/latest/docs/reference/streamedQuery)). `invalidateQueries` on an _active_ query refetches it ([invalidateQueries ref](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientinvalidatequeries)), and a refetch re-invokes `streamFn` — tearing down and re-opening the SSE subscription — with `cancelRefetch:true` (the default) cancelling the in-flight stream first. That is pure waste: the stream is already the authoritative writer. **Rule: never invalidate a mounted live arm; let it self-heal.**

### What manual invalidation _is_ still for

The stream heals exactly what it feeds. Everything else needs a nudge:

1. **Non-live / one-shot reads** — a REST detail view, a paginated history page, an export, any `useQuery` with an ordinary `queryFn` that is _not_ an arm of a subscribed topic. These never self-heal. Map the semantic event to their keys and invalidate (targeted, §4). `refetchType:'active'` means only the on-screen ones pay.
2. **Derived / cross-collection projections that are NOT computed via `select` over the live arm** — a separately-fetched aggregate, a server-computed rollup on a _different_ (non-subscribed) topic, a count/summary read from another collection. A `select` projection over the live arm heals for free; a projection sourced from a query the stream does not feed does not.
3. **Cross-collection semantic events** — an event on collection A whose authoritative consequence lands in a read sourced from collection B, when B is not itself a mounted live arm. This is the classic case for a central `event → affected keys` map (§4): the stream healed A, you invalidate the B-reads the event also invalidated.
4. **Inactive arms**: usually leave them. An unmounted arm isn't running `streamFn`, but invalidating it only marks it stale (default `refetchType:'active'` won't refetch inactive), and it re-subscribes fresh on remount via `refetchOnMount` + `staleTime`. Only invalidate an inactive arm if you deliberately keep it cached and mount it _without_ a fresh subscription.

Put plainly: the live arm and its `select` projections are the region where invalidation should be **absent**; invalidation exists for the reads at the _edges_ of the stream's coverage.

---

## Flagged v4 → v5 differences

Source: [TanStack, Migrating to v5](https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5).

- **Single-object signatures everywhere.** `invalidateQueries({ queryKey, ...filters }, options)`, `setQueriesData({ queryKey, ...filters }, updater)`, `removeQueries({ queryKey })`, `useQuery({ queryKey, queryFn })`. v4 accepted positional key/fn/options. Every code snippet above is v5.
- **`cacheTime` → `gcTime`.** Same semantics (garbage-collect delay for _unused_ queries, default 5 min), renamed for clarity.
- **`onSuccess` / `onError` / `onSettled` removed from queries.** They remain on _mutations_. Consequence for realtime: you can no longer piggy-back cross-cache sync on a query's `onSuccess`; do stream-driven cache writes in the subscription handler, or use the global `QueryCache`/`MutationCache` callbacks.
- **`refetchInterval` callback** now receives `query`, not `data` (read `query.state.data`).
- **`streamedQuery` is v5-only and experimental** — no v4 equivalent; `refetchType` (with default `'active'`) predates v5 and behaves the same. `maxPages` for infinite queries is also new in v5.

---

## Pattern verdict

**Recommended default for our SSE full-snapshot-replace architecture:**

1. **Live collection arm** = `streamedQuery`, replace reducer, `refetchMode:'append'`, `staleTime: Infinity`, `refetchOnWindowFocus:false`. It is the authoritative writer for its topic.
2. **Every UI projection off that data** = `select` over the single arm. They self-heal via structural sharing. Zero invalidation.
3. **Reconnect** = transport replays `sinceSeq` + re-emits a full snapshot; the reducer replaces it in place. Pick one reconnect owner (transport vs. `refetchOnReconnect`) to avoid double-open.
4. **Manual `invalidateQueries`** exists only for reads _outside_ the stream's coverage — non-live/one-shot reads, non-`select` derived aggregates, and cross-collection consequences of semantic events — driven from one central `event → keys` map, matched targeted (prefix/`exact`/`predicate`), relying on `refetchType:'active'` to keep it cheap. Debounce if events firehose.

**Decision rule — invalidate vs. setQueryData vs. rely-on-stream:**

> **Is the read a mounted arm of the live stream (or a `select` over one)?**
> → **Yes: rely on the stream. Do nothing.** (Invalidating it re-opens the SSE connection; a plain refetch is redundant.)
> → **No, and the event carries the complete authoritative object for a hot, additive read (chat/ticks):** `setQueryData`/`setQueriesData` — no network.
> → **No, otherwise (REST/paginated/derived/cross-entity reads):** `invalidateQueries`, targeted, `refetchType:'active'`. The refetch is the point; server stays the source of truth.

The one-line heuristic: **the stream owns everything it feeds; invalidation owns everything at the stream's edges; a mounted live arm is never invalidated.**
