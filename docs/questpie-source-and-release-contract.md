# QUESTPIE Source and Release Contract

Status: **Active for Phase 0 development**  
Machine-readable authority: [`questpie.release-contract.json`](../questpie.release-contract.json)

## Purpose

Autopilot v2 may use a local QUESTPIE checkout for rapid framework and application development, but a linked checkout is not a release artifact. This contract makes the source baseline, package train, migration window, and Phase 0 acceptance boundary explicit and mechanically testable.

## Audited source baseline

The audit was performed on 2026-07-19 without fetching, pushing, committing, switching branches, or mutating a Git remote.

| Property | Recorded value |
| --- | --- |
| Repository | `/Users/drepkovsky/questpie/repos/questpie-cms` |
| Working branch | `feat/autopilot-prerabka-v1` |
| Baseline merge commit | `725c7e96d4ace6143ab4b54836ccb5e3f5946ee1` |
| Merge first parent | `28f3480aceb653439f36f60078fb3e470d6f3bce` |
| Merged cached upstream commit | `4be15299ffafa8a4808474823815a3dc6d49689d` (`origin/main`) |
| Local `main` at audit time | `09bba7609d0c6d0b554fd939657d084f6492f25c` |
| Published package baseline | `3.16.0` |
| Target Phase 0 package train | `3.17.0` |

Local `main` is 48 commits behind the working branch and reports package version `3.15.2`; it is not a valid release comparison base. The already-cached `origin/main` ref is version `3.16.0`. The working branch is 44 commits ahead of that cached ref, and the current HEAD is the recorded merge commit, so no additional main merge is pending. The committed framework-package delta against cached `origin/main` touches `questpie` and `@questpie/admin`. The audit-time uncommitted capability source touches `@questpie/ai`, `@questpie/mcp`, `@questpie/sandbox`, and private `@questpie/executor`; other fixed-group dirty paths are generated `tsconfig.tsbuildinfo` artifacts rather than reviewed capability source. Because that dirty delta has no commit identity, it is explicitly development-only and must be committed and re-audited before release.

The baseline commit is an ancestry floor, not permission to release an arbitrary descendant. Every framework release candidate must record its new clean source commit on the board and update this contract before the package gate is run.

## Package ownership and versioning

Autopilot v2 directly consumes these runtime packages and pins all of them to one exact released version:

- `questpie`
- `@questpie/ai`
- `@questpie/mcp`
- `@questpie/openapi`
- `@questpie/sandbox`
- `@questpie/tanstack-query`
- `@questpie/workflows`

Local development additionally links private `@questpie/executor` source. It is not a public Phase 0 artifact and is not part of the Changesets fixed group.

The framework's checked-in `.changeset/config.json` is authoritative: the public fixed group contains `questpie`, `@questpie/admin`, `@questpie/ai`, `@questpie/elysia`, `@questpie/hono`, `@questpie/mcp`, `@questpie/next`, `@questpie/openapi`, `@questpie/sandbox`, `@questpie/tanstack-query`, and `@questpie/workflows`. A public additive AI execution contract is a minor release, so the required post-3.16 train is `3.17.0` for every package in that group. The existing audit-time `@questpie/ai` patch changeset is not sufficient to authorize that minor train; the completed upstream contract work needs its own user-facing minor changeset.

`create-questpie` versions independently. It joins this release only if a scaffold change is actually required and reviewed. App-owned collections, commands, query factories, and UI never move into the framework merely to simplify the release.

## Local-link contract

Run:

```sh
bun run framework:link
bun run framework:check
```

`framework:link` accepts `QUESTPIE_FRAMEWORK_ROOT` as an explicit path override. Before changing any symlink it requires the named branch and verifies that the source contains the recorded baseline commit. It links the complete local development package set, preventing an accidental mixture of local and registry implementations.

`framework:check` reports every resolved package, exact source HEAD, and dirty-path count. A dirty checkout is allowed only for local iteration; the warning is evidence that the run is not reproducible or releasable. Updating `bun.lock` does not convert a symlink into a released package.

## Release and Phase 0 AI gate

Run this in Autopilot v2:

```sh
bun run framework:release-gate
```

The gate fails unless all of the following are true:

1. No direct QUESTPIE runtime package resolves into the local framework checkout.
2. Every runtime package installed in `node_modules` reports version `3.17.0`.
3. Every corresponding dependency in `apps/operator-web/package.json` is the exact string `3.17.0`; ranges and workspace links are rejected.
4. The package set is homogeneous; mixed local and released runtimes are rejected.
5. The app lockfile has been regenerated from those exact manifest pins and the normal repository verification passes.

Therefore local framework links can support development and contract tests, but they can never pass the Phase 0 AI acceptance gate.

The framework release candidate must additionally pass its own package gates before publication:

```sh
bun run lint
bun run check-types
bun run test
bun run build
bun run validate
```

Versioning and publication remain framework-owner actions: create and review a minor Changeset, run `bun run version`, and let the existing release workflow build and publish in topological order. Autopilot agents do not publish, tag, push, or otherwise mutate the remote.

## Migration window

The migration window is the single controlled transition from the exact `3.16.0` app dependency set to the exact `3.17.0` set. It begins only after the clean framework release commit and package artifacts exist, and ends after the app is installed from registry packages, regenerated, migrated, verified, and the release gate passes.

Rules for that window:

1. Phase 0 schema migrations are app-owned and generated with the released `3.17.0` CLI, not a dirty linked CLI.
2. Schema changes must be committed QUESTPIE migrations. `push`, `migrate:fresh`, and reset commands are development tools and are forbidden for the acceptance or production database.
3. Phase 0 migrations must be additive or use an explicit expand/backfill/contract sequence. Destructive cleanup is deferred beyond the compatibility window.
4. Before deployment, exercise migration status, up, down where reversibility is promised, and up again against a disposable copy with representative Hrebeň data.
5. The migrated database must not be served concurrently by mixed `3.16.0` and `3.17.0` application runtimes. Roll back the application only while the schema remains backward-compatible; otherwise restore through the reviewed migration/backup procedure.
6. Package release precedes app migration. A database migration never compensates for missing or locally linked package artifacts.

The Phase 0 AI gate remains closed throughout local-link development. It opens only at the end of this window after package, app, migration, negative-oracle, and end-to-end evidence are attached to the board.

## Promotion checklist

- Record the clean release-candidate commit and confirm it descends from the baseline.
- Diff that commit against cached or approved upstream main and list changed public packages.
- Confirm the fixed Changesets group and the `3.17.0` minor changeset.
- Pass framework lint, types, tests, builds, validation, package-export checks, and package contract tests.
- Publish the complete fixed train through the owner-controlled release workflow.
- Replace all Autopilot exact pins with `3.17.0`, install, and commit the resulting lockfile.
- Run code generation and the additive migration rehearsal.
- Run Autopilot lint, type checks, tests, builds, scenario harness, and `framework:release-gate`.
- Attach exact package resolutions and migration evidence to Agent Board before Phase 0 acceptance.
