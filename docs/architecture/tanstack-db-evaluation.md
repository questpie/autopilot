# TanStack DB Evaluation

Status: **Research + recommendation (decision input)**
Researched: **2026-07-21**
Subject baseline (verified against the npm registry on 2026-07-21, latest published 2026-07-16):
`@tanstack/db` **0.6.16**, `@tanstack/react-db` **0.1.94**, `@tanstack/query-db-collection` **1.1.0**, `@tanstack/electric-db-collection` **0.3.14**, `@tanstack/db-ivm` **0.1.18**.
Our baseline: **TanStack Query v5** (`5.101.x`), **TanStack Start** SSR, **QUESTPIE 3.16.0** + `@questpie/tanstack-query`, SSE full-snapshot-replace realtime.
Scope: is TanStack DB the right substrate for our realtime-heavy app, and does it justify a `@questpie/tanstack-db` framework integration? Grounded in [`0022-reusable-realtime-first-tanstack-query-reactive-data-pattern.md`](../adr/0022-reusable-realtime-first-tanstack-query-reactive-data-pattern.md), [`realtime-tanstack-query-patterns.md`](./realtime-tanstack-query-patterns.md), and [`framework-capability-reuse.md`](./framework-capability-reuse.md).

Every version / status / API claim below was fetched from a primary source (docs, blog, GitHub, npm, or the installed `@tanstack/db` source) rather than recalled, because TanStack DB is moving fast and prior knowledge goes stale within weeks.

---

## 1. What TanStack DB is, and its release status

