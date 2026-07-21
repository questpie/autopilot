# ADR 0024: Client state — React primitives, Query cache, context; jotai for high-frequency

- Status: accepted
- Date: 2026-07-21

## Context

operator-web ships no client-state library. State today is React primitives (7 files with `useState`, no `useReducer`), the TanStack Query cache (all async/shared state), one theme context (ADR 0016), and `useSyncExternalStore` over TanStack's `onlineManager` for online/offline. ADR 0022 already routes ephemeral realtime signals (presence, typing) to separate Query-cache keys, not a store.

The open question was a rule plus an escape hatch. The one real concern raised: React Context re-renders every consumer when its value changes, so a fat, frequently-changing context is a performance trap.

## Decision

- **Local UI state** → `useState`, colocated with the component.
- **Low-frequency cross-cutting state** (theme, auth, locale, config) → one React context per concern, with a memoized value. These change rarely, so the consumer re-render is negligible. Theme follows ADR 0016.
- **Async / shared / ephemeral-realtime state** (server data, presence, typing) → the TanStack Query cache. It subscribes selectively (per query, with `select` for slices), so it has no context re-render fan-out. Ephemeral signals use separate keys (ADR 0022).
- **Bridging an external browser or manager** (online/offline) → `useSyncExternalStore` with stable subscribe/getSnapshot references (as the shell already does for `onlineManager`).
- **High-frequency or selector-shaped client state** (e.g. a live cursor, a large cross-tree selection set) → **jotai** atoms. Atoms are granular subscription units, so consumers re-render only on the slice they read — this is the answer to the context re-render concern, not a fat context. jotai is the sanctioned tool now, so the first such case is built on it and never migrated; the package is installed only when a concrete consumer appears (no unused dependency), and its exact version plus React 19 / TanStack Start SSR fit are verified at install time.
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
