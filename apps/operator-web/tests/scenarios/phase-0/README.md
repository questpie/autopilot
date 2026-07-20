# Phase 0 scenario harness

This directory is the executable behavior registry for `SPEC.md` flows F01-F10.
Product copy is Slovak, while scenario names and selectors are deliberately
locale-independent.

`harness.test.ts` and `case-matrix.test.ts` verify the reusable fixtures and
the scenario metadata. `product-scenarios.test.ts` registers every accepted
product journey still listed in `phase0PendingExecutableFlows` as a bodyless
`test.todo` entry — a pending manifest of unimplemented journeys, never a red
executable test: bun only counts them, nothing runs and nothing can fail. Each
blocked vertical slice replaces its todo with a real public-seam failing test
(HTTP, PostgreSQL, Channels, or browser) without renaming the flow, and
removes its flow id from `phase0PendingExecutableFlows` in the same change —
the todo loop and the manifest share one source, so they cannot diverge.

| Capability | Fixture | Contract |
| --- | --- | --- |
| Disposable tenant | `createDisposableCompanyFixture` | unique Company/database identity and explicit teardown |
| Auth | `startAuthFixture` | real HTTP, cookie and redirect behavior |
| Time | `FixtureClock` | deterministic delays, deadlines and stale verification |
| Provider | `ProviderFixture` | valid, invalid, unavailable, model-less and capacity-less outcomes |
| Queue | `ControllableQueueFixture` | delayed and duplicate delivery with attempt evidence |
| Deduplication | `IdempotencyFixture` | one effect for duplicate command/outbox/worker delivery |
| Realtime | `RealtimeGapFixture` | bounded replay and explicit truth-refetch gap |
| Authorization | `RbacFixture` | exact Company/Space scope without implicit widening |
| Evidence | `ScenarioEvidenceRecorder` | browser/server/network/console evidence with secret-key rejection |
| Accepted flow profiles | `phase0FixtureProfiles` | exact F01 invitation modes, F03 Space-anchored Channels, F06 permission routes, and deterministic F08 Agent activation/Run lineage |
| Universal state obligations | `stateObligationRegistry` | one owning flow/proof task, explicit reuse, exact selectors, fixture-mode ids, layers and absence assertion for every `US-*` row |
| Query-state completeness | `phase0QueryStateCoverage` | every accepted query-backed screen dispositions all loading/empty/no-results/error/access/archive/conflict/mutation/realtime/long-copy states or a binding `NA-*` reason |
| Case matrix | `phase0CaseMatrix` | stable `FNN-PNN`/`FNN-NNN` case ids binding every F01-F10 flow to layer, server requirement, fixture capabilities and accepted fixture modes, exercised actors, permission state, positive observation, absence assertions and selectors; `phase0UncasedModeLedger` forces explicit triage of every registry fixture mode |

The registry test checks the complete accepted selector list for every F01-F10
flow. It intentionally does not mark a product journey complete: selectors and
fixture profiles are only prerequisites for replacing the corresponding
`test.todo` with real persistence, HTTP, and browser evidence. The case matrix
is the same kind of metadata: a green `test:phase-0` run proves only that the
scenario plan is complete and internally consistent. It decomposes the F01-F10
journeys and negative oracles; per-surface state completeness stays owned by
`phase0QueryStateCoverage`. It is never citable as behavior, HTTP, database,
realtime, or browser completion — still-pending executable product flows are
tracked by `phase0PendingExecutableFlows` (currently all ten).

Case actor vocabulary is capped at each contract's `actors` list; where
accepted proof tasks name additional personas (F03 Lucia/Autopilot, F06
ineligible recipients, F08 the requesting Human), the exact Actor state is
recorded in the case's `permissionState` field, and nine accepted case names
with no accepted fixture-mode id are tracked modeless in `phase0ModelessCases`
rather than by invented vocabulary.

Run the focused contract with:

```sh
bun run --cwd apps/operator-web test:phase-0
```

Normal verification does not execute todos. `bun test --todo
tests/scenarios/phase-0` lists the pending manifest; it does not execute the
journeys.

Harness baseline: `@questpie/operator-web` 0.0.1, Bun 1.3.14, and QUESTPIE
packages declared at 3.16.0. During initial development, QUESTPIE is locally
linked from the framework repository; board evidence records the exact linked
commit used for verification.

## Supersession: real scenario harness

The synthetic auth/company/realtime fixtures in this directory remain
CONTRACT-LAYER tools only. Product-level proofs (real Better Auth cookies over
HTTP, typed commands/reads, queue drain, channel replay gaps, browser replays)
are owned by the real harness in `tests/scenario-harness/` (library:
`tests/scenarios/harness/real/`) — see its README. New user-facing behavior gets
its proof there, not as new synthetic fixtures here.