TanStack DB brands itself "the reactive client store for your API" and "the first brownfield, backend-agnostic sync engine for frontend apps" ([tanstack.com/db](https://tanstack.com/db/latest), fetched 2026-07-21). It loads server data into **normalized client collections**, runs **incremental live queries** over them, and applies **optimistic writes** with automatic rollback.

**It is beta, and the core is pre-1.0.** The README states, verbatim, "Tanstack DB is currently in BETA" ([github.com/TanStack/db](https://github.com/TanStack/db), fetched 2026-07-21). The version picture is split and worth stating precisely, because a single "1.x" package can mislead:

| Package | Latest (2026-07-16) | Reading |
| --- | --- | --- |
| `@tanstack/db` (core store) | **0.6.16** | pre-1.0 beta |
| `@tanstack/react-db` (React bindings) | **0.1.94** | pre-1.0 beta |
| `@tanstack/db-ivm` (dataflow engine) | **0.1.18** | pre-1.0, early |
| `@tanstack/query-db-collection` | **1.1.0** | the one peripheral package past 1.0 |
| `@tanstack/electric-db-collection` | 0.3.14 | pre-1.0 |

The pieces you cannot avoid depending on — the core store, the React bindings, the differential-dataflow engine — are all `0.x`. Only the peripheral Query-collection adapter has crossed 1.0. The project as a whole is branded beta everywhere it is described.

**Timeline and maintainers.** TanStack DB `0.1` ("first beta") landed **2025-07-30**, authored by **Kyle Mathews and Sam Willis** (ElectricSQL founders) with the TanStack team; ElectricSQL is the highlighted sync partner ([TanStack blog, "TanStack DB 0.1", 2025-07-30](https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query)). It reached `0.5` ("Query-Driven Sync") on **2025-11-12**, where the post declared it "production-ready today," asked for "early adopters," and targeted "**1.0 for December 2025**" ([TanStack blog, "TanStack DB 0.5", 2025-11-12](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync)). **That 1.0 target has slipped by 7+ months: as of 2026-07-16 the core is still `0.6.16`.** Independent coverage from the same window is candid: InfoQ (2025-08-30) reports the maintainers "caution that it should be considered experimental" and quotes an adopter, "I wouldn't bet my app on the Beta" ([InfoQ, 2025-08-30](https://www.infoq.com/news/2025/08/tanstack-db-beta/)).

**Production-readiness signal, net:** real momentum and real production users, but a self-declared beta whose own 1.0 date has slipped substantially, with the load-bearing packages still `0.x`.

## 2. Core model and guarantees

**Collections** are "typed sets of objects that can be populated with data," decoupling data loading from component binding ([db overview.md](https://github.com/TanStack/db/blob/main/docs/overview.md), fetched 2026-07-21). Built-in collection types: **Query** (TanStack Query-backed), **Electric** (Postgres via ElectricSQL logical replication), **TrailBase**, **RxDB**, **PowerSync**, **LocalStorage**, **LocalOnly** (ibid).

**Live queries** are "built on differential dataflow (d2ts)," recalculating "only the parts of a query affected by a change" instead of re-running the whole query, and support cross-collection **joins, filters, and aggregates** (ibid; [live-queries guide](https://tanstack.com/db/latest/docs/guides/live-queries)). The engine ships as a separate hard dependency, `@tanstack/db-ivm@0.1.18`, described in its own manifest as "Incremental View Maintenance for TanStack DB based on Differential Dataflow" (installed package.json, verified locally). The advertised payoff is runtime speed: "0.7 ms to update one row in a sorted 100k collection on an M1 Pro" ([blog 0.1, 2025-07-30](https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query)).

**Transactional optimistic mutations.** Collections expose `insert`/`update`/`delete`, which fire `onInsert`/`onUpdate`/`onDelete` handlers; optimistic state "is maintained separately and overlaid on synced data, rolling back on handler errors," with `createOptimisticAction` / `createTransaction` for multi-collection staged writes ([overview.md](https://github.com/TanStack/db/blob/main/docs/overview.md)). The installed types confirm the shape: `onInsert`/`onUpdate`/`onDelete` receive `{ transaction, collection }` and return a promise; the data flow is unidirectional — optimistic inner loop → server persistence → synced state reintegration (`@tanstack/db@0.6.5` `types.d.ts`, read locally).

**Guarantees.** Reactive consistency of derived views (live queries always reflect current collection state, maintained incrementally); optimistic-then-reconcile with automatic rollback on mutation-handler rejection; and a single normalized copy of each row shared across all queries. It is an **in-memory** store — collections and the IVM graph live in client memory; there is no built-in cross-tab or on-disk persistence except via the LocalStorage/RxDB/PowerSync collection types.

**Runtime cost.** The library advertises runtime *performance*, not bundle budget: I found **no documented gzipped bundle-size figure**. Structurally, adoption adds the core store plus the `db-ivm` differential-dataflow engine (a mandatory dependency of `@tanstack/db`) plus one collection package, on top of the react-query we already ship. The cost is the IVM graph and normalized collections held in memory, sized to how much data you sync eagerly.

## 3. Relationship to TanStack Query — overlap vs. replacement

**It sits on top of Query; it does not replace it.** The canonical guidance: "Keep Query for request orchestration; bring in DB when the client needs a reactive data graph" ([tanstack.com/db](https://tanstack.com/db/latest)). InfoQ frames it the same way — DB is "built on top of TanStack Query" and "extends it with collections, live queries, and optimistic mutations," supporting "incremental adoption" ([InfoQ, 2025-08-30](https://www.infoq.com/news/2025/08/tanstack-db-beta/)).

**It reuses `queryOptions`/`queryFn`/`queryClient` directly.** `queryCollectionOptions` takes a `queryClient`, a `queryKey`, and a `queryFn` — the same primitives we already build with `@questpie/tanstack-query` — plus a `getKey` extractor ([Query Collection docs](https://tanstack.com/db/latest/docs/collections/query-collection), fetched 2026-07-21). If `queryFn` is missing at runtime it throws `QueryFnRequiredError` ([queryCollectionOptions reference](https://tanstack.com/db/latest/docs/reference/query-db-collection/functions/queryCollectionOptions)). So our existing `q.collections.X.find(opts)` options object can feed a Query collection with minimal glue.

**Overlap with what we already run.** We use react-query v5 heavily; DB does not evict it. Concretely:

- **Stays in Query:** one-shot reads, paginated history, exports, route calls (`q.routes.*`), and any read we do not want to hold resident as a synced collection.
- **Moves to DB (if adopted):** the reads that need a *reactive graph* — cross-collection joins/aggregates and derived UI shapes currently hand-built with `select`/`useMemo` over a live arm.
- **Replaced outright:** nothing at the Query layer is deleted; DB is an additive layer above it.

Net: DB is **~15-20% replacement, ~80% additive**. It absorbs the client-side derivation/reconciliation layer, not the fetching/caching layer.

## 4. Sync-model fit — our SSE full-snapshot-replace stream

This is the decisive technical question, so it is grounded in the installed source, not prose.

**Our stream.** The server pushes the *entire* access-controlled result set on every matching change; the client replaces. At the framework level this is already how `@questpie/tanstack-query` implements `{realtime:true}`: `find(opts, {realtime:true})` runs `streamedQuery({ streamFn: () => client.realtime.stream(topic), reducer: (_, chunk) => chunk, refetchMode: "append" })` — a full-snapshot **replace** reducer over an `AsyncIterable` of snapshots (`@questpie/tanstack-query@3.16.0` `src/index.ts`, read locally).

**TanStack DB's native sync contract is delta-oriented.** From `@tanstack/db@0.6.5` `types.d.ts` (read locally), a custom collection's `sync` receives:

```ts
sync: (params: {
  collection: Collection<T, TKey, …>;
  begin: (options?: { immediate?: boolean }) => void;
  write: (message: ChangeMessageOrDeleteKeyMessage<T, TKey>) => void; // one row op
  commit: () => void;
  markReady: () => void;
  truncate: () => void;
  metadata?: SyncMetadataApi<TKey>;
}) => void | CleanupFn | SyncConfigRes
// OperationType = 'insert' | 'update' | 'delete'
// rowUpdateMode?: 'partial' | 'full'  (default 'partial')
```

`write` takes a **single row-level `ChangeMessage`** typed `insert | update | delete`, keyed by `getKey`. On its face this mismatches full-snapshot-replace: the stream hands us a whole set, the contract wants per-row deltas.

**But the mismatch is fully bridgeable, two ways — and the built-in Query collection already does the bridge for us:**

1. **`truncate()` + re-insert (snapshot-replace, expressible but coarse).** The contract includes `truncate()`, which clears the collection. So a snapshot can be applied as `begin() → truncate() → write(insert) × N → commit()`. This is exactly how Electric applies a "must-refetch" control message. It works, but it re-inserts the whole set on every change, which produces a delete-all + insert-all delta downstream and **defeats the incremental-dataflow advantage** (§2) that is the entire point of DB.

2. **Diff the snapshot into row ops (the idiomatic path).** Diff each snapshot against the previous by `getKey` and emit only the changed rows as insert/update/delete. This preserves fine-grained deltas and keeps live queries incremental. **The `queryCollectionOptions` collection already does precisely this:** the docs state, verbatim, "The query collection treats the `queryFn` result as the **complete state** of the collection … Items present in the collection but not in the query result will be deleted; Items in the query result but not in the collection will be inserted; Items present in both will be updated if they differ" ([Query Collection docs](https://tanstack.com/db/latest/docs/collections/query-collection)). It also exposes a direct push path — `collection.utils.writeInsert/writeUpdate/writeDelete/writeUpsert/writeBatch`, which "write directly to the synced data store" without a refetch (ibid).

**Verdict on fit:** a QUESTPIE realtime stream is a **workable but slightly-against-the-grain** sync source. Workable because the snapshot→delta diff is a solved, shipped pattern (the Query collection is built on it) and `write`/`truncate`/`writeBatch` give us every primitive we need. Against-the-grain because there is a genuine philosophical inversion: QUESTPIE deliberately emits *full authoritative snapshots* to sidestep the client-side delta hazards documented in [`realtime-tanstack-query-patterns.md`](./realtime-tanstack-query-patterns.md) §1 (out-of-order events, partial payloads, missed add/deletes); TanStack DB is *delta-native* and earns its headline performance from deltas. To feed DB well, the adapter must **re-derive on the client the very delta the server threw away** — reintroducing a diff step that our snapshot model was designed to avoid. One structural friction beyond the diff: our transport is a **push** `AsyncIterable`, whereas `queryCollectionOptions` is **pull** (`queryFn` → promise). So we cannot reuse `queryCollectionOptions` verbatim for the realtime path; we would implement a **custom `createCollection({ sync })`** that subscribes to `client.realtime.stream(topic)` and applies the diff itself (see §7).

## 5. What it would replace in our current design

Grounded in ADR 0022 and the two architecture docs, honestly split into *goes*, *transforms*, and *stays*.

**(a) `select`-derives over one live arm → live queries. GENUINE WIN, and an upgrade.** Today, a projection like `deriveCompanyShell` is a `select`/`useMemo` over a *single* live arm, because TanStack Query structural sharing only heals projections off *one* stream (ADR 0022, amendment 2026-07-21; [`realtime-tanstack-query-patterns.md`](./realtime-tanstack-query-patterns.md) §7). Cross-collection composition is awkward — you mount multiple arms and stitch them in a `useMemo`. DB's live queries do **cross-collection joins/aggregates, incrementally maintained**, natively. This is DB's sweet spot and the clearest reason it is attractive to us.

**(b) Central "channel-event → invalidate affected keys" reconciler → auto-maintained live queries. IT SHRINKS; IT DOES NOT DISAPPEAR.** This is the question to answer without hand-waving.

- What *could* disappear: reconciler entries that exist **only** because you cannot join across arms today — i.e. "an event on collection A whose consequence lands in a read sourced from collection B" ([`realtime-tanstack-query-patterns.md`](./realtime-tanstack-query-patterns.md) §7, case 3). If A and B are both DB collections with live sync, differential dataflow maintains the cross-collection view for free, and those entries go.
- What **stays**: (i) **ephemeral signals** — presence/typing/hints are routed to separate ephemeral keys and never merged into truth (ADR 0022); DB does not address these, they remain. (ii) **Genuinely non-live reads** — REST detail, paginated history, exports — which you would *not* hold resident as synced collections; they stay in Query and still need targeted invalidation. (iii) Most importantly, **QUESTPIE's semantic Channels are a separate facility from live-query snapshots** ([`framework-capability-reuse.md`](./framework-capability-reuse.md) "Realtime split"). A typed `channel()` event (`message.persisted`, `run.linked`, `state.changed`) still has to translate into "resync the affected collection" *unless that collection is itself a DB collection whose own sync already carries the change*. If the SSE push sync feeds every collection, semantic-event→resync largely collapses **into the sync layer**; if any collection is pull-synced, a (smaller) dispatcher still triggers its refetch.
- **Net:** the reconciler transforms from "central event → affected query-keys map" into "route ephemeral channel signals to ephemeral state + nudge any pull-synced collection." For a design where every truth source is an SSE-push DB collection, that is a substantial shrink of cross-collection reconciliation — but a residual dispatcher for ephemeral + non-collection reads remains. **The reconciler does not vanish.**

**(c) Manual optimistic-ack + rollback → transactional mutations. GENUINE WIN.** Today the ADR carefully forbids `onMutate` on `{realtime:true}` lists, because the full-snapshot replace reducer overwrites any optimistic patch on the next snapshot; realtime lists "take NO `onMutate` and reconcile the persisted row by identity" (ADR 0022). DB makes optimism first-class: the optimistic overlay is maintained *separately* from synced data and reconciles when the persisted row arrives (by `getKey`), rolling back on error (§2). This is the same "reconcile by identity" dance, but owned by the library instead of hand-written per feature — a real simplification.

**What STAYS no matter what (DB sits above, not instead of, the backbone):** the QUESTPIE **SSE transport, multiplexer, replay-`sinceSeq` ledger, and access-controlled snapshot server**; the QUESTPIE **typed client SDK, collections, typed routes, and RBAC**; **TanStack Query itself** (one-shot/route/non-collection reads); QUESTPIE **semantic Channels**; and **TanStack Start SSR/router** wiring. DB replaces the *client-side derivation + part of the reconciler + the manual optimistic path* — it does not touch the realtime backbone or the server.

## 6. SSR / TanStack Start fit

**This is the sharpest maturity gap for us, because we have a working SSR seed today and DB does not offer an equivalent.**

- **The core store has no SSR story.** The overview and guides contain **zero** mentions of SSR, hydration, first render, or server rendering; `useLiveQuery` runs client-side over in-memory collections ([overview.md](https://github.com/TanStack/db/blob/main/docs/overview.md), fetched 2026-07-21). There is no dehydrate/rehydrate of the differential-dataflow graph analogous to TanStack Query's SSR guide.
- **SSR seeding for Query collections is brand-new and narrow.** `queryCollectionOptions` now documents `initialData` / `initialDataUpdatedAt`, letting "server-rendered state … be immediately materialized as normalized collection rows" ([Query Collection docs](https://tanstack.com/db/latest/docs/collections/query-collection)). But this landed via [GitHub issue #346](https://github.com/TanStack/db/issues/346), which was **closed 2026-07-20 — the day before this evaluation** — and is scoped to the *Query* collection (label `query-collection`), not the core store and not custom `sync` collections.
- **Consequence for us.** Our current pattern is a *solved* SSR story: the loader `ensureQueryData(find)` (SSR-safe, dehydrated) and the component `useSuspenseQuery(find, {realtime:true})` share **one cache entry on an identical key**, so the page static-hydrates then the stream upgrades in place with no pending flash (ADR 0022; [`realtime-tanstack-query-patterns.md`](./realtime-tanstack-query-patterns.md) §7). DB's realtime path for us would be a **custom SSE `sync` collection**, which gets *neither* `initialData` (that is Query-collection-only) *nor* a core-store hydration story — the seed must be hand-rolled by writing the loader snapshot synchronously inside `sync()` before `markReady()`. **Adopting DB now is an SSR regression** relative to the pattern we just ratified.

## 7. `@questpie/tanstack-db` integration feasibility

QUESTPIE already ships the typed client SDK (`createClient<AppConfig>`), `@questpie/tanstack-query` (`q.collections.*`, `{realtime:true}` streamedQuery over topic streams), and a realtime adapter (`client.realtime.stream(topic, signal)`). A `@questpie/tanstack-db` package would sit alongside `@questpie/tanstack-query`, reusing the same client. Sketch of the surface:

**Collection factory.**
```ts
// @questpie/tanstack-db (sketch)
questpieDbCollection(client.collections.tasks, {
  where, realtime: true,           // → buildCollectionTopic(name, opts)
  getKey: (row) => row.id,
})
// →
createCollection({
  getKey,
  startSync: false,                // lazy: sync on first subscriber (matches Query gcTime model)
  sync: ({ begin, write, commit, truncate, markReady }) => {
    let prev = new Map<Id, Row>()
    const run = async (signal) => {
      for await (const snapshot of client.realtime.stream(topic, signal)) {
        begin()
        diffByKey(prev, snapshot, { insert: r => write({type:'insert', value:r}),
                                    update: r => write({type:'update', value:r}),
                                    delete: k => write({type:'delete', key:k}) })
        commit(); markReady(); prev = index(snapshot, getKey)
      }
    }
    const ac = new AbortController(); run(ac.signal)
    return () => ac.abort()
  },
  onInsert: ({ transaction }) => client.collections.tasks.create(payloadOf(transaction)),
  onUpdate: ({ transaction }) => client.collections.tasks.update(patchOf(transaction)),
  onDelete: ({ transaction }) => client.collections.tasks.delete(idOf(transaction)),
})
```

**Design shape.** The adapter maps a QUESTPIE collection + its realtime topic into a TanStack DB collection: (1) **read/sync** = subscribe to the SSE snapshot stream and **diff snapshot→row-ops** (§4, path 2) so live queries stay incremental; (2) **write** = wire `onInsert/onUpdate/onDelete` to the existing typed route mutations, letting DB own the optimistic overlay and reconcile the persisted row on the next snapshot by `getKey`; (3) **SSR seed** = write the loader's `ensureQueryData` snapshot synchronously in `sync()` before `markReady()` (hand-rolled, since custom sync gets no `initialData`); (4) for **non-realtime** collections, prefer plain `queryCollectionOptions` with `q.collections.X.find` as `queryFn` — the built-in diff (§4) and now-native `initialData` (§6) apply directly.

**Natural or awkward?** The full-snapshot-replace stream is a **natural fit for the write-your-own-`sync` seam** (the contract is small and complete: `begin/write/commit/truncate/markReady`), but an **awkward fit for the data model**: the adapter must diff snapshots into deltas — re-deriving the delta QUESTPIE intentionally discards — to avoid the `truncate`-every-snapshot anti-pattern that would neutralize DB's incrementality. It is the same tension as §4, now concentrated in one package.

**Prior art: yes, and it is the established pattern.** DB ships as a *set of backend collection packages* — `query-db-collection`, `electric-db-collection`, `trailbase`, `powersync`, `rxdb`, plus Firebase ([overview.md](https://github.com/TanStack/db/blob/main/docs/overview.md); [ElectricSQL blog, 2025-07-29](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db)). "Backend X → TanStack DB collection factory" is exactly the shape a `@questpie/tanstack-db` package would take, so feasibility is not in doubt — the pattern is well-trodden. The framework-boundary rule ([`framework-capability-reuse.md`](./framework-capability-reuse.md)) also *forces* this shape: a realtime store adapter is reusable infrastructure, so it must be a QUESTPIE package consuming the existing realtime adapter, **never an app-local store** (the boundary lint rejects app-owned realtime/store machinery).

## 8. Risks, tradeoffs, and when NOT to

- **Maturity risk for a phase-0 product.** Core `@tanstack/db` 0.6.x, `react-db` 0.1.x, `db-ivm` 0.1.x; the 0.5 post's "1.0 for December 2025" ([blog 0.5, 2025-11-12](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync)) has slipped 7+ months; maintainers call it experimental and an adopter "wouldn't bet my app on the Beta" ([InfoQ, 2025-08-30](https://www.infoq.com/news/2025/08/tanstack-db-beta/)). Betting a product's data substrate on this now is real risk.
- **SSR regression** (§6): we would trade a solved, shipped hydration story for a client-first store whose only SSR seed (`initialData`) is Query-collection-only and landed 2026-07-20 — with nothing for the custom SSE sync path we would actually use.
- **Snapshot-vs-delta inversion** (§4): QUESTPIE's snapshot model and DB's delta model pull opposite ways; the adapter must diff snapshots to keep DB incremental, reintroducing client-side delta derivation.
- **Learning curve + gotchas:** the differential-dataflow mental model, the live-query builder, and the transaction/optimistic model are new surface; the `truncate`-every-snapshot trap silently kills performance; everything is in-memory (collection + IVM graph resident), so eager-syncing large sets has a memory cost.
- **Migration cost:** we *just* built and ratified the react-query realtime-first pattern (ADR 0022, two adversarial grills, 2026-07-20/21) with a working SSR seed and a scoped reconciler. Ripping it out to adopt a beta store now is high-cost and premature.
- **When NOT to:** when the current single-live-arm + `select` + small reconciler already covers every phase-0 surface (it does), and when the wins DB offers (cross-collection live joins, first-class optimistic transactions) are not yet load-bearing. Adopt *later*, not because DB is wrong, but because its value is not yet needed and its maturity is not yet there.

---

## Recommendation

**Adopt LATER, and only via a QUESTPIE framework integration (`@questpie/tanstack-db`) — not now, and never app-local.**

**Decisive reason:** the realtime-first reactive-data problem for phase-0 is *already solved* by the just-ratified react-query pattern (ADR 0022), which has a working SSR seed and a scoped reconciler; TanStack DB's genuine advantages — incremental cross-collection live joins and first-class optimistic transactions — are real but **not yet load-bearing** for any current surface, while its cost is a pre-1.0 beta core with **no first-class SSR** and a snapshot-vs-delta inversion against our transport. The lowest-machinery option (owner's standing KISS directive) is to keep the react-query pattern for phase-0 and revisit DB when its core reaches 1.0 and a real SSR/hydration story exists — at which point the correct move is an **upstream `@questpie/tanstack-db` collection package** over the existing realtime adapter (the capability-reuse boundary requires it; prior art from `electric-db-collection` et al. makes it straightforward).

**Single biggest risk if we adopt now:** **maturity + SSR regression** — swapping a solved, shipped SSR-hydrated realtime pattern for a `0.x` beta store whose SSR seed is Query-collection-only, landed the day before this was written, and does not cover the custom SSE-sync path we would actually build.

**Honest counter-signal (why "later," not "never"):** if phase-1 surfaces genuinely need cross-collection live joins/aggregates that the single-arm + `select` pattern cannot express cleanly, DB becomes the *right* tool and the `@questpie/tanstack-db` package is a modest, well-precedented build. Track the core hitting 1.0 and a core-store SSR story as the two trigger conditions.

### What changes in our data-layer design if we adopt (delta)

- **Live truth becomes DB collections**, fed by a **custom `createCollection({ sync })`** that subscribes to `client.realtime.stream(topic)` and **diffs each snapshot into row ops** (not `truncate`-replace) to keep live queries incremental.
- **`select`/`useMemo` projections → `useLiveQuery`** with real cross-collection joins/filters/aggregates (the clearest win).
- **The channel reconciler shrinks but survives:** cross-collection truth reconciliation folds into the sync layer; a smaller dispatcher remains for **ephemeral signals** (presence/typing) and **non-collection/one-shot reads**.
- **Manual optimistic-ack → `onInsert/onUpdate/onDelete` + optimistic overlay**, with rollback owned by DB; persisted rows reconcile by `getKey` on the next snapshot.
- **TanStack Query stays** for one-shot/route/non-collection reads; DB is additive above it, not a replacement.
- **SSR seed must be hand-rolled** in `sync()` (write the loader snapshot before `markReady()`), because custom sync collections get neither `initialData` nor a core-store hydration story.
- **The SSE transport, multiplexer, replay ledger, snapshot server, typed SDK, RBAC, and Channels are unchanged** — DB sits above the realtime backbone, not instead of it.
- **New dependencies:** `@tanstack/db` + `@tanstack/db-ivm` (differential-dataflow engine) + the QUESTPIE collection package; the store is in-memory, so eager-synced set sizes carry a memory cost.
