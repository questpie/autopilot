# Framework Capability Reuse Boundary

Status: **Binding architecture gate**  
Audited: **2026-07-19**  
Application baseline: **QUESTPIE 3.16.0**, **Better Auth 1.6.23**  
Framework source: `/Users/drepkovsky/questpie/repos/questpie-cms` at `725c7e96d4ace6143ab4b54836ccb5e3f5946ee1` on `feat/autopilot-prerabka-v1`

## Rule

Autopilot owns product meaning: Companies, Actors, Spaces, Goals, Tasks, Channels, Messages, Agent request policy, app anchors, typed commands, read projections, Slovak UI, and result projection into those objects.

QUESTPIE owns reusable infrastructure and execution mechanics. A generic missing capability is implemented and tested in `questpie-cms`, released through the package train, and then consumed by Autopilot. It is never hidden behind an app-local replacement.

## Capability matrix

| Capability | Canonical framework surface | Autopilot-owned seam | Forbidden duplicate | Qualification state |
| --- | --- | --- | --- | --- |
| Authentication | QUESTPIE `starterModule`, `authConfig`, Better Auth `user`/`session`/`account`, same-origin `/api/auth` | Better Auth user → Human Actor participation; invite continuation and Company membership policy | second identity/session tables, custom token/session protocol, app-owned password handling | Shipped in 3.16; app uses the starter module and Better Auth React client |
| Collections and access | QUESTPIE collection/global builders, generated CRUD/types, request context, `.access(...)`, custom typed routes | Domain collections, invariants, exact-scope RBAC bindings, typed aggregate commands | handwritten REST CRUD, trusted client scope, presentation caches as truth | Shipped; Phase-0 organization vertical already uses generated collections and typed routes |
| Custom route access | QUESTPIE typed `route()` builder and explicit `.access(...)` rules | operation-specific RBAC inside authenticated typed commands | omitted route access, client-only route guards, existence-leaking errors | Every current Autopilot route declares access. QUESTPIE 3.16 treats an omitted custom-route rule as open, so app lint/contract review must fail such omissions and an upstream default-deny/diagnostic remains desirable |
| Query cache and mutations | `@questpie/tanstack-query` `createQuestpieQueryOptions`, generated collection/global/route options | feature query factories, bounded projections, optimistic acknowledgement and reconciliation | raw page `fetch`, handwritten query keys, second cache/client protocol | Shipped; `apps/operator-web/src/lib/query.ts` is the single factory |
| Persisted realtime truth | QUESTPIE live query snapshots with `{ realtime: true }` | bounded feature snapshot options and reconnect UI | app websocket protocol, client event store, custom collection invalidation bus | Shipped; full authorized snapshots remain authoritative |
| Semantic realtime and presence | `questpie/channels` typed `channel()` definitions, subscribe/publish authorization, schemas, presence, replay ledger; `q.channels.*` adapters | Thread/Run channel definitions and disclosure-safe event payloads | app-owned Socket.IO/Pusher wrapper, Channels as chat history, raw model/tool deltas | Shipped in 3.16; use separately from live queries |
| Search | QUESTPIE collection `.searchable(...)`, `createPostgresSearchAdapter`, `/search` access-filter construction, queue-backed indexing | explicit searchable content/metadata projection from authorized domain records | app-local FTS table, raw search endpoint, post-result authorization | **Upstream gap:** 3.16 lexical SQL does not preserve Autopilot's `in` access predicates, facets omit access filters, and absent config auto-indexes collections; product Search remains gated |
| Vector and hybrid retrieval | `createPgVectorSearchAdapter`, embedding provider contract, framework `questpie_search` index | Knowledge revision content and scope metadata; durable citation records | app-local pgvector table/service or metadata-only authorization | **Upstream gap:** semantic ignores `accessFilters`; advertised hybrid is lexical-only. Must be fixed upstream before F12 |
| Jobs and queues | QUESTPIE `job()`, typed queue client, pg-boss adapter, `onAfterCommit()`, retry/singleton policies | idempotent domain job payload and explicit durable dispatch intent | custom worker queue, timers as durability, direct publish inside an open transaction | Core queue is shipped, but `onAfterCommit()` is fire-and-forget. A generic transactional outbox is an upstream Phase-0 gap before Mention/AI dispatch can claim crash-safe durability |
| Workflows | `@questpie/workflows` `workflow()`, durable step context, wait/sleep/event/invoke, module/plugin/client | long multi-step business processes with persisted Actor attribution | app workflow engine or using workflows to replace one-turn Mention dispatch | Shipped and registered by bootstrap; Phase 0 defines no product Workflow and must not route one-turn Agent work through it |
| Durable AI work | Target `@questpie/ai` `ctx.ai.suggest/run/command`, package-owned Runs, attempts, commands, effects, recovery, worker leases, providers, and result projections | Agent request acceptance, Actor/Space authority store adapter, app anchor adapter, final Message/Task projection | direct AI SDK/Harness calls in routes, app-owned Run state machine, provider-specific domain code | **Upstream gap:** 3.16 ships worker/Harness infrastructure only; the generic durable service and persistence contract do not yet exist |
| Agent authority | `@questpie/ai` short-lived audience-bound Agent workload principal and fresh authority resolver | load Autopilot Actor/RBAC/Skill/policy records through configured store seam | requester impersonation, ambient `system`, client-supplied permissions | Implemented in local framework worktree; release and integration gate remain |
| MCP | `@questpie/mcp` generated CRUD/route/schema/resources and custom tools under module policy | expose named Autopilot commands/resources with exact grant/effect requirements | second MCP server, broad default discovery, ambient stdio system authority, or tool authorization implemented only in prompt text | Module is registered but `config/mcp.ts` now denies generic CRUD, annotated routes and resources and uses user mode. Agent workload boundary is only in local upstream worktree; named tools remain gated until release |
| Sandbox and executor | `@questpie/sandbox`, QUESTPIE executor/bindings broker, explicit data/network/file/service/job/workflow capabilities | select the minimum Run policy and app command/effect adapters | raw process execution, host HOME/env leakage, `allow-all`, app capability broker | Agent workload boundary is in local upstream worktree; release required |
| Secrets, providers, and model routing | Framework `SecretStore`, Provider adapter/registry/catalog, connection revision, credential binding, and model-routing contracts consumed by `@questpie/ai` and sandbox brokerage | authorized write-only capture command, Company connection metadata, verification UI, and allowed-model policy | plaintext collection fields, environment fallback per Company, secret reads through CRUD, app-owned provider catalog | **Upstream gap:** no general SecretStore or complete Provider registry/routing contract exists yet; the dirty Anthropic verifier is one adapter, not the missing system |
| Storage | QUESTPIE storage adapters, upload fields, private signed serving | Assets and domain references | app S3 client or public credential-bearing URLs | Shipped; qualify per Asset feature |
| OpenAPI | `@questpie/openapi` module and route metadata | external/operator contract selection and descriptions | separately maintained OpenAPI server/schema | Shipped and registered |
| Audit | QUESTPIE admin audit module is generic mutation audit; a reusable headless Actor/Run-aware audit extension does not yet exist | immutable product Activity/Audit events with Company, Actor, reason, correlation and Run/effect meaning | silently enabling two competing audit truths or treating realtime transport logs as audit | Current product audit is a deliberate domain record, not a replacement for registered framework audit. Qualify an upstream extensibility/projection seam before adopting `auditModule` |

