# QUESTPIE Autopilot — Progress Tracker

> What's done, what's missing, what's next.
> Last updated: 2026-03-22

---

## Overall Status: 434+ tests | 9,200+ LOC | 4 packages

---

## Phase 0: Monorepo Setup ✅ DONE

- [x] Bun workspace + Turbo
- [x] biome.json, tsconfig.base.json, turbo.json
- [x] Package structure (spec, orchestrator, cli, agents, web)
- [x] .gitignore, LICENSE (MIT)

## Phase 1: Landing Page ✅ DONE

- [x] TanStack Start app in apps/web/
- [x] All 13 sections from landing-page.jsx
- [x] Animated LiveStream component
- [x] Waitlist form
- [x] 8 documentation pages
- [x] Dockerfile (multi-stage, Bun-based)
- [x] Deployed at autopilot.questpie.com
- [x] k8s manifests (deployment, service, ingress, middleware)
- [x] Woodpecker CI pipeline

## Phase 2: README & Branding ✅ DONE

- [x] Hero README with badges, CLI demo, roadmap
- [x] CONTRIBUTING.md
- [x] Internal architecture doc (docs/internal/architecture.md)

## Phase 3: @questpie/autopilot-spec ✅ DONE (139 tests)

- [x] 16 Zod schemas (company, agent, task, message, workflow, schedule, webhook, watcher, threshold, transport, policy, pin, session, memory, secret, human)
- [x] Constants (10 enum arrays)
- [x] Path conventions (PATHS + 8 dynamic helpers)
- [x] Type exports (z.infer)
- [x] loadAndValidate helper
- [x] Tests: valid data, invalid data, defaults, all enums

## Phase 4: Company Template ✅ DONE (30 tests)

- [x] company.yaml, agents.yaml (8 agents), humans.yaml
- [x] 3 workflows (development 12-step, marketing 7-step, incident 8-step)
- [x] schedules.yaml, webhooks.yaml, approval-gates.yaml
- [x] dashboard/groups.yaml
- [x] 20 placeholder directories with .gitkeep
- [x] Template validation tests

## Phase 5: Agent Prompts ✅ DONE (83 tests)

- [x] 8 prompt templates (CEO, strategist, planner, developer, reviewer, devops, marketing, design)
- [x] buildSystemPrompt() with context injection
- [x] Tests: content, structure, isolation rules, all roles

## Phase 6: Orchestrator ✅ CORE DONE (147 tests) — NEEDS HARDENING

### FS Layer ✅
- [x] yaml.ts — read/write with Zod validation
- [x] tasks.ts — create, read, update, move, list, find
- [x] messages.ts — channel + direct messages
- [x] pins.ts — create, remove, list, update
- [x] activity.ts — JSONL append + read
- [x] company.ts — load company, agents, humans, workflows, schedules, webhooks

### Workflow Engine ✅
- [x] engine.ts — state machine, transitions, human gates, terminal steps
- [x] loader.ts — YAML loading with cache

### Context Assembler ✅
- [x] assembler.ts — 4-layer context assembly
- [x] snapshot.ts — role-scoped company state
- [x] memory-loader.ts — load agent memory.yaml

### Infrastructure ✅
- [x] scheduler.ts — node-cron based
- [x] watcher.ts — chokidar with debounce
- [x] webhook/server.ts — Bun.serve HTTP
- [x] session/stream.ts — subscribe/emit/cleanup

### Composition ✅
- [x] server.ts — Orchestrator class
- [x] notifier.ts — activity log + console

### ❌ NOT YET IMPLEMENTED (Orchestrator)
- [x] **Write Queue** — file-level locking for concurrent writes ✅
- [x] **Agent Spawner (Agent SDK)** — Claude Agent SDK `query()` integration ✅ (being built)
- [x] **Memory Extractor** — post-session Haiku summarization ✅ (being built)
- [x] **Custom MCP Tools** — send_message, create_task, pin_to_board via createSdkMcpServer ✅ (being built)
- [ ] **Notifier Transports** — email, WhatsApp, Slack (currently only console + activity log)
- [ ] **Embedding Indexes** — semantic search (text-embedding-3-small)
- [ ] **Linear Sync** — bidirectional task ↔ issue sync

### ⚠️ NEEDS MORE TESTS (Business-Critical) — ✅ Hardened
- [x] Workflow engine: rejection loops with max rounds ✅
- [x] Workflow engine: timeout handling ✅
- [x] Workflow engine: conditional transitions (if_priority_critical, if_flag) ✅
- [x] Task CRUD: concurrent write scenarios ✅
- [x] Task CRUD: move task triggers workflow check ✅
- [x] Server: full event pipeline (watcher → workflow → agent assignment) ✅
- [x] Server: error recovery (crash mid-session) ✅
- [x] Server: max_concurrent_agents enforcement ✅
- [x] Context assembler: token budget overflow handling ✅
- [x] Context assembler: memory relevance ranking ✅
- [x] Webhook server: HMAC-SHA256 verification with real signatures ✅
- [x] Scheduler: schedule timeout enforcement ✅
- [x] Scheduler: on_failure behavior (alert_human, retry) ✅

