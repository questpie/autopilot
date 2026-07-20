# ADR 0009: Agent Effects, Delegation, and Run Attempts

- Status: accepted
- Date: 2026-07-19

## Context

Independent Agents need enough autonomy to perform useful work without requiring approval for every internal update. The same system must contain high-impact effects, prevent recursive Agent loops, and preserve an honest history when work is cancelled or retried.

## Decision

### Effect policy

- `ai.suggest` produces a non-binding result and writes no work-object change until an authorized Human accepts it.
- An Agent may perform reversible internal effects when both its own RBAC and selected Skill/run capability policy permit them.
- External, destructive, financial, and access-control effects require a Review Gate or a specific Run-scoped permission.
- A new or steered request that expands effect scope is evaluated again before execution.

### Agent delegation

- Agent-to-Agent Mention and assignment produce child Runs with explicit `rootRun`, `parentRun`, depth, and requester/executing-Actor lineage.
- Phase 0 uses a default maximum delegation depth of three.
- Dispatch rejects a repeated Agent-plus-request fingerprint within the same lineage.
- When the depth or cycle guard stops delegation, the current Agent reports it in the Thread and asks a Human for direction rather than silently continuing.

### Cancellation and retry

- An authorized Actor may request best-effort cancellation of an active Run.
- Terminal Runs are immutable attempts.
- `Run again` creates a new Run linked to the previous attempt and never reopens or overwrites it.
- Effects committed before cancellation remain attributable; cancellation cannot pretend they never happened.

## Consequences

- Ordinary internal Agent work remains useful without approval fatigue.
- High-impact boundaries are visible and reviewable.
- Delegation is composable but cannot recurse indefinitely.
- Run history accurately represents attempts, costs, permissions, and effects.

## Rejected alternatives

- **Approve every write:** creates approval fatigue and makes Agents passive suggestions engines.
- **All RBAC-permitted effects are automatic:** ignores effect risk and external consequences.
- **Unbounded Agent delegation:** permits cycles, runaway cost, and unclear responsibility.
- **Reopen a terminal Run:** destroys attempt history and complicates idempotency.
- **No cancel or retry controls:** leaves Actors unable to intervene in long or mistaken work.
