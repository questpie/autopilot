# QUESTPIE Autopilot — Progress Tracker

> What's done, what's missing, what's next.
> Last updated: 2026-03-22

---

## Overall Status: 504 tests | 13K+ LOC | 4 packages | FEATURE-COMPLETE OSS

| Metric | Count |
|--------|-------|
| Source files (.ts) | 89 |
| Test files (.test.ts) | 30 |
| Source LOC | 6,617 |
| Test LOC | 6,449 |
| Total LOC (src+test) | 13,066 |
| Skill/knowledge docs (.md) | 17 |
| Skill docs LOC | 3,753 |
| Total tests | 504 (all passing) |
| Packages | 4 (spec, agents, orchestrator, cli) + web |
| CLI commands | 11 |

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

## Phase 6: Orchestrator ✅ DONE (252 tests)

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

### ✅ COMPLETED (Orchestrator)
- [x] **Write Queue** — file-level locking for concurrent writes
- [x] **Agent Spawner** — ClaudeAgentSDKProvider (API key + Max sub)
- [x] **Memory Extractor** — post-session Haiku summarization + merge
- [x] **13 Agent Tools** — send_message, create_task, update_task, add_blocker, resolve_blocker, pin_to_board, unpin_from_board, search_knowledge, update_knowledge, http_request, ask_agent, create_artifact, skill_request
- [x] **Skill System** — catalog loader, context assembly integration, role-based filtering
- [x] **Artifact Router** — lazy cold-start serving, port management, create_artifact tool
- [x] **API Server** — /api/* REST + /fs/* file serving, CORS

### ✅ Business-Critical Test Hardening
- [x] Workflow engine: rejection loops with max rounds
- [x] Workflow engine: timeout handling
- [x] Workflow engine: conditional transitions (if_priority_critical, if_flag)
- [x] Task CRUD: concurrent write scenarios
- [x] Task CRUD: move task triggers workflow check
- [x] Server: full event pipeline (watcher -> workflow -> agent assignment)
- [x] Server: error recovery (crash mid-session)
- [x] Server: max_concurrent_agents enforcement
- [x] Context assembler: token budget overflow handling
- [x] Context assembler: memory relevance ranking
- [x] Webhook server: HMAC-SHA256 verification with real signatures
- [x] Scheduler: schedule timeout enforcement
- [x] Scheduler: on_failure behavior (alert_human, retry)

## Phase 7: CLI ✅ DONE (30 tests)

- [x] Commander.js framework
- [x] 11 commands: init, status, ask, tasks, agents, inbox, attach, start, board, knowledge, secrets
- [x] find-root utility
- [x] ANSI formatting helpers
- [x] Template copy on init

### ✅ WIRED
- [x] `init` — scaffold company from template
- [x] `start` — full Orchestrator lifecycle with SIGINT/SIGTERM
- [x] `ask` — creates intent task assigned to CEO
- [x] `status` — company overview with task counts
- [x] `tasks` — list with filters, show, approve, reject
- [x] `agents` — list with roles, show detail
- [x] `inbox` — pending approval items
- [x] `attach` — session streaming
- [x] `board` — dashboard pin management
- [x] `knowledge` — knowledge base management
- [x] `secrets` — secret management

## Phase 8: Dogfooding (Future)

- [ ] Set up QUESTPIE s.r.o. as first company
- [ ] Populate knowledge base
- [ ] Run real tasks through the system
- [ ] Fix bugs found during usage

## Phase 9: Triggers & Polish (Future)

- [ ] Email transport (Resend API)
- [ ] WhatsApp transport (Twilio)
- [ ] Dashboard (React web UI reading from FS)
- [ ] Session replay command
- [ ] Cost tracking and budget alerts
- [ ] Embedding indexes (semantic search via text-embedding-3-small)
- [ ] Interactive CLI prompts (init wizard)

## Phase 10: Public Launch (Future)

- [ ] Demo video (2-3 min)
- [ ] Remove "Coming Soon" badge
- [ ] Product Hunt launch
- [ ] Hacker News "Show HN"
- [ ] npm publish @questpie/autopilot

---

## How to Test Locally

```bash
# Prerequisites: Bun v1.3+, Node v20+

# Clone and install
git clone https://github.com/questpie/questpie-autopilot.git
cd questpie-autopilot
bun install

# Build all packages
npx turbo build

# Run all 504 tests
npx turbo test

# Run tests for a specific package
cd packages/spec && bun test        # 139 tests
cd packages/agents && bun test      # 83 tests
cd packages/orchestrator && bun test # 252 tests
cd packages/cli && bun test          # 30 tests

# Initialize a new company
bun packages/cli/src/index.ts init my-company

# Start the orchestrator (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=sk-ant-...
bun packages/cli/src/index.ts start

# Ask the AI team to do something
bun packages/cli/src/index.ts ask "Build a pricing page"

# Check status
bun packages/cli/src/index.ts status
bun packages/cli/src/index.ts tasks list
bun packages/cli/src/index.ts agents list
bun packages/cli/src/index.ts inbox
```

---

## Priority Matrix: What's Done vs Future

### ✅ P0 — Dogfooding Ready (ALL DONE)
1. ~~**Write Queue**~~ ✅ — in-process async mutex with file-level granularity
2. ~~**Agent Spawner (Agent SDK)**~~ ✅ — Claude Agent SDK `query()` integration
3. ~~**Custom MCP Tools**~~ ✅ — 13 agent tools via createSdkMcpServer
4. ~~**Memory Extractor**~~ ✅ — post-session Haiku summarization + merge
5. ~~**CLI `start` command**~~ ✅ — full orchestrator lifecycle
6. ~~**CLI `ask` command**~~ ✅ — creates intent task assigned to CEO
7. ~~**Business-critical test hardening**~~ ✅ — concurrent writes, rejection loops, error recovery
8. ~~**Skill System**~~ ✅ — 17 knowledge docs, catalog loader, role-based filtering
9. ~~**Artifact Router**~~ ✅ — lazy cold-start serving, port management
10. ~~**API Server**~~ ✅ — REST + file serving + CORS

### P1 — Future: Public Release
- [ ] Notifier email transport (Resend API)
- [ ] Dashboard web UI
- [ ] npm publish

### P2 — Future: Polish & Extend
- [ ] Interactive CLI prompts (init wizard)
- [ ] Embedding indexes (semantic search)
- [ ] Cost tracking and budget alerts
- [ ] WhatsApp/Telegram transport

### Note on Integrations

**No integration is hard-coded.** All integrations (Linear, GitHub, Slack, Stripe,
Figma, Twilio, etc.) follow the same 3-part pattern:

```
Integration = Secret + Knowledge Doc + Primitive (MCP or http_request)
```

1. **Secret** — `/secrets/{service}.yaml` (API key, allowed_agents)
2. **Knowledge Doc** — `/knowledge/integrations/{service}.md` (API docs, conventions)
3. **Primitive** — Agent calls `http_request` with `secret_ref` or uses MCP server

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
| 2026-03-22 | Skill system | 17 knowledge docs loaded from template, role-based filtering, integrated into context assembly |
| 2026-03-22 | Artifact router | Lazy cold-start for artifact serving, per-artifact port allocation, create_artifact tool |
| 2026-03-22 | Feature-complete OSS | 504 tests, 13K+ LOC, all core systems done. Future work is polish, transports, and public launch |
