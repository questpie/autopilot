# @questpie/autopilot-orchestrator

## 2.1.0-canary.1

### Minor Changes

- Dogfood Day 1: scheduling, queues, dependencies, retry policies, CLI overhaul

  **Runtime Streaming (Pass 25.10):** All 3 adapters (Claude Code, Codex, OpenCode) stream tool_use + progress events in real-time. Rich tool descriptions with file paths and arguments.

  **Task-Scoped Worktrees (Pass 25.12):** Worktree per task (not per run). Slugified task IDs. Parent branch divergence for child tasks.

  **Context Assembly (Pass 25.13):** Injected context from `.autopilot/context/` + discovery hints from `context_hints` in company.yaml. Global context + per-step context layers.

  **MCP Auth Hardening (Pass 26.2):** machineSecret Bearer fallback in authMiddleware, AUTOPILOT_LOCAL_DEV env for local dev, SSE transport auth guard.

  **Scheduler Daemon (Pass 26.3):** Real cron execution via croner. Task + query modes. Concurrency policies. One-shot delayed execution. Execution history ledger. MCP tools for agent-created schedules.

  **Task Queues:** Configurable concurrency per queue. Priority ordering. Auto-release on completion.

  **Task Dependencies:** depends_on relations with cycle detection. Event-driven wake-up via DependencyBridge. Auto-fail on dep failure.

  **Retry Policies:** Per-step and company-wide defaults. Error classification (infra/timeout/rate_limit/business). Configurable backoff. Exhaustion actions (fail/escalate/skip).

  **Worker Concurrency:** Multiple runs in parallel per worker. Configurable via --concurrency flag.

  **CLI Surface Overhaul:** Singular naming (task/run/workspace/schedule/queue/config). LiveRenderer for in-place updates. task progress with SSE live updates. run watch. workspace list/show/diff/cleanup/merge. run retry. task delete. config inspection.

  **Crash Recovery:** Startup stale lease recovery. Periodic 60s cleanup timer. Worker deregister on restart. Heartbeat renews all active leases.

### Patch Changes

- Updated dependencies []:
  - @questpie/autopilot-spec@1.1.0-canary.1

## 2.1.0-canary.0

### Minor Changes

- [`4558577`](https://github.com/questpie/autopilot/commit/455857765ef97937992cad5fea1f632be1c7b987) Thanks [@drepkovsky](https://github.com/drepkovsky)! - Canary alpha: deployment packaging, operator tooling, runtime selection pipeline

  **Deployment (Pass 25.3):** Docker orchestrator-only packaging, fresh-volume bootstrap, healthcheck, Watchtower opt-in auto-update, Caddy TLS profile, deploy directory with VPS quick-start.

  **Operator Doctor (Pass 25.4):** `autopilot doctor` validates company root, secrets, URLs, Docker packaging, runtime binaries, and orchestrator health. Supports `--offline`, `--json`, `--require-runtime`.

  **Release/Update (Pass 25.7):** `autopilot version` shows local + remote orchestrator versions. `autopilot update check` queries npm registry with `--channel stable|canary`. `/api/health` now returns orchestrator version. Stable/canary channel model defined. Docker rollback via pinned image tags.

  **Runtime Setup (Pass 25.8):** Per-runtime tutorials for Claude Code, Codex, and OpenCode covering install, auth, MCP config, and V1 caveats. VPS deployment runbook with end-to-end walkthrough.

  **Runtime Selection (Pass 26.1):** Agent config carries canonical `model`, `provider`, `variant`. Orchestrator propagates to runs and claimed run contracts. Worker resolves via `modelMap` and passes `--model` to adapters. No flag when no model is set — runtime defaults preserved.

### Patch Changes

- Updated dependencies [[`4558577`](https://github.com/questpie/autopilot/commit/455857765ef97937992cad5fea1f632be1c7b987)]:
  - @questpie/autopilot-spec@1.1.0-canary.0

## 1.0.0

### Major Changes

- [`6835941`](https://github.com/questpie/autopilot/commit/6835941c81d91a2e9575636b3d679b4520c446b7) Thanks [@drepkovsky](https://github.com/drepkovsky)! - Initial public release of QUESTPIE Autopilot.

  AI-native company operating system. Filesystem as database, agents as employees, workflows as YAML.

### Patch Changes

- Updated dependencies [[`6835941`](https://github.com/questpie/autopilot/commit/6835941c81d91a2e9575636b3d679b4520c446b7)]:
  - @questpie/autopilot-spec@1.0.0
  - @questpie/autopilot-agents@1.0.0
