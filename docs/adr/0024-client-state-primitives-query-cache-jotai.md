# ADR 0024: Client state — React primitives, Query cache, context; jotai for high-frequency

- Status: accepted
- Date: 2026-07-21

## Context

operator-web ships no client-state library. State today is React primitives (7 files with `useState`, no `useReducer`), the TanStack Query cache (all async/shared state, incl. the auth session at `["auth","get-session"]`), one theme context (ADR 0016), `useSyncExternalStore` over TanStack's `onlineManager` for online/offline, and TanStack Router state (route context, location, search params) read via the router's own selector subscription (`useRouterState({ select })`). ADR 0022 already routes ephemeral realtime signals (presence, typing) to separate Query-cache keys, not a store.

The open question was a rule plus an escape hatch. The one real concern raised: React Context re-renders every consumer when its value changes, so a fat, frequently-changing context is a performance trap.

## Decision

- **Local UI state** → `useState`, colocated with the component.
- **Low-frequency cross-cutting state** (theme, locale, config) → one React context per concern, with a memoized value. These change rarely, so the consumer re-render is negligible. Theme follows ADR 0016. (Auth/session is NOT a context — it is async server data and lives in the Query cache below, read via `context.session()`.)
- **Async / shared / ephemeral-realtime state** (server data, the auth session, presence, typing) → the TanStack Query cache. It subscribes selectively (per query, with `select` for slices), so it has no context re-render fan-out. Ephemeral signals use separate keys (ADR 0022).
- **URL-derived shared state** (path, search params, route context) → the TanStack Router store, read via its own selector subscription (`useRouterState({ select })`, `Route.useRouteContext`) — never copied into a React context or a store.
- **Bridging an external browser or manager** (online/offline) → `useSyncExternalStore` with stable subscribe/getSnapshot references (as the shell already does for `onlineManager`).
- **High-frequency or selector-shaped client state** (e.g. a live cursor, a large cross-tree selection set) → **jotai** atoms. Atoms are granular subscription units, so consumers re-render only on the slice they read — the answer to the context re-render concern, not a fat context. Reach for jotai over the zero-dep `useSyncExternalStore` of the previous bullet only when the state needs *composition* — derived atoms, atom families, cross-atom selectors with built-in equality — rather than a single hand-authored store; a lone external store `useSyncExternalStore` already covers does not justify the dependency. jotai is the sanctioned tool for that shape now, so the first such case is built directly on it, not carried through a stopgap→final migration; the package is installed only when a concrete consumer appears (no unused dependency). Its exact version plus React 19 / TanStack Start SSR fit are verified at install time — and if that check ever failed, a swap to another atom/store lib is non-architectural (same subscription model), so the "no re-architecture" promise still holds.
- **No other state library** (redux, zustand, xstate, valtio) without a named need and a new ADR. jotai and zustand share the same external-store subscription model, so a later swap would not re-architect anything.

## Consequences

- Context is confined to low-frequency state, where its re-render cost is a non-issue; high-frequency state never enters a context.
- The high-frequency escape hatch is pre-decided (jotai), so no future re-architecture and no context-vs-store drift.
- Phase 0 adds zero client-state dependencies until a real consumer exists.

## Rejected alternatives

- **Pre-emptively install a state lib now:** an unused dependency, against the repo's dependency rule.
- **Case-by-case, no rule:** invites three different patterns for the same need — the drift this whole review set out to remove.
- **A fat context for high-frequency state:** the re-render fan-out the owner was rightly wary of.

## Reference

- ADR 0016 (theme state — the model low-frequency context).
- ADR 0022 (ephemeral realtime signals on Query-cache keys).