## Realtime split

The two QUESTPIE realtime facilities are complementary:

1. **Live queries** deliver access-filtered authoritative collection/global snapshots and replace cached truth after reconnect.
2. **Typed Channels** deliver bounded semantic events, presence, typing, wake-ups, and Run activity. They validate channel patterns and event schemas, authorize subscribe/publish, cap payloads, and support replay.

A Channel event may accelerate the UI, but it never becomes the only record of a Message, Run command, effect, read cursor, or Task transition.

## Search and Knowledge boundary

Autopilot does not define `knowledge_index_documents` or an app-owned vector database. Durable `knowledge_documents`, immutable `knowledge_revisions`, and citations are product data. QUESTPIE indexes the selected published records through `.searchable(...)` into its adapter-owned `questpie_search` storage.

Phase-1 qualification must decide whether whole-revision indexing is sufficient or whether a generic framework-supported chunk source is required. If chunks are durable product evidence, they may be modeled as app domain rows and indexed through the same framework adapter; vectors and ranking storage still remain adapter-owned.

Lexical Search is not enabled merely because the Postgres adapter exists. Before product use, upstream task `enforce-questpie-search-access-ast-facets-and-explicit-opt-in` must preserve the complete supported access predicate AST (including Autopilot's `in` scopes), apply the identical authorized candidate set to facets, fail closed on unsupported predicates, make indexing explicit opt-in, and align the typed disabled contract. Until then, current and future secret/operational collections must be explicitly non-searchable and `/search` must not be presented as an authorized product feature.

Semantic and hybrid retrieval stay disabled until the framework applies source collection access joins before ranking and returns accurate authorized pagination/counts. Company/Space ids in search metadata are useful narrowing filters, not an authorization boundary.

## Current source and release state

- Every active direct QUESTPIE dependency is pinned to published `3.16.0`, and Better Auth resolves to `1.6.23`; registry checks reported the same latest versions on the audit date. `@questpie/ai` and `@questpie/sandbox` were removed from the app manifest until a concrete module imports/configures them. They remain in the framework fixed release group and must be added back through Bun at the exact qualified release when the Agent vertical consumes them.
- The framework branch already contains the merge from `main` at the recorded HEAD.
- Relevant uncommitted upstream source exists in `@questpie/ai`, `@questpie/mcp`, `@questpie/sandbox`, and private `@questpie/executor`. It includes Agent workload authority and runtime boundary work. It is development evidence, not a release artifact.
- The dirty authority boundaries are not yet a complete durable AI system: the generic service, package-owned Run/Attempt/Command/Effect persistence, provider registry, SecretStore, effect coordinator, and remote-worker asymmetric identity remain explicit upstream work.
- Generated `tsconfig.tsbuildinfo` changes in other fixed-group packages do not constitute source capability changes.
- The current patch Changeset covers only the Codex bridge. The complete public contract requires reviewed Changesets and the homogeneous fixed release train described by the release contract.
- The release contract's provisional `3.17.0` target is not authoritative while the dirty framework tree contains a pending major realtime Changeset. Task `reconcile-questpie-fixed-group-release-version-and-changesets` must resolve the official Changesets graph before any publish or pin.
- The app no longer declares `nodemailer`; email currently uses QUESTPIE `ConsoleAdapter`. A compatible mailer dependency returns only when an SMTP adapter is selected and qualified.

## Generated infrastructure is still framework-owned

QUESTPIE codegen and migrations legitimately materialize Better Auth, Workflows, Channels, realtime, and Search tables in the application database. Their presence in an app migration does not make them Autopilot subsystems. Autopilot registers the owning framework modules and adapters, generates the schema through the QUESTPIE CLI, and consumes their public APIs; app domain code never queries or mutates those infrastructure tables directly.

The same distinction applies to dependencies. `better-auth` is present for the typed React client while QUESTPIE owns the server instance and persistence contract. `@ai-sdk/react` is isolated to `@questpie/ui` as a transient rendering/transport adapter; provider execution, durable Runs, tools, authority, MCP, and effects remain inside `@questpie/ai`.

The local framework worktree now provides a typed, transaction-scoped `collection.lockMany({ ids }, context)` primitive for aggregate invariants. Autopilot's organization role and membership commands consume that seam; their former Drizzle `SELECT ... FOR UPDATE` escapes and the path-exact lint exceptions have been removed. Framework tests cover access denial, transaction identity, deterministic ordering, rollback, waiting, and deadlock avoidance against PGlite and PostgreSQL 17. The primitive remains development-only until the reconciled homogeneous QUESTPIE package train is published and pinned. The release gate rejects local links and 3.16 lockfile resolutions, while the boundary lint rejects every direct product database import.

## Review gate for every backend feature

Before implementation, its Agent Board task must answer:

1. Which installed QUESTPIE package and exact API owns each infrastructure concern?
2. What is the smallest Autopilot domain adapter at that seam?
3. Which negative test proves no app-local bypass exists?
4. Is any required framework behavior absent or unqualified?
5. If absent, which upstream task, package tests, Changeset, and release dependency close it?

Code review rejects a feature when these answers are missing, even if its happy path works.

`bun run lint` also executes `scripts/lint-framework-boundaries.ts`. The guard rejects direct app dependencies/imports for provider SDKs, AI SDK execution, the MCP protocol SDK, alternative auth stacks, external search/vector clients, custom realtime transports, queue/workflow engines, and sandbox/process runtimes. It also rejects parallel Better Auth servers, direct Bun/Deno/Node process execution, raw framework search-index/vector operations, and hand-written app collections in reserved `questpie_*`, `wf_*`, or package-owned `ai_*` namespaces. Generated sources and migrations remain valid. The allowlist is intentionally narrow: the app may own the Better Auth React client adapter, while server authentication remains a QUESTPIE concern. `scripts/lint-framework-boundaries.test.ts` proves the negative contract against isolated fixture apps so future edits cannot silently weaken it.

## Real scenario harness: reuse wins and documented deviations

The operator-web scenario harness (`apps/operator-web/tests/scenario-harness/`, library in `apps/operator-web/tests/scenarios/harness/real/`) proves product behavior against the built server over real HTTP/SSE. It reuses framework capability wherever it exists:

- `questpie migrate -c questpie.config.ts` provisions every disposable database — no parallel schema tooling.
- Better Auth HTTP routes (paths pinned from the live openAPI reference), `createAppClient` with a cookie+Origin fetch wrapper, and the `@questpie/tanstack-query` channels subscription drive auth, typed commands/reads, and query refetch.
- `QueueService.runOnce` (via a dedicated child entrypoint) is the queue drain lever; the PgNotify realtime broker and committed `questpie_channel_event` ledger tables carry channel replay — no custom websocket protocol anywhere.
- `qprobe replay` + agent-browser own browser regression replays (`tests/qprobe-product`, root `qprobe.config.ts`; Storybook stays isolated behind `QPROBE_CONFIG=qprobe.storybook.config.ts`).

Deviations, each deliberate and with an upstream pointer:

1. **Direct `Bun.spawn` instead of `qprobe start`** for the server under test: qprobe detaches children, writes unredacted logs, and cannot allocate ports; the harness needs allowlist child env, a redacting log tee, and port-refused/rebindable proofs. Upstream: qprobe feature request (managed env + redaction hooks) would let the harness converge.
2. **SQL `emailVerified` flip** after real sign-up: `requireEmailVerification` is on but no `sendVerificationEmail` is wired in framework or app, so no email ever reaches ConsoleAdapter. The 403-before-verification negative keeps the seam honest. Upstream: questpie-cms should wire a ConsoleAdapter-scrapable verification email; replace the flip with an email-driven verify then.
3. **SQL front-prune of `questpie_channel_event`** to force replay gaps: mirrors the framework retention sweep (precedent: `test/integration/ordered-channel-ledger.test.ts`) and is the only deletion shape that fires the verified gap predicate (`channel-event-ledger.ts:281-291`). Upstream: a public retention/prune API would supersede the SQL.
4. **Test-owned TCP gate** (`real/tcp-gate.ts`) as the network-fault lever: a byte-blind relay, zero protocol logic, because bare server restarts race the SSE transport's jittered backoff. Upstream: none needed — this is test infrastructure, not a transport.

Clock and provider fault controls remain contract-layer fixtures with reserved seam patterns (env-pointed stub provider HTTP server; module-seam clock indirection) documented in the harness README — building live seams now would violate the reuse gate by inventing product code that does not exist.
