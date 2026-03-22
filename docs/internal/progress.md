# QUESTPIE Autopilot — Progress Tracker

> What's done, what's missing, what's next.
> Last updated: 2026-03-22

---

## Overall Status: 392 tests | 8,652 LOC | 4 packages

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
- [ ] **Write Queue** — file-level locking for concurrent writes
- [ ] **Agent Spawner** — Claude Agent SDK `query()` integration
- [ ] **Memory Extractor** — post-session Haiku summarization
- [ ] **Tool Implementations** — custom MCP tools (send_message, create_task, pin_to_board)
- [ ] **Notifier Transports** — email, WhatsApp, Slack (currently only console + activity log)
- [ ] **Embedding Indexes** — semantic search (text-embedding-3-small)
- [ ] **Linear Sync** — bidirectional task ↔ issue sync

### ⚠️ NEEDS MORE TESTS (Business-Critical)
- [ ] Workflow engine: rejection loops with max rounds
- [ ] Workflow engine: timeout handling
- [ ] Workflow engine: conditional transitions (if_priority_critical, if_flag)
- [ ] Task CRUD: concurrent write scenarios
- [ ] Task CRUD: move task triggers workflow check
- [ ] Server: full event pipeline (watcher → workflow → agent assignment)
- [ ] Server: error recovery (crash mid-session)
- [ ] Server: max_concurrent_agents enforcement
- [ ] Context assembler: token budget overflow handling
- [ ] Context assembler: memory relevance ranking
- [ ] Webhook server: HMAC-SHA256 verification with real signatures
- [ ] Scheduler: schedule timeout enforcement
- [ ] Scheduler: on_failure behavior (alert_human, retry)

## Phase 7: CLI ✅ SCAFFOLDED (23 tests) — NEEDS INTEGRATION

- [x] Commander.js framework
- [x] 8 commands registered (init, status, ask, tasks, agents, inbox, attach, start)
- [x] find-root utility
- [x] ANSI formatting helpers
- [x] Template copy on init

### ❌ NOT YET WIRED
- [ ] `start` → instantiate Orchestrator, run lifecycle
- [ ] `ask` → create task via SDK, spawn CEO
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
1. **Write Queue** — without this, concurrent agents corrupt data
2. **Agent Spawner (Agent SDK)** — core value prop, makes agents actually work
3. **Custom MCP Tools** — send_message, create_task, pin_to_board via createSdkMcpServer
4. **Memory Extractor** — agents need to remember across sessions
5. **CLI `start` command** — needs to run the orchestrator
6. **CLI `ask` command** — needs to spawn CEO agent

### P1 — Must Have for Public Release
7. **Business-critical test hardening** — concurrent writes, rejection loops, error recovery
8. **CLI `attach` command** — WebSocket session streaming
9. **Webhook HMAC verification** — security
10. **Notifier email transport** — users need to receive notifications

### P2 — Nice to Have
11. Interactive CLI prompts (init wizard)
12. Dashboard web UI
13. Linear sync
14. Embedding indexes
15. WhatsApp/Telegram transport
