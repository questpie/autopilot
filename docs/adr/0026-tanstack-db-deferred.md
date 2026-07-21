# ADR 0026: TanStack DB is deferred (revisit at 1.0 + SSR)

- Status: accepted
- Date: 2026-07-21

## Context

TanStack DB — client collections, incremental (differential-dataflow) live queries, and transactional optimistic mutations — is a natural substrate for realtime collaborative data, and was proposed both as a replacement for the ADR 0022 react-query pattern and as a QUESTPIE integration (`@questpie/tanstack-db`, denormalized collections as sources, a `tdb.collections.*` typed surface). It was evaluated against primary sources; full analysis in `docs/architecture/tanstack-db-evaluation.md`.

## Decision

- **Do not adopt TanStack DB in Phase 0.** Keep the ADR 0022 realtime-first react-query pattern, which already has a working SSR seed and covers the phase-0 needs.
- Reasons (grounded):
  - **Maturity:** core `@tanstack/db` is 0.6.x, `react-db` 0.1.x, the `db-ivm` engine 0.1.x — all pre-1.0; the 1.0 target slipped 7+ months and maintainers call it experimental.
  - **Sync mismatch:** DB's sync contract is row-delta-native (`begin/write/commit/truncate`); our realtime is SSE full-snapshot-replace. Feeding it snapshots is against the grain — the adapter would have to diff each snapshot back into row-ops, re-deriving the delta the transport deliberately discards.
  - **SSR regression:** DB has no SSR/hydration story for a custom sync path, versus our shipped loader → hydrate → stream-upgrade.
  - **The reconciler shrinks but does not disappear:** the SSE transport, multiplexer, replay ledger, and snapshot server all remain; DB would sit above that backbone, not replace it.
- **Future direction:** revisit when TanStack DB reaches 1.0 with a real SSR story — and then as a `@questpie/tanstack-db` framework package (owned upstream in `questpie-cms`, per framework-capability-reuse), ideally paired with a QUESTPIE **delta / change-stream realtime mode**, since the full-snapshot-replace model is the core mismatch with DB's incremental engine.

## Consequences

- Phase 0 avoids a pre-1.0 core dependency and an SSR regression.
- The ADR 0022 pattern stands unchanged.
- Adoption stays open and, when it happens, is framework-owned rather than app-local — one integration, not a per-app reinvention.

## Rejected alternatives

- **Adopt now, app-local:** maturity risk plus an SSR regression on a phase-0 product.
- **Adopt now as a framework package:** same maturity risk, and premature before a real surface needs DB's incremental cross-collection joins.

## Reference

- `docs/architecture/tanstack-db-evaluation.md`
- ADR 0022 (the pattern retained).