## Phase 7: CLI ✅ SCAFFOLDED (23 tests) — NEEDS INTEGRATION

- [x] Commander.js framework
- [x] 8 commands registered (init, status, ask, tasks, agents, inbox, attach, start)
- [x] find-root utility
- [x] ANSI formatting helpers
- [x] Template copy on init

### ❌ NOT YET WIRED
- [x] `start` → instantiate Orchestrator, run lifecycle ✅ (being built)
- [x] `ask` → create task via SDK, spawn CEO ✅ (being built)
- [ ] `attach` → WebSocket stream from SessionStreamManager
- [ ] `tasks approve/reject` → update task + trigger workflow
- [ ] Error handling and user-friendly messages
- [ ] Interactive prompts for init (company name, email, etc.)

## Phase 8: Dogfooding ❌ NOT STARTED

- [ ] Set up QUESTPIE s.r.o. as first company
- [ ] Populate knowledge base
- [ ] Run real tasks through the system
- [ ] Fix bugs found during usage

## Phase 9: Triggers & Polish ❌ NOT STARTED

- [ ] Email transport (Resend API)
- [ ] WhatsApp transport (Twilio)
- [ ] Dashboard (React web UI reading from FS)
- [ ] Session replay command
- [ ] Cost tracking and budget alerts

## Phase 10: Public Launch ❌ NOT STARTED

- [ ] Demo video (2-3 min)
- [ ] Remove "Coming Soon" badge
- [ ] Product Hunt launch
- [ ] Hacker News "Show HN"
- [ ] npm publish @questpie/autopilot

---

## Priority Matrix: What To Build Next

### P0 — Must Have for Dogfooding
1. ~~**Write Queue**~~ ✅ — in-process async mutex with file-level granularity
2. ~~**Agent Spawner (Agent SDK)**~~ ✅ (being built) — Claude Agent SDK `query()` integration
3. ~~**Custom MCP Tools**~~ ✅ (being built) — send_message, create_task, pin_to_board via createSdkMcpServer
4. ~~**Memory Extractor**~~ ✅ (being built) — agents need to remember across sessions
5. ~~**CLI `start` command**~~ ✅ (being built) — needs to run the orchestrator
6. ~~**CLI `ask` command**~~ ✅ (being built) — needs to spawn CEO agent

### P1 — Must Have for Public Release
7. ~~**Business-critical test hardening**~~ ✅ — concurrent writes, rejection loops, error recovery
8. **CLI `attach` command** — WebSocket session streaming
9. **Webhook HMAC verification** — security
10. **Notifier email transport** — users need to receive notifications

### P2 — Polish & Extend
11. Interactive CLI prompts (init wizard)
12. Dashboard web UI (thin React app over SDK)
13. Embedding indexes (semantic search via text-embedding-3-small)
14. Cost tracking and budget alerts

### Note on Integrations

**No integration is hard-coded.** All integrations (Linear, GitHub, Slack, Stripe,
Figma, Twilio, etc.) follow the same 3-part pattern:

```
Integration = Secret + Knowledge Doc + Primitive (MCP or http_request)
```

1. **Secret** — `/secrets/{service}.yaml` (API key, allowed_agents)
2. **Knowledge Doc** — `/knowledge/integrations/{service}.md` (API docs, conventions)
3. **Primitive** — Agent calls `http_request` with `secret_ref` or uses MCP server

Linear "sync" is NOT a special module. It's an agent calling Linear's GraphQL API
via `http_request` primitive, guided by a knowledge doc. Same for GitHub, Slack,
WhatsApp, or any future integration.

This makes the system **infinitely extensible** without writing integration code.
To add a new integration: `autopilot secrets add stripe` + add API docs to knowledge.

---

## Architecture Decisions Log

| Date | Decision | Detail |
|------|----------|--------|
| 2026-03-22 | Integration architecture | All integrations via 3-part pattern (Secret + Knowledge Doc + Primitive), no hard-coded integration modules |
| 2026-03-22 | Agent SDK integration | Use Claude Agent SDK's `query()` for agent spawning, built-in file tools, custom primitives via `createSdkMcpServer` |
| 2026-03-22 | Write Queue | In-process async mutex with file-level granularity, stress-tested with 10 concurrent writes |
| 2026-03-22 | Toolchain management | Agents can install packages, persisted via PVC or company.yaml toolchain config (planned) |
| 2026-03-22 | Async concurrency | Single Bun process handles 8+ concurrent agents via async I/O, bottleneck is API rate limits not compute |
