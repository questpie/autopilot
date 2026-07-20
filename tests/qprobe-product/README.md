# Product qprobe recordings

Real-browser regression recordings for the operator-web PRODUCT, replayed with pure
Playwright against a scenario-harness server (disposable Postgres, per-run random
port). The Storybook design-kit surface lives separately in `tests/qprobe`.

## Configs

- `qprobe.config.ts` (repo root) — PRODUCT default. `tests.dir` points here
  (absolute), agent-browser driver, headless, deliberately **no baseUrl**: the
  server base is per-run, so every replay passes `--base`.
- `qprobe.storybook.config.ts` — Storybook kit (`tests/qprobe`, base
  `http://127.0.0.1:6007`). Select it explicitly:
  `QPROBE_CONFIG=qprobe.storybook.config.ts qprobe <command>`.

The distinct `tests.dir` values are the real isolation: `qprobe replay`
unconditionally rewrites `<tests.dir>/playwright.config.ts` on every run, baking in
the `--base` URL. `tests/qprobe-product/playwright.config.ts` is therefore
gitignored (as is `test-results/`); `tests/qprobe/playwright.config.ts` stays
committed and must never be clobbered by product replays —
`apps/operator-web/tests/scenario-harness/qprobe-replay.test.ts` proves both.

## Naming

One spec per Phase-0 flow, named `f01-*.spec.ts` … `f10-*.spec.ts`
(e.g. `f01-sign-in.spec.ts`, `f04-goal-breakdown.spec.ts`). `harness-smoke.spec.ts`
is the hand-curated seed proving the replay pipeline end to end.

## Selector discipline

- CSS/data-testid selectors ONLY. `@e` snapshot refs from `qprobe browser snapshot`
  pass through codegen verbatim and do NOT replay — rewrite them before committing.
- Use the stable data-testid vocabulary from
  `apps/operator-web/tests/scenarios/phase-0/contracts.ts` (`stableSelectors`),
  e.g. `[data-testid="screen-sign-in"]`, as those screens land.
- Never bake absolute origins into specs — `page.goto("/")` rides the per-run
  `--base`.

## Replay recipe

```bash
bun run --cwd apps/operator-web test:scenario-harness:serve   # prints base url
# in another terminal, from the repo root:
cd tests/qprobe-product && QPROBE_CONFIG="$(pwd)/../../qprobe.config.ts" \
  qprobe replay harness-smoke --base http://localhost:<port> --browser chromium
```

- `--browser chromium` is pinned: only chromium is in the local Playwright cache.
- Playwright discovers the generated `playwright.config.ts` only when its cwd IS
  this directory, hence the `cd`; `QPROBE_CONFIG` (absolute path) keeps the product
  config authoritative regardless of cwd.
- Requires the machine-global CLI: `bun add -g @questpie/probe`.

## Recording recipe

```bash
bun run --cwd apps/operator-web test:scenario-harness:serve   # boots db+server, prints base url
qprobe record start "f01-sign-in"
qprobe browser open http://localhost:<port>/
# ... interact via qprobe browser commands ...
qprobe record stop        # writes recordings/f01-sign-in.{json,spec.ts}
```

Then hand-audit the generated spec: replace any `@e` refs with CSS/testid
selectors, strip absolute origins, and re-run the replay recipe until green.
Per-run credentials die with the dropped disposable database; never commit real
secrets into recordings.
