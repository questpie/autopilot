# @questpie/autopilot-mcp

## 1.0.1-canary.1

### Patch Changes

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

- Updated dependencies []:
  - @questpie/autopilot-orchestrator@2.1.0-canary.1

## 1.0.1-canary.0

### Patch Changes

- Updated dependencies [[`4558577`](https://github.com/questpie/autopilot/commit/455857765ef97937992cad5fea1f632be1c7b987)]:
  - @questpie/autopilot-orchestrator@2.1.0-canary.0
