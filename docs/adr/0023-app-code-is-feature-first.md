# ADR 0023: App code is organized feature-first

- Status: accepted
- Date: 2026-07-21

## Context

`apps/operator-web/src` was split by technical layer — `routes/`, `components/screens/`, and `lib/data/` with a single ~33 KB `feature-queries.ts` mixing seven features. One feature (e.g. Spaces) was smeared across five directories and a shared mega-module, so understanding or changing it required bouncing between files with no locality.

TanStack Router file-based routing (verified against `@tanstack/router-generator` 1.167.x: route groups `(folder)/` and `-`-prefixed colocation are supported) mandates route files under `src/routes/` but does not dictate where feature logic lives.

## Decision

- App feature code lives in `src/features/<name>/`. A feature owns its `queries.ts`, `mutations.ts`, screen components, hooks, types, and — where needed — `realtime.ts` (edge-invalidation entries) and a client-safe command `contract.ts`. One feature, one folder.
- `src/routes/` (TanStack Start file-based) stays thin: routing, loaders, guards, and context wiring. Routes import feature modules and render feature screens; they hold no data logic.
- `app-data-context` is a thin composer that assembles the per-feature query arms and commands into the request-scoped context (extending the pattern it already uses for commands).
- `packages/ui` keeps its layer structure (`ui` / `composites` / `templates` / `ai`) — query-free primitives, unaffected by this decision.
- Components only consume data; all data work lives in the feature's `queries.ts` / `mutations.ts` (see ADR 0022).

## Consequences

- Each feature has locality: its reads, writes, keys-via-options, realtime edges, and contracts sit together.
- `feature-queries.ts` is split per feature and deleted as a shared module.
- Routes remain routing-only, so a route move does not drag feature logic with it.
- A new feature is a new folder — one obvious home, no shared bag to edit.

## Rejected alternatives

- **Keep the technical-layer split:** the status quo — zero feature locality, a shared mega-module every feature must edit.
- **Full colocation inside `routes/` via `-`-prefixed dirs:** possible in TanStack Router, but noisy in a deeply nested route tree and couples a file move to route-tree regeneration.

## Reference

- ADR 0022 (the data modules that live inside a feature folder).
