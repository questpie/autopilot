# ADR 0007: Goals Use Criteria and Tasks Form a Semantic Graph

- Status: accepted
- Date: 2026-07-19

## Context

Week 1 needs a work model that distinguishes outcomes from activity, gives Task lists a stable workflow, and supports real dependencies without prematurely building configurable workflow software or a deep issue hierarchy.

## Decision

### Goal achievement

- Goal progress is derived from independently assessable Criteria.
- Completed Tasks are evidence and may influence presentation, but never automatically prove Goal achievement.
- An authorized Actor explicitly confirms that a Goal is `achieved` after reviewing its Criteria.
- Manual percentage entry is not the source of truth.

### Task workflow

The canonical Phase-0 Task statuses are:

`backlog → ready → in_progress → in_review → done`

`blocked` and `cancelled` are explicit alternate states. `overdue`, `waiting_for_permission`, and failed Agent Run indicators are derived signals rather than additional Task statuses.

The workflow is not customizable per Space in Phase 0.

### Task topology

- Tasks form a flat semantic graph.
- Stored relationship kinds are `blocks`, `relates_to`, and `duplicates`.
- `blocked_by` is the inverse view of `blocks`, not a separately stored edge.
- Phase 0 has no parent/subtask hierarchy.

## Consequences

- Finishing activity cannot silently claim an outcome was achieved.
- The interface can show honest Goal progress with Criteria evidence and a deliberate confirmation action.
- Task status remains compact while derived attention signals remain composable.
- Dependencies can cross-cut work without ambiguous parent ownership or recursive authorization.

## Rejected alternatives

- **Auto-achieve Goal when all Tasks are done:** conflates output with outcome.
- **Manual progress percentage:** lacks auditable evidence and becomes stale.
- **Three-state Task workflow:** cannot distinguish readiness, review, blockage, and cancellation.
- **Custom workflows in Phase 0:** expands schema and UI before dogfood validates the canonical flow.
- **Parent/subtask tree:** forces one structural meaning where semantic relations are required.
- **Tree plus graph in Phase 0:** adds two competing organization systems before either is validated.
