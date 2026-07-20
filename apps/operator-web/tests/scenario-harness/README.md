# Real operator-web scenario harness

Boots the BUILT production server (`.output/server/index.mjs`) against a disposable
PostgreSQL database and proves product behavior over real HTTP/SSE — auth cookies,
typed commands/reads, queue drain, channel replay gaps, qprobe browser replays —
with per-run evidence under `apps/operator-web/tmp/scenario-harness/<runId>/`.
Library lives in `tests/scenarios/harness/real/`; suites live here.

## Environment contract

- Docker Postgres must be up (`operator-web-postgres` on 5432): `docker compose up -d`.
- Admin connection = `HARNESS_PG_ADMIN_URL` when set, else `DATABASE_URL` from
  `apps/operator-web/.env` (the test process legitimately auto-loads it; every
  CHILD process is spawned `bun --no-env-file` with an allowlist env instead).
- An unreachable admin URL fails loudly with the docker hint — never a skip.
- Disposable DBs are named `qp_harness_<yyyymmddhhmmss>_<rand6>`; every harness
  start sweeps matching names whose name-encoded timestamp is >30min old.
- The build phase resolves app env via createEnv: locally `apps/operator-web/.env`
  satisfies it; CI must provide `DATABASE_URL` (and peers) before the gate's build.
- The qprobe replay leg requires the machine-global CLI (`bun add -g @questpie/probe`)
  plus the chromium Playwright cache; absence fails loudly with the install hint.

## Run recipes

- Gate (what `bun scripts/verify-work.ts` runs):
  `bun run --cwd apps/operator-web test:scenario-harness`
  Build-always is deliberate: the framework repo is symlinked, so only a fresh
  `bun run build` keeps proofs stale-free. Expect minutes, not seconds.
- Inner loop: `cd apps/operator-web && bun run build` once, then
  `bun test --timeout 240000 --no-orphans tests/scenario-harness/<file>`.
- Recording session: `bun run --cwd apps/operator-web test:scenario-harness:serve`
  boots db+server, prints the base URL/db name, tears down on Ctrl+C. Product
  replays: see `tests/qprobe-product/README.md` at the repo root.
- The fast default sweep (`bun run test`) path-ignores this directory; that
  exclusion is honest only because the verify gate wires the heavy suite in, and
  `tests/scenarios/harness-guards.test.ts` (always swept) enforces the invariants.

## Leak guarantees

- `--no-orphans` REAPS descendant processes on crash; it is never the proof.
  Detection is explicit: stop() resolves only once the port refuses TCP and is
  rebindable; isolation tests SIGKILL the child and still converge; DBs are
  dropped `WITH (FORCE)` and stale ones age-swept.
- Child env is allowlist-built (PATH/HOME/TMPDIR/NODE_ENV/TEST/PORT/APP_URL/
  DATABASE_URL/BETTER_AUTH_SECRET only) — dev credentials and NITRO_/QUESTPIE_
  vars cannot leak in; per-run BETTER_AUTH_SECRET is random.
- Evidence redaction is value-level: every registered secret (db passwords,
  auth secret, session cookies, sign-up passwords) is scrubbed from the server
  log tee, transcripts, and manifest; `qprobe-replay.test.ts` extends the scan
  over `test-results/` and `tests/qprobe-product/` which qprobe writes directly.

## Fault-control inventory

- QUEUE — deterministic by construction: nothing auto-consumes pg-boss in the
  disposable DB; `drainQueue()` spawns `real/drain-queue.entry.ts` (the only
  `#questpie` importer) running `QueueService.runOnce` in its own process.
- CHANNELS — four levers: (1) test-owned TCP gate (`real/tcp-gate.ts`, byte-blind
  relay) for deterministic disconnect windows; (2) `server.restart()` same
  port+DB for cross-process ledger durability; (3) admin-SQL FRONT-prune of
  `questpie_channel_event` — the only deletion shape that fires the verified gap
  predicate (mirrors the retention sweep) — yielding the exact
  'Channel event replay gap' error; (4) clean abort as the documented negative
  (unsubscribe wipes the transport cursor by design — not a fault lever).
- PROCESS — TEST=1 disables the srvx graceful-shutdown plugin in the built
  bundle: SIGTERM is immediate and identical local/CI, SIGKILL is the fallback.
- CLOCK — no clock seam exists in the product; FixtureClock stays contract-layer.
  Reserved pattern for the F-task that needs one: inject a clock indirection at
  the owning module seam, never monkeypatch the built server.
- PROVIDER — no provider integration exists yet; ProviderFixture stays
  contract-layer. Reserved pattern: an env-pointed stub provider HTTP server the
  child env allowlist points at, landing with the F-task that adds the product code.

## AC3 redirect-facet status

No framework redirect surface exists under `/api` yet: the admin-mount probe in
`auth-http.test.ts` asserts the real observed equivalent (identical 404, no
Location, anonymous AND authed). The redirect facet is explicitly DEFERRED to
F01's guarded sign-in route — extend that test when the route lands; no fake proof.

## Known deviations (documented, with upstream pointers)

See the harness section of `docs/architecture/framework-capability-reuse.md`:
direct Bun.spawn instead of `qprobe start`, the SQL `emailVerified` flip pending
an upstream verification email, the SQL ledger front-prune, and the TCP gate.
