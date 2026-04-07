---
"@questpie/autopilot": minor
"@questpie/autopilot-spec": minor
"@questpie/autopilot-orchestrator": minor
"@questpie/autopilot-worker": minor
---

Canary alpha: deployment packaging, operator tooling, runtime selection pipeline

**Deployment (Pass 25.3):** Docker orchestrator-only packaging, fresh-volume bootstrap, healthcheck, Watchtower opt-in auto-update, Caddy TLS profile, deploy directory with VPS quick-start.

**Operator Doctor (Pass 25.4):** `autopilot doctor` validates company root, secrets, URLs, Docker packaging, runtime binaries, and orchestrator health. Supports `--offline`, `--json`, `--require-runtime`.

**Release/Update (Pass 25.7):** `autopilot version` shows local + remote orchestrator versions. `autopilot update check` queries npm registry with `--channel stable|canary`. `/api/health` now returns orchestrator version. Stable/canary channel model defined. Docker rollback via pinned image tags.

**Runtime Setup (Pass 25.8):** Per-runtime tutorials for Claude Code, Codex, and OpenCode covering install, auth, MCP config, and V1 caveats. VPS deployment runbook with end-to-end walkthrough.

**Runtime Selection (Pass 26.1):** Agent config carries canonical `model`, `provider`, `variant`. Orchestrator propagates to runs and claimed run contracts. Worker resolves via `modelMap` and passes `--model` to adapters. No flag when no model is set — runtime defaults preserved.
