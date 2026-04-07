<!-- autopilot:start -->
## Autopilot Context

> Generated from .autopilot/ — do not edit this section manually.

### architecture-reset

# Architecture Reset — Living Spec

> Source of truth for the QuestPie Autopilot architecture.
> Updated after each implementation pass. Reflects current reality + next scopes.
> Last updated: 2026-04-02, after Pass 8.1.

---

## 1. Current Reality After Pass 8.1

This section describes what is true and working today.

### What exists

```
packages/
  spec/          — Shared Zod contracts (WorkerEvent, RunCompletion, claim/register schemas)
  orchestrator/  — Standalone master/control-plane process (Hono API, services, company.db, index.db, auth)
  worker/        — Standalone execution-node process (poll, claim, runtime adapters, event reporting)
  mcp-server/    — Thin MCP wrapper over orchestrator HTTP API (stdio + SSE transport)
  cli/           — Thin Commander.js CLI (server, worker, start, tasks, runs, auth)
  agents/        — (legacy, not loaded by current code)
  avatar/        — (legacy, dashboard component library)
apps/
  dashboard-v2/  — (legacy, not connected to new API)
  docs/          — (legacy)
```

### Process model

**Orchestrator** is a standalone Bun HTTP server.
- Owns company.db (tasks, runs, workers, leases, run_events, auth)
- Owns index.db (derived search — not yet wired)
- Exposes Hono API on port 7778
- Knows nothing about Claude Code, Codex, or any runtime

**Worker** is a standalone process that connects to the orchestrator over HTTP.
- Registers with orchestrator, sends heartbeats, polls for work
- Claims pending runs, launches runtime adapters, reports events and completion
- One active run at a time per worker
- Runtime-specific logic (CLI flags, MCP config, process management) stays inside the worker
- Uses join-token enrollment on first real remote start, then durable machine identity

**CLI** provides three process topologies:

| Command | What it does |
|---------|-------------|
| `autopilot server start` | Start orchestrator only |
| `autopilot worker start --url <orchestrator>` | Start worker only, connect to remote orchestrator |
| `autopilot start` | Local convenience: orchestrator + one worker in same process tree |
| `autopilot worker token create` | Create join token for worker enrollment |

`autopilot start` is a dev/demo shortcut. The real model is separate processes.

### What is real and working

- Orchestrator boots, creates DBs, serves API
- Worker registers, heartbeats, polls, claims runs
- Claude Code adapter spawns `claude` CLI with `--bare --output-format json`
- MCP config is generated per-run as a temp file, passed via `--mcp-config --strict-mcp-config`
- MCP server runs as stdio child process of Claude, connects to orchestrator over HTTP
- MCP tool surface: `task_list`, `task_get`, `task_create`, `task_update`, `run_list`, `run_get`
- Worker normalizes runtime output to compact WorkerEvents, POSTs to orchestrator
- Worker reports completion with summary + token usage
- Claude session persistence is worker-local and resumable
- Continuation is explicit via `autopilot runs continue`
- Each run executes in its own git worktree
- Worker runtime hosting is explicit and validated at startup
- Remote workers enroll with join token, then use durable machine credential
- Cleanup: temp MCP config removed in `finally` block
- Auth model: worker routes are machine-authenticated; local dev bypass exists only for `autopilot start`
- Full lifecycle tested: task CRUD, run create/continue, claim, events, completion, enrollment
- CLI commands: `tasks` (list/show/create/update), `runs` (list/show/continue), `worker token create`, `auth` (login/setup/status/logout)

### Current practical operating mode

- One repo checkout per worker
- One active run per worker at a time
- Human reviews diffs before commit/push
- Local/self-hosted only — no cloud, no multi-tenant
- CLI + API is the primary operator surface
- No dashboard connected to new API yet
- Task/workflow intake is still not the real planner layer
- Operators still steer the workflow/planner layer manually outside the product

---

## 2. Core Architecture

### What we are building

**QuestPie Autopilot** = a workflow orchestrator for AI agents, with workers that execute via external runtimes.

**Three components:**
1. **Orchestrator** — task/run/workflow state machine + API + observability (the master)
2. **Worker** — claims work, launches Claude Code/Codex/OpenCode, reports results (the node)
3. **CLI / Dashboard** — thin clients over the API (not architecture drivers)

### Core loop (current, truthful)

```
Human creates task (CLI / API)
  → Operator or current system creates run (status: pending)
  → Worker polls, claims run
  → Worker launches Claude Code with MCP config + local workspace
  → Claude Code executes on local filesystem
  → Claude Code can read/write tasks via MCP tools (orchestrator domain)
  → Worker captures runtime output, normalizes to compact WorkerEvents
  → Worker POSTs events to orchestrator
  → Worker reports completion (summary, tokens, artifacts)
  → Orchestrator persists events, transitions run status
  → Human inspects result via CLI (`autopilot runs show <id>`)
  → Human reviews local diff, decides commit/push
```

**What the core loop is NOT:**
- Claude does not edit files via orchestrator/MCP. Local FS is the execution surface.
- There is no centralized raw transcript. Worker sends compact events only.
- There is no dashboard real-time view yet. CLI is the operator surface.
- There is no automatic commit/push/merge. Human decides.

### Agent vs Runtime — critical distinction

- **Agent** = authored identity/policy/config (YAML in git). Defines who, what role, what scope.
- **Runtime** = execution engine used by a worker. Claude Code, Codex, OpenCode, etc.
- Agents are authored in `team/agents/*.yaml`.
- Runs reference `agent_id` — the agent identity, not the runtime.
- Workers do not own agent definitions. Workers own runtime adapters.
- The same agent identity may be executed by different runtimes/workers over time.
- Loader support exists, but authored config is not yet the active workflow/intake driver.

### What we are NOT building

- Custom LLM agent loop (workers execute via external runtimes)
- Custom tool system (MCP + FS only)
- Custom streaming infrastructure (compact events via HTTP)
- Broad provider SDK abstractions (tiny inference seam only)
- Complex workflow engine (linear steps only, when added)
- Dashboard-driven architecture (API-first, CLI-first)
- Centralized transcript archive (compact events, not raw deltas)

---

## 3. Forward Scope Stack

The old pass/migration sequence (Pass 0–3) is completed. This is the forward-looking scope stack, ordered by operational priority.

### Scope 1: Core Runtime Baseline — DONE

Orchestrator, worker, Claude Code adapter, MCP boundary, CLI, end-to-end lifecycle.

### Scope 2: Dogfood Operating Mode — IMMEDIATE FOCUS

Make Autopilot usable to develop Autopilot itself. See section 4.

### Scope 3: Workflow-Driven Intake / Default Task Assignee

**Problem:** The execution substrate is real, but the planner/autopilot layer is still missing. Tasks do not yet resolve ownership through an authored default-assignee rule, authored workflows do not yet drive progression, and operators still have to manually steer the planning layer.

**Target:**
- new tasks resolve ownership through an authored default-assignee setting
- workflow attaches at intake
- linear workflow progression becomes real
- `agent` steps create runs automatically
- `human_approval` steps block cleanly
- `done` steps close the task

**Critical rule:** task assignment is agent ownership, not worker routing.

### Scope 4: Minimal Execution Targeting / Routing Foundation

**Problem:** Once workflows are real, the next missing primitive is truthful execution targeting. The system must be able to express where a step is allowed or preferred to execute.

**Target:**
- preferred worker
- preferred location
- required capabilities or environment access
- explicit fallback rules kept small and clear

**Critical rule:** task assignment is still not worker routing. Routing is a separate execution concern, but it is part of execution semantics.

### Scope 5: Wait / Approval / Wake-Up Foundation

**Problem:** Once workflows and routing are real, the next missing primitive is clean waiting and human-in-the-loop progression.

**Target:**
- waiting / blocked state
- approval-needed step progression
- explicit human reply or approval that wakes the task/run path back up
- same-worker continuation where appropriate

**Constraint:** keep this run-centric and explicit. Do not turn it into a chat-first product.

### Scope 6: Routing / Worker Selection Policy (expanded)

**Problem:** Current routing is still first-eligible-claimant wins for fresh runs, and there is not yet a richer targeting/selection policy.

**Current behavior:**
- Minimal claim model: worker polls `/api/workers/claim`
- Any worker with matching runtime capability can claim any pending run
- Effectively first-eligible-claimant wins
- No affinity, no preference, no routing policy

**Target behavior:**
- Preferred worker per agent (e.g., "developer agent prefers Andrej's laptop")
- Agent-to-worker affinity (sticky assignment when possible)
- Laptop vs VPS preference per task type
- Explicit routing policy (labels, tags, capability matching)
- Fallback rules when preferred worker is offline

**Concrete question:** "If Andrej's laptop is online, will the VPS worker still take the run?"
- **Currently:** Maybe yes, depending on who polls first.
- **With routing policy:** No longer ambiguous. Policy determines preference + fallback.

**Not implemented yet.** Do not pretend routing exists until it does.

### Scope 7: External System Foundation

- integrations
- secrets / credentials
- environments / targets
- external action execution with approval/audit hooks
- this is core to agentic interaction with other systems

### Scope 8: Dashboard / Operational Console

- Later
- Client over the orchestrator API
- Not an architecture driver
- Backend must work cleanly via CLI + API + MCP before any dashboard assumptions
- Current dashboard-v2 can be adapted to new API — not redesigned yet

### Scope 9: Project / Output / Delivery Layers

- Later
- Artifacts, project-aware workflows, QuestPie CMS framework support, deployments, infra automation
- Built over tasks/runs/workflows, not by expanding core orchestrator complexity

### Scope 10: Hosted / Cloud / Multi-Tenant

- Much later
- Explicitly deferred
- Requires: authenticated enrollment, workspace isolation, routing policy
- Different auth model, proxy vs BYOK, deployment mode flag
- Not the current operating mode

---

## 4. Dogfood Operating Scope

This is the most important near-term section. Autopilot should now be usable to develop Autopilot itself.

### Operating model

- One orchestrator (local or VPS)
- One or more workers (each on its own machine with its own repo checkout)
- Repo-local execution — Claude Code runs on the worker's filesystem
- Human review before commit/push — no auto-merge, no autonomous deploys
- Iterative: create task → worker executes → human reviews diff → refine or accept

### Constraints

- One active run per worker (enforced by concurrency guard)
- No pretending multi-worker same-checkout concurrency is solved
- No automatic git operations beyond what the runtime does locally
- Human is always in the loop for commit/push decisions

### Success criteria

A dogfood session looks like this:

1. Human: `autopilot tasks create --title "Add session persistence" --type feature`
2. Orchestrator creates task
3. Worker execution is available once a run exists
4. Claude Code runs with MCP + local workspace
5. Claude Code reads task via MCP, edits files on local FS
6. Claude Code reports progress events via MCP → orchestrator
7. Worker reports completion
8. Human: `autopilot runs show <run-id>` — sees summary + events
9. Human reviews local `git diff`
10. Human decides: commit, push, or ask for more work

### What must work for dogfood

- Task CRUD via CLI
- Run lifecycle: create → claim → execute → complete
- Claude Code actually edits the right files in the right checkout
- MCP tools let Claude read/update task state
- Events give human enough visibility to know what happened
- Result is reviewable as a normal git diff

### What still blocks full local autopilot behavior

- task intake is not yet workflow-driven
- new tasks do not yet resolve a default assignee from authored config
- authored workflows are not yet driving run creation or progression
- operators still have to steer the planning layer manually

### What must work next for real autopilot behavior

- workflow-driven intake
- configurable default task assignee
- linear workflow progression
- run creation from `agent` steps
- clean human approval / wake-up path

### What does NOT need to work yet for dogfood

- Dashboard
- Search/indexing
- Full routing policy

---

## 5. Data Ownership and Sync Model

### Example topology

```
                    ┌─────────────────────┐
                    │   VPS Orchestrator   │
                    │   company.db         │
                    │   index.db           │
                    │   port 7778          │
                    └──────────┬──────────┘
                               │ HTTP API
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────┴───────┐  ┌────┴────────┐  ┌────┴───────────┐
     │ Andrej laptop  │  │ Martin      │  │ VPS worker     │
     │ worker         │  │ laptop      │  │ (optional)     │
     │ local checkout │  │ worker      │  │ own checkout   │
     │ Claude Code    │  │ local       │  │ Claude Code    │
     └────────┬───────┘  │ checkout    │  └────────┬───────┘
              │          │ Claude Code │           │
              │          └──────┬──────┘           │
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    Git remote         │
                    │    (GitHub / bare)    │
                    └───────────────────────┘
```

### A. company.db — on orchestrator

| What | Examples |
|------|---------|
| Tasks | id, title, status, assigned_to |
| Runs | id, agent_id, worker_id, status, summary, tokens |
| Run events | compact: started, progress, tool_use, error, completed |
| Workers | id, device_id, name, status, capabilities |
| Worker leases | id, worker_id, run_id, expires_at |
| Auth state | users, sessions, API keys |
| Activity / audit | actor, type, summary, details |

**Sync mechanism:** Orchestrator HTTP API + SSE. Workers and CLI clients read/write via API. This is the single source of truth for operational state.

### B. index.db — on orchestrator

| What | Examples |
|------|---------|
| Search index | FTS5 full-text search over entities |
| Chunks | Paragraph-level embeddings |
| Vector index | DiskANN for semantic search |

**Sync mechanism:** Rebuilt from company.db + git/FS content. Can be deleted and regenerated. Not yet wired in current implementation.

### C. Git repo / authored content — distributed

| What | Examples |
|------|---------|
| Code | Source files, project artifacts |
| Docs | Documentation, specs |
| Knowledge | `knowledge/` directory |
| Agent definitions | `team/agents/*.yaml` |
| Workflow definitions | `team/workflows/*.yaml` |
| Company config | `company.yaml` |

**Sync mechanism:** `git pull` / `git push` to shared remote. Standard git workflow. Not database replication. Each machine has its own checkout.

### D. Worker-local runtime state — per machine, NOT synced

| What | Examples |
|------|---------|
| Claude session files | `~/.claude/` session state |
| Raw stdout / stderr | Runtime process output |
| Raw transcript / thinking | Full token stream, thinking tokens |
| Local worktree | Git checkout where runtime executes |
| Temporary MCP config | Per-run config file, cleaned up after |
| Runtime debug output | Logs, traces |

**Sync mechanism:** Does NOT centrally sync. Stays on the worker machine. If a worker crashes, this data may be lost — that is acceptable.

### Critical data ownership rules

1. **Worker-local runtime session data is NOT canonical product truth.** If the worker dies, the orchestrator marks the run as failed and another worker can retry. The raw transcript is gone.

2. **Code and config sync between machines is via git.** Not via orchestrator API, not via database replication. `git push` on one machine, `git pull` on another.

3. **Tasks, runs, and events sync via orchestrator API.** Workers POST events. CLI and dashboard read via GET. SSE for real-time.

4. **Raw runtime output does NOT sync centrally.** The orchestrator receives only compact, normalized events (type + summary + optional metadata). Full tool call parameters, raw thinking tokens, and provider-specific protocol events stay on the worker.

---

## 6. DB Architecture

### company.db — Operational truth (never rebuilt)

```
tasks
  id, title, description, type, status, priority,
  assigned_to, workflow_id, workflow_step,
  context (json), metadata (json),
  created_by, created_at, updated_at

runs
  id, agent_id, task_id, worker_id, runtime,
  status: pending | claimed | running | completed | failed,
  initiated_by, instructions, summary,
  tokens_input, tokens_output, error,
  started_at, ended_at, created_at

run_events
  id (auto), run_id, type, summary,
  metadata (json), created_at

  Event types (compact):
    started, progress, tool_use, artifact,
    message_sent, task_updated, approval_needed,
    error, completed

workers
  id, device_id, name, status, capabilities (json),
  registered_at, last_heartbeat

worker_leases
  id, worker_id, run_id,
  claimed_at, expires_at,
  status: active | completed | failed | expired

Auth tables (Better Auth standard)
  user, session, account, apikey
```

### index.db — Derived search cache (fully rebuildable)

```
search_index   — Entity-level FTS + embedding vectors
search_fts     — FTS5 virtual table
chunks         — Paragraph-level chunks + embeddings
chunks_fts     — FTS5 virtual table
```

`rm index.db && restart` rebuilds from company.db + filesystem.

### Source of truth model

```
DB-backed entities (runtime state):
  Drizzle tables = source of truth
  → Zod inferred from Drizzle (drizzle-zod)
  → TS types inferred from Zod

YAML/FS-backed entities (authored config):
  Handwritten Zod schemas = source of truth
  → TS types inferred from Zod
  → YAML parsed + validated at load time

Worker↔Orchestrator contract:
  Handwritten Zod in packages/spec = source of truth
  → TS types inferred from Zod
```

---

## 7. Agent and Runtime Configuration

### Agent setup

Agents are authored as YAML files in git:

```yaml
# team/agents/developer.yaml
id: developer
name: Developer
role: developer
description: Writes code, fixes bugs, implements features
model: claude-sonnet-4-20250514
```

- Loader support exists for `team/agents/*.yaml`
- Runs reference `agent_id` — the agent identity from YAML
- Workers receive `agent_id` when claiming a run but do not own agent definitions
- Agent YAML is version-controlled, human-editable, reviewed like code
- Agent YAML is the active source of truth for task intake/progression via WorkflowEngine

### Workflow setup

Workflows are authored as YAML files in git:

```yaml
# team/workflows/development.yaml
id: development
name: Development Workflow
steps:
  - id: implement
    type: agent
    agent_id: developer
    instructions: Implement the task as described
  - id: review
    type: human_approval
  - id: done
    type: done
```

Linear execution only. No branching, no retries, no sub-workflows. Add complexity when real users need it.
- Workflow YAML is wired into task intake/progression via WorkflowEngine
- Agent steps use `agent_id` (not `role`) — role-based resolution does not exist yet

### Runtime setup

Runtimes are execution engines, registered as adapters in the worker:

```typescript
worker.registerAdapter('claude-code', new ClaudeCodeAdapter({
  useMcp: true,
  workDir: '/path/to/repo',
}))
```

- Runtime-specific details (CLI flags, process management, MCP config) stay inside the adapter
- Worker normalizes all runtime output to `WorkerEvent` before sending to orchestrator
- Orchestrator never sees runtime-specific protocol details
- Worker runtime hosting is now explicit and config-driven

---

## 8. Worker Enrollment and Join Token

> Implemented as the current machine-authenticated worker model.

### Current state

- Admin creates a short-lived join token
- Worker enrolls with the join token on first remote start
- Worker receives durable machine identity + machine secret
- Subsequent worker lifecycle calls use machine auth
- Local dev bypass exists only when `autopilot start` explicitly enables it

### Target model

Modeled after container orchestration node-join patterns (Docker Swarm, k8s):

1. **Admin generates join token** via orchestrator API or CLI
   - Short-lived (e.g., 1 hour expiry)
   - Scoped to a company instance
   - Single-use or limited-use

2. **Worker enrolls using join token**
   - `autopilot worker start --join-token <token> --url <orchestrator>`
   - Orchestrator validates token, creates durable worker identity
   - Worker receives machine credential (long-lived bearer token or certificate)

3. **Worker uses machine identity for all subsequent calls**
   - Heartbeat, claim, event, completion calls authenticated with machine credential
   - Orchestrator can identify which machine is making each call
   - Orchestrator can revoke worker identity

4. **Company-scoped machine actor model**
   - Each worker belongs to a company instance
   - Worker identity is separate from human user identity
   - Activity log shows which worker (machine) performed which actions

### Why this matters

- Trust that a worker is authorized
- Revoke a compromised worker
- Audit which machine ran which task
- Run workers on untrusted networks (VPS, CI, cloud)

---

## 9. Workspace Isolation / Git Execution Safety

> Implemented as the current per-run worktree execution model.

### Current behavior

- Worker creates a git worktree per run under `.worktrees/run-<id>`
- Runtime executes inside the worktree, not the main checkout
- Continuation reuses the original worktree when available
- Completed resumable runs retain their worktree
- Non-resumable or failed runs remove the worktree but can keep the branch for review
- One active run at a time per worker is still enforced

### Remaining gap

- fallback to repo root in non-git directories should be treated as degraded mode, not as the normal path
- broader multi-worker coordination and smarter branch/worktree policies are still future work

### Why this matters

- Main checkout stays usable for human review
- Continuation has a coherent local workspace
- Future multi-run local use has a real isolation foundation

---

## 10. What Remains Deferred

These items are explicitly out of scope for the near-term:

| What | When |
|------|------|
| Rich dashboard UX | After backend stabilizes, API-first proven |
| Cloud multi-tenant | After self-hosted works, after enrollment + isolation |
| Hosted billing / resell | After cloud multi-tenant |
| Advanced search / memory | After basic indexing works |
| Broad multi-runtime parity (Codex, OpenCode) | After Claude Code path is solid |
| Complex workflow branching / retries | After linear workflows work |
| Artifact platform / dev-server management | After core works |
| Embedding model hot-swap | After manual reindex works |
| Sub-workflows | After linear works |
| Agent memory system | After basic observability |
| 2FA / advanced auth | After basic auth works |
| Telegram / webhook integrations | After core works |
| Notifications / push | After core works |
| Scheduler (cron) | After first dogfood demo |
| YAML → DB config migration | Cloud multi-tenant phase |

---

## 11. Code Structure (Current)

```
packages/spec/src/
  schemas/
    worker-event.ts    — WorkerEvent, RunCompletion
    worker-api.ts      — Register, Heartbeat, Claim, Deregister request/response schemas
    agent.ts           — Agent YAML schema
    workflow.ts        — Workflow YAML schema
    company.ts         — Company YAML schema

packages/orchestrator/src/
  server.ts            — Bootstrap: dotenv, DBs, auth, services, Hono app, Bun.serve
  api/
    app.ts             — Hono app factory, CORS, auth middleware mounting
    routes/
      tasks.ts         — GET/POST/PATCH /api/tasks
      runs.ts          — GET/POST /api/runs, POST /api/runs/:id/events, POST /api/runs/:id/complete
      workers.ts       — POST /api/workers/register, heartbeat, claim, deregister
      events.ts        — SSE endpoint
    middleware/
      auth.ts          — Session/bearer resolution → Actor
  db/
    schema.ts          — Drizzle company schema
    index-schema.ts    — Drizzle index schema
    index.ts           — DB creation (company.db + index.db)
  services/
    tasks.ts           — Task CRUD
    runs.ts            — Run lifecycle (create, claim, start, complete, events)
    workers.ts         — Worker registry, heartbeat, leasing
  auth/                — Better Auth setup
  events/              — In-memory event bus
  config/              — YAML loader
  env.ts               — Environment config
  index.ts             — Public exports

packages/worker/src/
  worker.ts            — AutopilotWorker: register, heartbeat, poll, claim, execute, report
  runtimes/
    adapter.ts         — RuntimeAdapter interface, RunContext, RuntimeResult, WorkerEvent re-export
    claude-code.ts     — ClaudeCodeAdapter: spawn CLI, capture JSON, MCP config, normalize
  mcp-config.ts        — Generate temp MCP config file for Claude Code
  index.ts             — Public exports

packages/mcp-server/src/
  index.ts             — MCP server scaffold (stdio + SSE transport)
  tools.ts             — 6 tools: task_list, task_get, task_create, task_update, run_list, run_get
  api-client.ts        — Thin HTTP client → orchestrator API
  env.ts               — AUTOPILOT_API_URL, AUTOPILOT_API_KEY

packages/cli/src/
  program.ts           — Commander root
  commands/
    server.ts          — `autopilot server start`
    worker.ts          — `autopilot worker start`
    start.ts           — `autopilot start` (convenience wrapper)
    tasks.ts           — `autopilot tasks` (list/show/create/update)
    runs.ts            — `autopilot runs` (list/show)
    auth.ts            — `autopilot auth` (login/setup/status/logout)
  utils/
    client.ts          — Hono RPC client factory
    find-root.ts       — Company root detection
    format.ts          — Terminal formatting
```

---

## 12. Key Invariants

These must remain true across all future scopes:

1. **Orchestrator does not run agents.** It schedules. Workers execute via external runtimes.
2. **No custom tool system.** MCP + FS only. Runtimes have their own built-in tools.
3. **Local FS is the execution surface.** Runtimes edit files on the worker's filesystem. Not via orchestrator API.
4. **Compact events, not raw transcript.** Orchestrator persists type + summary + metadata. Raw output stays on worker.
5. **Workers never access DBs directly.** HTTP API only.
6. **index.db can be deleted at any time.** Orchestrator rebuilds from company.db + filesystem.
7. **company.db is operational truth.** Never rebuilt from external sources.
8. **Git is the sync mechanism for code/config.** Not database replication.
9. **Dashboard is a client.** It does not define data models or drive backend contracts.
10. **Spec package owns shared contracts.** Worker↔orchestrator Zod schemas live in `packages/spec`.

### company

# QuestPie

Add company-level context here: team structure, coding standards, architecture decisions, conventions.

This file is synced into CLAUDE.md by `autopilot sync`.

### current-steering

# Current Steering

> Living steering addendum for the active Autopilot architecture.
> Use this with `local_specs/architecture-reset.md` for current implementation decisions.
> Last updated: 2026-04-07, after Pass 25.7 (release/update/channel management); runtime setup tutorials and VPS dogfood runbook (Pass 25.8) is the active target.

## Purpose

`architecture-reset.md` is still the broad reset baseline.
This file keeps the immediate current truth, invariants, and next-pass order stable across sessions.

## Active Pass Map

Use numbered passes consistently in prompts, reports, and follow-up steering.

Completed:

- `Pass 22.0` — Epic / Task Graph V1 foundation
- `Pass 22.1` — Task Graph hardening + failure normalization + parent wait / join
- `Pass 23.0` — Pack Distribution / Registry V1
- `Pass 23.1` — Pack Distribution / Registry V1.1 cleanup
- `Pass 24.0` — Bootstrap / Onboarding V1
- `Pass 24.0.1` — Bootstrap / Onboarding V1.1 truth cleanup
- `Pass 24.1` — Parent Rollup / Inspection Ergonomics V1
- `Pass 24.2` — Telegram-first Surface Pack V1
- `Pass 24.2.1` — Telegram Surface Pack V1 hardening
- `Pass 24.3` — Provider / Surface / Pack docs overhaul
- `Pass 24.3.1` — Docs truth cleanup
- `Pass 24.4` — Workflow Capability Profiles V1
- `Pass 24.5` — Shared Secret Store / Secret Distribution V1
- `Pass 24.5.1` — Shared Secret Store hardening
- `Pass 24.5.2` — Worker API typed routes / typed client cleanup
- `Pass 24.6` — Worker Script Actions V1
- `Pass 24.7` — Actionable Notifications V1
- `Pass 24.8` — Query / Personal Assistant V1
- `Pass 24.9` — Messaging / Session Model clarification pass
- `Pass 26.0` — Runtime Adapters V1
- `Pass 25.2` — Multi-Worker / URL-Security Validation V1
- `Pass 25.3` — Deployment Packaging / One-Line Local + Docker V1
- `Pass 25.4` — Operator Doctor / Setup Validation V1
- `Pass 25.7` — Release / Update / Channel Management V1
- `Pass 25.8` — Runtime Setup Tutorials / VPS Dogfood Runbook V1
- `Pass 26.1` — Runtime Selection Pipeline V1

Current / next:
- `Pass 24.10` — Handler SDK / Surface Authoring Ergonomics V1 `(planning/spec first)`
- `Pass 24.11` — Agent Invocation SDK / Stable Invocation Contract V1 `(planning/spec first)`
- `Pass 24.12` — Company Agent Context Model V1 `(planning/spec)`
- `Pass 24.13` — Context Assembly / Budget / Snapshot Model V1 `(planning/spec)`
- `Pass 24.14` — Company User Management / Membership / Roles V1 `(planning/spec, Better Auth-backed)`
- `Pass 25.0` — Local -> VPS Migration Assist V1
- `Pass 25.1` — Managed Cloud / Managed Worker packaging
- `Pass 25.5` — Onboarding / Operator Sugar V1 `(planning/spec)`
- `Pass 25.6` — Spec Boundary / Schema Ownership Cleanup V1 `(planning/spec)`
- `Pass 26.1` — Runtime Selection Pipeline V1
- `Pass 26.2` — MCP Auth Hardening V1
- `Pass 26.3` — Schedules / Triggers V1 `(planning/spec)`
- `Pass 26.4` — Standing Programs / Orders V1 `(planning/spec)`
- `Pass 26.5` — Task Audit / Maintenance / Health V1 `(planning/spec)`
- `Pass 26.6` — Hooks / Heartbeat / Periodic Automation V1 `(planning/spec, only after session/context truth is clearer)`
- `Pass 27.x` — Operator App / Living Dashboard phases, only after the above layers are truthful

## Near-Term Delivery Goal

The near-term goal is not “build the app/dashboard”.

The near-term goal is:

- a production-like durable dogfood alpha
- deployable and restart-safe enough for real internal use
- presentable tomorrow evening without pretending the future app/dashboard already exists

That means the target bar is:

- orchestrator on a real VPS or equivalent remote host
- one or more workers on different machines
- shared secrets, surfaces, notifications, and script actions working end to end
- real deployment/operator docs
- runtime setup tutorials
- a truthful demo/dogfood flow

The main near-term productization track is:

- finish the current primitive passes that affect operator truth
- harden and validate deployment topologies
- document local, Docker, split-host, and private-overlay deployment variants
- prepare demo/docs/pitch artifacts around what is already real
- prefer thin onboarding/setup/sugar layers over a large app push

## Current Reality

What is true now:

- `orchestrator` is the control plane
- `worker` is the execution node on a host
- `autopilot server start` boots orchestrator only
- `autopilot worker start` boots worker only
- `autopilot start` is local convenience only
- Claude Code adapter is real
- task -> run -> claim -> execute -> complete works
- worker-local Claude session persistence exists
- same-worker continuation exists
- per-run git worktree isolation exists
- workflow-driven intake exists
- authored default task assignee exists
- approval / reject / reply wake-up flow exists
- routing constraints exist on runs
- environments / secret refs / webhook actions exist
- artifacts exist and can be registered from runs
- minimal worker API is implemented
- canonical authored config lives under `.autopilot/`
- orchestrator boot uses scope discovery + resolved config
- company scope + project scope are real
- workflow control flow is real
- human review loops are real
- declarative step `output` exists
- engine-generated structured output suffix exists
- source-run summary forwarding exists
- explicit `input.artifacts` exists
- generic transition matching over named output fields exists
- dogfood workflow now supports:
  - plan validation loop
  - implementation validation loop
  - implementation-prompt generation + forwarding
  - human final review loop
- resolved execution context is distributed from orchestrator to worker at claim time
- claim payload now carries:
  - task context
  - agent identity
  - baked instructions
  - separated post-run actions
  - separated secret refs
  - execution constraints only in `targeting`
- workers do not walk company/project config at execution time
- local and cloud are the same model with a different URL
- durable operator-facing previews are orchestrator-backed, not worker-uptime-backed
- durable preview files are stored as inline artifacts on the orchestrator
- orchestrator serves preview content via `/api/previews/:runId/*path`
- `preview_url` artifacts are auto-created for runs with stored preview files
- live operator SSE exists
- headless task/run/artifact inspection is already good enough for real CLI operation
- step-level post-run webhooks are real
- low-level task creation is real
- provider / extension runtime v1 is real
- notification bridge v1 is real
- workflow-driven intent intake v1 is real
- CLI inbox / watch v1 is real
- conversation binding v1 is real
- bound outbound conversation delivery is real
- conversation channels can now receive task-scoped blocked / failed / completed / preview updates in the same bound thread
- high-level intent-capture / brainstorming-to-task UX is real but still intentionally thin
- chat apps can already be treated as future client/adaptor surfaces, not as system truth
- first-class task relations are real
- planner-driven child task spawning is real
- parent/child lookup and child rollups are real
- parent `wait_for_children` join semantics are real
- parent wake-up on child task changes is real
- planner-driven epic execution loops are now possible without relying on agent memory
- pack dependencies in `.autopilot/company.yaml` are real
- git-backed registries are real
- `.autopilot/packs.lock.yaml` is real
- `autopilot sync` is now the deterministic pack install/apply step
- pack materialization into canonical `.autopilot/` paths is real
- `autopilot bootstrap` exists for local-first and join-existing onboarding flows
- bootstrap scaffolding + context import are real
- Telegram surface pack is real and hardened enough to prove pack-distributed surfaces
- provider / surface / pack docs are materially aligned with the current architecture
- workflow capability profiles are real
- orchestrator-managed shared secret storage and scoped delivery are real
- worker-local observability API now follows the typed route / typed client pattern more closely
- worker-side deterministic script actions are real
- actionable notifications are real
- taskless query / personal-assistant execution is real
- orchestrator-owned surface sessions are real
- `query` vs `task_thread` conversation mode is real
- Telegram general chat now routes to query mode by default
- Telegram task-thread/task-reply routing is now explicit and inspectable
- `ORCHESTRATOR_URL` is the canonical base URL for externally rendered links
- Docker packaging is orchestrator-only by default
- Docker fresh-volume bootstrapping creates `.autopilot/company.yaml` and serves `/api/health`
- supported current operator surfaces are CLI, API, MCP, Telegram, and query
- the future operator app/dashboard remains deferred and is not part of the current deployable runtime
- Codex and OpenCode worker runtime adapters are real
- runtime adapters currently share capability-aware prompt injection through worker-side prompt building
- Codex/OpenCode MCP setup currently uses backup/restore config replacement during a run and restores on cleanup as a documented V1 tradeoff
- `autopilot doctor` validates local setup, deployment env, runtimes, and orchestrator health
- `autopilot version` shows local package versions and remote orchestrator version
- `autopilot update check` checks npm registry for latest published version with stable/canary channel support
- `/api/health` now returns orchestrator version
- stable/canary release channel model is defined and documented
- Docker update, rollback (pin image tag), and backup-before-update flows are documented
- deployment topology guidance covers local, Docker, split-host, and private overlay (Tailscale/WireGuard)
- runtime setup tutorials cover Claude Code, Codex, and OpenCode install/auth/MCP/caveats
- VPS dogfood runbook covers end-to-end orchestrator+worker deployment
- agent config carries canonical `model`, `provider`, and `variant` intent
- orchestrator propagates model/provider/variant to runs and claimed run contracts
- worker-local `modelMap` resolves canonical model names to runtime-specific model strings
- all three runtime adapters (Claude Code, Codex, OpenCode) pass `--model` flag when model is set
- no `--model` flag when no model is set — existing runtime defaults are preserved

What is not true yet:

- the future operator/company app is not implemented yet
- broad multi-runtime parity is not implemented yet
- artifact persistence is still driven by special artifact output handling rather than pure output-field bindings
- content-format semantics for artifacts/outputs are not finalized yet
- human-facing review routes are still mostly API-shaped rather than operator-shaped
- AI-assisted install / setup mode is not implemented yet
- pack-first surface setup is not implemented yet
- additional surface packs beyond Telegram are not implemented yet
- strict per-runtime capability sandboxing and MCP/context subsetting beyond prompt-level hints is not implemented yet
- stable SDK surfaces for handler authoring and agent invocation are not implemented yet
- query-to-task promotion UX is not implemented yet
- messaging/session model is implemented but not yet documented cleanly enough for operators and implementers
- company-agent context layering and context assembly rules are not documented cleanly enough yet
- company user/member/invite/role management beyond the current auth base is not yet modeled cleanly enough
- MCP auth hardening beyond current local/dev dogfood paths is not implemented yet
- schedules/triggers are not a real orchestrator runtime layer yet
- standing programs/orders are not modeled yet
- task maintenance/health/audit automation is not modeled yet
- local -> VPS migration assist is not implemented yet
- managed cloud / managed worker packaging is not implemented yet
- spec/package schema ownership is still looser than it should be in some areas
- cloud config push/sync distribution is not a polished operator surface yet
- future app/dashboard review surfaces do not exist yet

## Current Pass Call

The active implementation target is:

- `Pass 26.2` — MCP Auth Hardening V1

The expected next follow-ups after that are:
- real VPS dogfood execution and validation against the runbook
- `Pass 26.3` — Schedules / Triggers V1 `(planning/spec)`
- `Pass 26.4` — Standing Programs / Orders V1 `(planning/spec)`
- `Pass 26.5` — Task Audit / Maintenance / Health V1 `(planning/spec)`
- `Pass 26.6` — Hooks / Heartbeat / Periodic Automation V1 `(planning/spec, only after session/context truth is clearer)`
- `Pass 24.10` — Handler SDK / Surface Authoring Ergonomics V1
- `Pass 24.11` — Agent Invocation SDK / Stable Invocation Contract V1
- `Pass 24.12` — Company Agent Context Model V1 `(planning/spec)`
- `Pass 24.13` — Context Assembly / Budget / Snapshot Model V1 `(planning/spec)`
- `Pass 24.14` — Company User Management / Membership / Roles V1 `(planning/spec, Better Auth-backed)`
- `Pass 25.0` — Local -> VPS Migration Assist V1
- `Pass 25.1` — Managed Cloud / Managed Worker packaging
- `Pass 25.5` — Onboarding / Operator Sugar V1 `(planning/spec)`
- `Pass 25.6` — Spec Boundary / Schema Ownership Cleanup V1 `(planning/spec)`

Near-term after the current pass, prioritize:

- real VPS dogfood execution against the documented runbook
- runtime selection pipeline (agent/model routing through workers)
- MCP auth hardening beyond local/dev paths
- onboarding/operator sugar that simplifies setup without changing primitives
- docs, pitch, and demo packaging

Do not treat the future app/dashboard as the default next step if these are still weak.

The SDK passes should start as planning/spec work first:

- verify they preserve the current orchestrator/worker/provider primitive boundaries
- verify they compile down to the existing canonical contracts
- do not implement convenience layers that create a second hidden execution model

## Core Invariants

These should not be violated in the next passes:

1. Orchestrator stays control plane, not runtime owner.
2. Worker owns runtime-specific behavior.
3. Local filesystem is the execution surface.
4. MCP is the runtime tool boundary for orchestrator-domain actions.
5. Raw transcripts and runtime internals stay worker-local.
6. Orchestrator stores compact execution state, events, metadata, and references.
7. `autopilot start` remains convenience only, not the main mental model.
8. Task assignment is agent ownership, not worker routing.
9. Workflow progression decides what should happen next.
10. Routing policy decides where a run executes.
11. One canonical repo-native source surface lives under `.autopilot/`.
12. Compatibility files are adapters, not source of truth.
13. Local and cloud are the same model with a different URL.
14. Workers receive resolved execution context from orchestrator and never walk company/project config themselves.
15. Structured workflow outputs must stay explicit and inspectable.
16. Durable operator-facing preview links must not depend on worker uptime.
17. External channels/providers must register through authored config and standardized handlers, not hardcoded core integrations.
18. Chat/app/CLI surfaces are clients over primitives, not alternate sources of truth.
19. `.autopilot/company.yaml` remains the root manifest; do not split root intent into a separate `company.json`.
20. Distribution state must stay explicit through registries + lockfiles, not hidden in hardcoded bootstrap logic.
21. AI-assisted install may customize setup, but manifests + materialized files + lockfiles remain the truth.
22. Surface integrations should arrive as packs over provider/handler primitives, not as hardcoded core features.
23. Runtime adapter expansion should stay split:
    - adapter implementations first
    - selection/model-routing pipeline second
24. Design defaults should be cloud-first and local-compatible:
    - if a primitive works in hosted/remote orchestrator mode, it should also work locally
    - local-only shortcuts that break remote orchestration are the wrong default
25. Workflow/runtime capability selection must stay runtime-neutral:
    - workflow specs should request capability profiles or skill/tool intent
    - workflow specs should not hardcode Claude-only `/skill-name` invocation syntax
26. Installed skills and active runtime capabilities are not the same thing:
    - packs/repo files decide what exists
    - worker/runtime injection decides what is active for a specific run/step
27. Shared company secrets must be orchestrator-manageable:
    - raw secret values still do not belong in git
    - machine-bound secrets still remain worker-local
    - shared service credentials cannot depend on manual per-worker re-entry forever
28. Notification actions should mutate orchestrator task/workflow state, not directly execute arbitrary side effects.
29. Deterministic side effects that belong on the worker should arrive as explicit worker-side action primitives, not as hidden prompt conventions.
30. Tasks are not the only unit of useful work:
    - query/assistant interactions that inspect, summarize, brainstorm, draft artifacts/docs, or directly reshape repo/company config should not require task creation
    - this includes real repo-native operations such as updating workflows, creating agents, editing `.autopilot/` structure, and adding packages/files when the operator wants direct assistant help instead of durable workflow execution
    - query mode may still create or propose a task when the operator explicitly asks for execution, delegation, follow-up ownership, or durable workflow history
    - task creation should happen only when work needs durable workflow ownership, review state, routing, or execution history
31. Deployment connectivity must stay URL-based:
    - localhost, LAN IP, public DNS, reverse proxy, and Tailscale/private URL should all be valid transport shapes
    - orchestration semantics must not depend on colocated filesystems
32. Multi-worker topologies are first-class:
    - one orchestrator plus many workers on different PCs/VPSes must remain a core planning case, not an afterthought
33. Security design must assume remote workers and private overlays:
    - bearer/join/auth flows should work over private networks such as Tailscale just as well as public HTTPS deployments
    - “it works because all processes share one laptop” is not sufficient validation
34. Shared company setup should be cluster-known:
    - provider setup, pack-installed surfaces, capability profiles, bindings, and shared integration requirements should not depend on tribal knowledge on one worker
    - a newly joined worker should be able to participate from repo + orchestrator truth, plus scoped secrets
35. Worker-local state is still real and acceptable:
    - worktrees, runtime sessions, local caches, local toolchains, and machine-bound credentials are not a design failure
36. Release/update flows must stay operator-controlled and inspectable:
    - stable/canary channel choice should be explicit
    - rollback path should be documented and operationally clear
    - autoupdate must never become silent self-mutation by default
    - the goal is not “everything derives only from git”, but “everything shared and portable is cluster-known”
36. Surface auth should be orchestrator-native:
    - inbound webhook verification, OAuth installs, signatures, and service-to-service auth belong at the orchestrator boundary
    - packs/handlers may adapt provider specifics, but should not invent private auth stores or rely on proxy folklore
37. Prefer existing Better Auth capabilities where they fit:
    - do not re-invent install/login/token/session machinery if Better Auth plugins already cover the need cleanly
    - still keep provider-specific webhook/signature verification explicit where Better Auth is not the right abstraction
38. Low-level handler stdin/stdout JSON remains the canonical contract:
    - future SDK/ergonomics layers should compile down to the same typed envelope/result model
    - authoring sugar must not create an alternate hidden handler runtime
39. Stable higher-level SDKs are desirable, but they must compile to orchestrator-owned primitives:
    - handler SDKs should compile to the existing handler envelope/result contract
    - agent/query invocation SDKs should compile to stable orchestrator APIs for task, run, and query-plane execution
    - no surface-specific client should invent private invocation semantics
40. Runtime adapter setup must be documented as operator/tutorial flow, not hidden behind future app/dashboard assumptions:
    - install/login/auth/MCP setup for Claude Code, Codex, OpenCode, and later runtimes should be explicit
    - runtime-local setup is part of operator docs
    - company/orchestrator truth must stay separate from per-runtime local authentication/setup steps
41. After the core primitives are truthful, prefer hardening, deployment validation, docs, and operator/setup sugar over a large app/dashboard push:
    - one-line local deploy
    - Docker/self-host packaging
    - split-host deployment guides
    - private-overlay validation
    - doctor/setup helpers
    - syntax sugar that compiles to the same primitives
42. Presentability should come from truthful operation, not UI cover:
    - a real VPS dogfood deployment, clear docs, and strong setup/tutorial flows are higher leverage than an immature app shell
43. Near-term app/dashboard value is largely substitutable by the query plane plus real surfaces:
    - a strong personal assistant flow over Telegram/CLI/MCP can inspect and operate the system without a dedicated app shell
    - if the assistant has the right skills plus runtime/PC access through the existing adapter model, it can already answer questions, update company/repo structure, and drive operator workflows
    - this makes query/surface quality a higher-leverage investment than an app/dashboard push in the near term
44. Session continuity and source-of-truth context are different concerns:
    - conversation/session state exists to preserve continuity
    - it must not become the primary truth store for workflows, company structure, or runtime execution
45. Surface sessions, task bindings, and runtime sessions must stay distinct:
    - a Telegram chat or thread is not automatically a task
    - a task is not a runtime session
    - task-bound threads and general query sessions should be explicit modes over the same primitives
46. Company agents need layered context rather than one giant prompt/session blob:
    - base agent context
    - shared company context
    - invocation-local task/query context
    - compact session carryover
47. File/repo retrieval is not the missing primitive:
    - indexing and agentic search can own discovery
    - the remaining problem is context assembly, budgeting, summarization, and boundaries
48. Company user/member management should default to Better Auth where it cleanly fits:
    - do not invent a parallel user, invite, membership, or session subsystem by reflex
    - keep operator identity/auth separate from provider webhook/service auth
49. Deployment and setup helpers should compile down to the same truthful topology:
    - one-line local, Docker/self-host, split-host, private-overlay, and later Swarm/Kubernetes flows must describe the same orchestrator/worker model
    - setup sugar and doctor commands should validate reality, not hide architecture
50. `@questpie/autopilot-spec` should stay a real contract package:
    - stable cross-package and cross-process schemas belong there
    - worker-local or orchestrator-local observability/helper schemas should stay local until they are truly shared
51. Future hosted/cloud packaging should preserve the same core model:
    - hosted orchestrator is acceptable
    - BYOS workers should remain a first-class option
    - managed worker and managed model/API offerings may exist later, but should still compile to the same orchestrator/worker/runtime contracts
52. `Pass 24.8` should provide only a thin continuity foundation for `Pass 24.9`:
    - explicit query chaining/carryover is good
    - hidden full session semantics are not
    - continuity metadata must stay compact and inspectable rather than becoming a second truth store
53. Tasks and runs are execution ledger, not schedulers:
    - durable task/run state records what work exists and what happened
    - schedules/triggers decide when work should start
    - do not overload task rows into cron/heartbeat semantics
54. Standing orders/programs should be explicit repo/company truth, not just giant injected prompts:
    - durable authority, repetition, and escalation rules should be inspectable
    - they should compile down to query/task/workflow primitives rather than bypass them
55. Heartbeat-style periodic automation must wait for clearer session/context ownership:
    - periodic assistant turns are not forbidden
    - but they should not precede the messaging/session/context clarification passes
56. Competitive pressure from OpenClaw should be treated as category/sentiment input, not as a blind parity checklist:
    - study what people actually value there
    - avoid drifting back into assistant/gateway-first positioning
    - differentiate through company/repo/control-plane truth rather than copying every automation surface literally

## Implementation Hygiene

Prefer:

- `node:crypto` for generated IDs, tokens, secrets, and dedupe material when randomness or uniqueness matters

Avoid:

- `Math.random()` for anything that becomes durable system state or security-sensitive material

Reason:

- stronger collision resistance
- cleaner security posture
- better consistency across future passes

## Current Truth vs Target Truth

### Task / workflow / run / routing

Correct model:

- `task` = stable unit of intent
- `task.assigned_to` = owning agent
- `workflow` = progression logic for the task
- `run` = one execution attempt for a workflow step
- `routing policy` = chooses worker / device / runtime for that run

Wrong model:

- task as chat thread
- task as runtime session
- task assignment as worker/device routing
- workflow as hidden prompt choreography

### Workflow vs task graph

Correct target model:

- workflow progression handles one task through many steps and runs
- task graph handles decomposition and joins across many related tasks
- planner agents may create child tasks, but only through orchestrator-owned primitives

Current truth:

- `task_relations` now hold parent/child truth
- `task.spawn_children` is real and idempotent
- `wait_for_children` is now a workflow step, not a planner convention
- child failure / completion wakes parent re-evaluation through orchestrator event handling

Wrong target model:

- epic implemented only as one giant task with more replies
- parent/child links hidden only in metadata
- planner reruns depending on memory instead of relation truth

### Worker / device / adapter

- `device` = host machine
- `worker` = long-running execution process on that device
- `adapter` = runtime integration inside the worker (`claude-code`, later `codex`, `opencode`)

Today, one worker normally runs on one device and exposes one or more runtime capabilities.

### Scope / distribution

Correct model:

- `.autopilot/company.yaml` = company scope
- `.autopilot/project.yaml` = project scope
- `.autopilot/company.yaml` may also declare desired pack dependencies
- registries are configured separately from company identity/defaults
- resolved installs belong in a lockfile, not in `company.yaml`
- orchestrator resolves company + project into one runtime truth
- workers consume only portable claim payloads

Wrong model:

- `company.json` as a second root manifest
- top-level `company.yaml` as long-term source of truth
- worker-side company/project discovery at execution time
- separate local and cloud semantics

### Cloud-first execution

Correct target model:

- orchestrator may be remote by default
- orchestrator may sit on one PC/VPS while workers run on different PCs/VPSes
- workers may join from different machines over time
- pack install, secret delivery, provider setup, and capability injection must all still work in that model
- connectivity may come from localhost, LAN IPs, public DNS, reverse proxies, or private overlays such as Tailscale
- local self-host should behave as the same system with a different URL and deployment shape

Wrong target model:

- repo-local assumptions that only work when orchestrator and worker share one machine
- requiring same-machine local paths as an architectural dependency between orchestrator and worker
- secrets/setup that must be manually recreated on every worker forever
- runtime-specific hacks in workflow YAML that only make sense for one local tool

### Skills / capabilities / runtime injection

Correct target model:

- `.autopilot/skills/` and packs determine which skills/prompts/tools exist in the repo
- workflow or agent config selects runtime-neutral capability profiles for a given run/step
- worker/adapter translates those profiles into runtime-specific injection
- Claude-specific slash invocation is an adapter detail, not the workflow contract

Wrong target model:

- repo-installed skills implicitly always active for every run
- workflow YAML hardcoding `/skill-name` as the canonical orchestration primitive
- packaging/install and runtime activation treated as the same thing

### Secrets / distribution

Correct target model:

- repo config declares secret refs and secret requirements
- orchestrator may own encrypted shared company secrets and distribute only the scoped subset needed for a worker/run/provider
- worker-local still owns machine-bound credentials, sessions, and resolved runtime secrets
- provider-only secrets may remain orchestrator-only if workers never need them

Wrong target model:

- raw shared secrets in git
- raw shared secrets copied manually to every worker as the permanent model
- every worker always receiving every company secret
- “worker-local only” as the only secret story for a multi-worker cloud-compatible system

### Cluster-wise known state

Correct target model:

- git holds authored desired state
- orchestrator holds cluster-wise operational/shared state
- workers hold node-local execution state
- portable company setup should be recoverable on a new worker from git + orchestrator truth + scoped secret delivery

Wrong target model:

- “everything important lives only on one worker”
- conflating shared setup drift with legitimate worker-local runtime state
- expecting git alone to replace operational/shared company state

### Surface auth / service auth

Correct target model:

- service-to-service auth and inbound surface verification are orchestrator concerns
- Better Auth and its plugin ecosystem should be reused where it cleanly fits install/login/token/session flows
- provider-specific webhook/signature/header verification should still be explicit and inspectable at the orchestrator boundary

Wrong target model:

- packs depending on undocumented reverse-proxy rewrites
- auth semantics buried only inside handler scripts
- each surface inventing a separate ad hoc auth subsystem when orchestrator-native auth can own it

### Handler authoring ergonomics

Correct target model:

- the raw handler contract stays stable:
  - typed envelope on stdin
  - typed result on stdout
- a later SDK may provide:
  - `defineHandler(...)`
  - typed result builders
  - op-specific helpers for `notify.send`, `intent.ingest`, and `conversation.ingest`
  - basic test helpers
- handlers can still implement more complex provider logic without re-implementing stdin parsing and result formatting each time

Wrong target model:

- every handler hand-parsing stdin/stdout forever as the only authoring UX
- an SDK that becomes a second hidden runtime with different semantics from the canonical contract

### Deterministic worker actions

Correct target model:

- model behavior and deterministic execution stay separate
- agents may author or call repo-owned scripts
- workflows may later invoke explicit worker-side script actions with declared inputs, outputs, cwd, timeout, and scoped secret injection
- notification buttons drive task/workflow actions first; workflow then routes into script/action execution

Wrong target model:

- hiding deterministic script execution behind ad hoc prompt instructions forever
- notification buttons directly performing deploy/publish side effects outside workflow truth
- provider handlers becoming the home of local repo-side deterministic automation

### Pack / registry distribution

Correct target model:

- packs are the generic distribution unit for repo-native Autopilot material
- packs may contain providers, handlers, workflows, context, skills, prompts, and MCP setup
- git-backed registries are the first real distribution backend
- `autopilot sync` becomes the apply/install command over desired state
- `autopilot sync` is now the apply/install command over desired state
- onboarding and surface setup select/install packs rather than hardcoding templates
- AI-assisted install is allowed as a higher layer for complex setup, but it must resolve back into manifest + lockfile + file truth

Wrong target model:

- every new surface manually scaffolded in bootstrap code
- providers treated as notification-only config
- hardcoded Telegram/Slack/Discord logic in orchestrator core
- pack/update behavior hidden only in AI prompts with no manifest/lock truth

### Surfaces / channels / hooks

Correct target model:

- providers remain the generic runtime adapter concept for external integrations
- surfaces are the human-facing channel category layered on top of providers/handlers
- hooks/callbacks are transport/auth patterns, not the top-level product concept
- Telegram-first personal operator flow is a valid early surface
- Slack is the likely first strong B2B surface
- surfaces should ship as packs, not core branches

Wrong target model:

- renaming the whole provider system to hooks
- hardcoding a Telegram or Slack product mode into orchestrator
- treating notification-only semantics as the entire extension model

### Runtime adapters

Correct next split:

- Runtime Adapters V1:
  - add Codex and OpenCode adapter implementations
  - keep default runtime behavior if no per-agent model selection exists
- Runtime Selection Pipeline V1:
  - add per-agent `model` / `provider` / `variant`
  - route through claimed runs and worker-local model/variant maps

Wrong next split:

- pretending multi-runtime parity is just two new worker classes
- coupling orchestrator to runtime-specific CLI flag strings

### Workflow outputs

Current truth:

- step outputs are declared in workflow YAML
- engine generates the machine-readable suffix
- routing matches against named output fields
- reusable artifacts can be forwarded via `input.artifacts`
- durable preview is orchestrator-served from stored preview artifacts, not from raw worker URLs

Likely cleanup direction:

- output-field bindings for artifact persistence
- explicit content format metadata where behavior/rendering genuinely differs
- preview entry hints or richer preview bindings only if the current static landing-page path proves insufficient

Do not overbuild this into a rules engine.

## Data Ownership

- `company.db`
  - tasks, runs, workers, leases, run events, auth, join tokens, worker credentials, artifact metadata
- `index.db`
  - rebuildable search/embedding state
- `git/FS`
  - code, docs, `.autopilot/` authored config, skills, context
- `worker-local`
  - Claude sessions, raw logs, raw transcript, worktrees, machine credential, MCP temp files, resolved secret values

Sync model:

- tasks/runs/events sync through orchestrator API
- code/config/docs sync through git
- raw runtime state does not sync centrally

## Current Build Order

### Pass 17: `.autopilot/` Scope Foundation — DONE

Delivered:

- canonical `.autopilot/` config surface
- company/project scope schemas
- scope discovery + resolved config
- orchestrator bootstrap wired to resolved config

### Pass 18: Workflow Control Flow + Step I/O — DONE

Delivered:

- explicit control flow
- validator loops
- declarative step outputs
- structured output suffix generation
- source-run forwarding
- explicit artifact inputs

### Pass 19: Resolved Context Distribution — DONE

Delivered:

- portable claim/run context contract
- agent identity in claim payload
- task context in claim payload
- separated `actions` / `secret_refs`
- worker runtime no longer depends on company/project filesystem discovery

### Pass 20: Workflow Output / Transition Unification — DONE

Delivered:

- generic transition matching over named output fields
- `outputs` flow from adapter -> completion -> workflow routing
- dogfood workflow migrated to ordered `when -> goto` rules

### Pass 20.1: Durable Preview URLs — DONE

Delivered:

- worker collects changed previewable files as `preview_file` artifacts
- orchestrator stores preview files durably through the existing artifact path
- orchestrator serves previews via `/api/previews/:runId/*path`
- orchestrator auto-creates `preview_url` artifacts
- preview inspection no longer depends on worker uptime

### Pass 21: Provider / Extension Runtime V1 — DONE

Delivered:

- provider YAML instances under `.autopilot/providers/*.yaml`
- standardized Bun handler runtime
- typed handler envelopes/results
- provider config loading through the normal scope/config path
- no provider-specific hardcoding in orchestrator core

### Pass 21.1: Async Operator Wake-Up Layer — DONE

Delivered:

- notification bridge over actionable orchestrator events
- outbound `notify.send` flow through provider handlers
- actionable payloads with task/run/preview links
- CLI inbox / watch over existing task/run/artifact/event truth

### Pass 21.2: Intent -> Task Surface — DONE

Delivered:

- provider-driven `intent.ingest`
- normalized intake results
- one truthful task materialization path
- rough intent can now become durable task truth through orchestrator primitives

### Pass 21.3: Conversation Bindings / Chat Actions — DONE

Delivered:

- `conversation_bindings` operational model
- inbound `conversation.ingest` route with provider-secret auth
- binding lookup by external conversation/thread identity
- dispatch through `task.reply` / `task.approve` / `task.reject`
- no chat-specific truth store in the orchestrator core

### Pass 21.4: Bound Conversation Loop V1 — DONE

Delivered:

- thread-aware outbound delivery over existing conversation bindings
- bound conversation payloads with task/run/preview links
- same-thread blocked / failed / completed / preview updates
- conversation channels now behave like real async operator surfaces

### Pass 22: Epic / Task Graph V1 — DONE

Delivered:

- first-class task relations
- `task.spawn_children`
- deterministic/idempotent child materialization
- parent/child queries and derived rollups
- truthful failed-child signal for all current failure terminals

### Pass 22.1: Parent Wait / Join — DONE

Delivered:

- `wait_for_children` workflow step
- explicit join policy for `all_done` / `any_failed`
- parent blocking without creating a run
- event-driven parent wake-up on child task changes
- routing to `on_met` / `on_failed`

### Pass 22.2: Pack Distribution / Registry V1

Goal:

- stop hardcoding onboarding and surface setup
- introduce a standard distribution unit for repo-native Autopilot content
- make `autopilot sync` the apply/install command over manifests

Likely shape:

- `company.yaml` pack dependencies
- global + repo-local registry registration
- `packs.lock.yaml`
- pack manifests for workflows/surfaces/providers/skills/prompts
- git-backed registries first
- strict install foundation first, AI-assisted install layered on top later

### Pass 22.3: Bootstrap / Onboarding V1

Goal:

- one-command setup for a truthful local-first company/project
- Claude Code + MCP as the default operator surface
- same flow locally, on VPS, or later in managed cloud

Likely shape:

- `autopilot bootstrap`
- starter `.autopilot/` skeleton
- starter workflows / agents / packs
- context import
- sync into Claude-compatible surfaces
- explicit next-step output for owner init / start / first task

### Pass 22.4: Parent / Rollup Ergonomics

Goal:

- make planner-created child tasks operationally usable after bootstrap and packs are in place

Likely shape:

- CLI task inspection improvements
- parent progress in notifications where helpful
- clearer operator-facing epic state

### Pass 23: Operator App / Dashboard Phase A

Goal:

- role-aware operator/company shell
- orchestrator + worker overview
- project/task/run/event/operator loop
- selected worker/fleet status
- direct work surface over the same primitives

Important:

- the future app should layer on already-truthful async/operator primitives
- it is not the next architecture blocker

### Pass 23: Operator App / Dashboard Phase B

Goal:

- diff / drift review surfaces
- artifact review surfaces
- richer worker/company diagnostics
- same-host optimizations where useful

### Follow-up Cleanup: Artifact Output Unification

Likely cleanup after the preview pass or during early app/dashboard work:

- move toward output-field artifact bindings
- reduce special artifact tag handling
- keep content-format metadata explicit but small

### Messaging / schedules (later)

Reason:

- messaging/threading tables exist but are not an active product primitive yet
- schedules exist as schema but not as real orchestrator runtime behavior
- both should follow a truthful async operator loop, not precede it

## Immediate Next-Track Prompts

Current next-track prompts should focus on:

- pack distribution / registry v1
- bootstrap / onboarding with Claude Code + MCP as primary surface
- parent / rollup ergonomics
- local -> VPS migration assist
- managed cloud / managed worker packaging before any serious app/dashboard push

### primitive-roadmap

# Primitive Roadmap

Purpose:

- define the smallest durable primitive set
- separate core primitives from adapters and clients
- stop UI-led or provider-led architecture drift

This is an active planning memo.

## Pass Index

Use these pass IDs consistently when referring to the active roadmap.

Completed foundation:

- `Pass 22.0` — Epic / Task Graph V1 foundation
- `Pass 22.1` — Task Graph hardening + failure normalization + parent wait / join
- `Pass 23.0` — Pack Distribution / Registry V1
- `Pass 23.1` — Pack Distribution / Registry V1.1 cleanup

Current build sequence:

- `Pass 24.0` — Bootstrap / Onboarding V1
- `Pass 24.0.1` — Bootstrap / Onboarding V1.1 truth cleanup
- `Pass 24.1` — Parent Rollup / Inspection Ergonomics V1
- `Pass 24.2` — Surface Packs V1
- `Pass 24.3` — Provider / Surface / Pack docs overhaul
- `Pass 24.4` — Workflow Capability Profiles V1
- `Pass 24.5` — Shared Secret Store / Secret Distribution V1
- `Pass 24.6` — Worker Script Actions V1
- `Pass 24.7` — Actionable Notifications V1
- `Pass 24.8` — Query / Personal Assistant V1
- `Pass 24.9` — Messaging / Session Model clarification pass
- `Pass 26.0` — Runtime Adapters V1

Active hardening / next sequence:

- `Pass 25.2` — Multi-Worker / URL-Security Validation V1 ✓
- `Pass 25.3` — Deployment Packaging / One-Line Local + Docker V1 ✓
- `Pass 25.4` — Operator Doctor / Setup Validation V1 ✓
- `Pass 25.7` — Release / Update / Channel Management V1 ✓
- `Pass 25.8` — Runtime Setup Tutorials / VPS Dogfood Runbook V1 ✓
- `Pass 26.1` — Runtime Selection Pipeline V1 ✓
- `Pass 24.10` — Handler SDK / Surface Authoring Ergonomics V1 `(planning/spec first)`
- `Pass 24.11` — Agent Invocation SDK / Stable Invocation Contract V1 `(planning/spec first)`
- `Pass 24.12` — Company Agent Context Model V1 `(planning/spec)`
- `Pass 24.13` — Context Assembly / Budget / Snapshot Model V1 `(planning/spec)`
- `Pass 24.14` — Company User Management / Membership / Roles V1 `(planning/spec, Better Auth-backed)`
- `Pass 25.0` — Local -> VPS Migration Assist V1
- `Pass 25.1` — Managed Cloud / Managed Worker Packaging
- `Pass 25.5` — Onboarding / Operator Sugar V1 `(planning/spec)`
- `Pass 25.6` — Spec Boundary / Schema Ownership Cleanup V1 `(planning/spec)`
- `Pass 26.1` — Runtime Selection Pipeline V1
- `Pass 25.9` — Run Retry / Lease Expiry / Task Recovery V1 `(dogfood finding, infra-failure auto-retry)`
- `Pass 25.10` — Runtime Event Streaming V1 ✓ `(dogfood finding, claude-code + opencode streaming parity with codex)`
- `Pass 25.11` — CLI Live Event Display V1 `(dogfood finding, query/runs SSE subscription for live progress)`
- `Pass 25.12` — Task-Scoped Worktree V1 `(dogfood finding, CRITICAL — worktree per task not per run, steps share workspace)`
- `Pass 26.2` — MCP Auth Hardening V1
- `Pass 26.3` — Schedules / Triggers V1 `(planning/spec)`
- `Pass 26.4` — Standing Programs / Orders V1 `(planning/spec)`
- `Pass 26.5` — Task Audit / Maintenance / Health V1 `(planning/spec)`
- `Pass 26.6` — Hooks / Heartbeat / Periodic Automation V1 `(planning/spec, only after session/context truth is clearer)`
- `Pass 27.x` — Operator App / Living Dashboard phases later

## Architectural Stack

Autopilot should be built in four layers:

1. core primitives
2. extension/provider runtime + pack distribution
3. headless clients
4. Operator App / Living Dashboard

This order matters.

If a feature only exists in the app, that is a smell.
If a provider requires hardcoded orchestrator logic, that is also a smell.

## Near-Term Productization Bias

Before any serious app push, the preferred near-term direction is:

- finish the current primitive passes that affect operator truth
- harden the system into a production-like durable dogfood alpha
- validate real deployment topologies
- improve onboarding/setup ergonomics without changing the primitive model

In practice this means prioritizing:

- multi-worker / remote-topology truth
- one-line local deploy clarity
- Docker/self-host deploy packaging
- split-host orchestrator/worker deployment docs
- private-overlay/Tailscale validation
- release/install/update/rollback channels
- runtime setup tutorials
- doctor/setup helpers and small syntax sugar
- docs, demo, and pitch packaging around truthful operation

Also note:

- near-term app value is largely replaceable by a strong query/personal-assistant plane plus real surfaces such as Telegram, CLI, and MCP-enabled coding runtimes
- if those surfaces can inspect state, mutate repo/company config, and drive the same primitives truthfully, that is preferable to inventing an app-first control path too early

This is higher leverage than a large app surface while the system is still being hardened.

Also needed for a durable self-host/BYOS product:

- explicit release mechanism for CLI/orchestrator/worker artifacts
- stable vs canary channel semantics
- version compatibility policy across orchestrator and workers
- operator-visible update checks and rollback path
- optional autoupdate only as an explicit policy, not hidden background mutation

## Layer 1: Core Primitives

These should stay small, explicit, and durable:

- `task.create`
- `task.update`
- `task.approve`
- `task.reject`
- `task.reply`
- `run.inspect`
- `run.continue`
- `artifact.list`
- `preview_url`
- notification dispatch trigger
- later: `intent.propose`

Important:

- core primitives mutate system truth
- orchestrator is the source of truth
- primitives should not depend on a specific UI or provider

Next additions at this layer should be:

- `task.spawn_children`
- `task.list_children`
- `task.list_parents`
- `task.child_rollup`

## Layer 2: Extension / Provider Runtime + Pack Distribution

This is the next real architecture layer.

Goal:

- register external channels/providers through authored config
- point them at standardized Bun handlers
- let handlers do edge logic without letting them own core state
- distribute repo-native integrations and starter content through pack registries instead of hardcoded scaffolding

Correct model:

- provider instance is authored in YAML
- handler implements provider-specific logic
- handler returns normalized actions or outbound payloads
- orchestrator executes primitives
- packs distribute providers, handlers, workflows, context, skills, and surface setup
- registries resolve packs; sync materializes them into the repo

Wrong model:

- hardcoded Slack/Telegram/email integrations in core
- chat provider directly mutating DB state
- the future app/dashboard becoming the only meaningful control surface
- onboarding/surface setup hardcoded into CLI templates forever

## Layer 3: Headless Clients

These are clients of the primitives:

- CLI
- MCP surfaces
- Claude Code / local cloud code
- ChatGPT / Claude.ai via connectors
- chat apps later

These may:

- help brainstorm intent
- render blocked work
- offer reply/approve/reject actions
- surface preview links

These should not become alternate truth stores.

## Layer 4: Operator App / Living Dashboard

The app should come after the primitive and extension layers are truthful.

Likely role of the future app:

- visual operator/company surface over the same orchestrator/worker primitives
- overview of orchestrator health, workers, tasks, workflows, artifacts, files, and company/project structure
- role-aware views and access control for different kinds of users
- direct work surface for query, review, inspection, and repo/company mutation over the same APIs
- an extensible “living dashboard” shell rather than a worker-only shell

Role it should not take:

- hidden source of task/routing/reply semantics
- only place where review or company operation is possible
- a replacement truth store for sessions, workflows, or company structure
- home of provider-specific behavior that bypasses the primitive model

## Implemented Foundation

These primitives/layers are now real enough to build on:

1. provider runtime v1
2. notification bridge v1
3. intent intake v1
4. CLI inbox/watch v1
5. conversation binding v1
6. bound conversation loop v1
7. task relations + `task.spawn_children`
8. parent wait / join over child tasks
9. pack distribution / registry v1
10. `autopilot sync` as deterministic pack install/apply

That means the next missing primitive layer is no longer notifications, chat, or distribution.

It is onboarding, operator ergonomics, cloud-first capability/secret execution, surface packs, and runtime expansion over the now-truthful task graph and pack model.

## Immediate Next Primitives

### Pass 24.0 — Bootstrap / Onboarding V1

Purpose:

- make the first-run experience truthful, easy, and Claude Code + MCP friendly

Needs:

- `autopilot bootstrap`
- small `.autopilot/` skeleton
- pack-first starter selection
- context import
- local-first / join-existing flow
- explicit next-step output using real commands

Priority:

- immediate

### Pass 24.0.1 — Bootstrap / Onboarding V1.1 truth cleanup

Purpose:

- make bootstrap output and first-run operator guidance fully truthful

Needs:

- real MCP setup instructions only
- real task-create examples only
- truthful join-existing worker enrollment guidance

Priority:

- immediate cleanup after `Pass 24.0`

### Pass 24.1 — Parent Rollup / Inspection V1

Purpose:

- make epic/task-graph state operationally visible and easy to act on

Needs:

- child rollup helpers surfaced where operators actually work
- parent/child CLI inspection
- notification/context improvements where useful

Priority:

- next

### Pass 24.2 — Surface Packs V1

Purpose:

- make external human-facing control surfaces installable without hardcoding them into core

Needs:

- Telegram Surface Pack V1
- provider/surface auth/setup guidance
- pack-distributed handlers/providers/context/prompts
- provider/surface docs overhaul
- keep surface auth orchestrator-native:
  - webhook verification, signatures, OAuth/service auth at the orchestrator boundary
  - handlers normalize provider specifics but do not become private auth systems

Priority:

- next

### Pass 24.3 — Provider / Surface / Pack docs overhaul

Purpose:

- document providers, surfaces, packs, install/apply, and extension boundaries truthfully

Needs:

- stop framing providers as notification-only
- explain packs vs providers vs handlers vs surfaces
- explain sync/install/apply and private registry direction

Priority:

- next, alongside first real surface pack

### Pass 24.4 — Workflow Capability Profiles V1

Purpose:

- let workflows request runtime capabilities explicitly without hardcoding runtime-specific syntax

Needs:

- runtime-neutral step/agent capability profile model
- skill/tool/MCP profile selection per step or agent
- worker/adapter translation into runtime-specific injection

Priority:

- after first pack/bootstrap layer is stable

### Pass 24.5 — Shared Secret Store / Secret Distribution V1

Purpose:

- make shared company integrations work across many workers without manual per-worker secret re-entry

Needs:

- orchestrator-managed encrypted shared secret storage
- repo-level secret refs/requirements remain authored truth
- scoped delivery of only the secrets a worker/run/provider actually needs
- separation between worker-local machine secrets and shared company secrets
- model this as cluster-wise shared truth, not as “copy all env vars onto every worker”

Priority:

- high, before claiming the system is truly multi-worker/cloud-ready

### Pass 24.6 — Worker Script Actions V1

Purpose:

- add a deterministic worker-side execution primitive for repo-owned scripts

Needs:

- generic `script` action kind
- explicit script path, args, cwd, timeout
- input/output artifact bindings
- scoped secret/env injection
- run event reporting for deterministic side effects

Priority:

- after capability/secret direction is clear

### Pass 24.7 — Actionable Notifications V1

Purpose:

- make review/approve/reply flows first-class while keeping side effects under workflow truth

Needs:

- task action buttons or equivalent channel actions
- clear boundary:
  - notification action mutates task/workflow state
  - workflow routes to script/provider execution later
- review/deploy/publish examples grounded in the real primitives

Priority:

- after script actions and first surface packs are clear enough

### Pass 24.8 — Query / Personal Assistant V1

Purpose:

- allow company/status/explainer/brainstorm/doc-artifact/direct-repo work without forcing task creation

Needs:

- query plane over repo context + operational DB state
- company summaries, blocker/status inspection, workflow explanation
- brainstorming, drafting, and artifact/doc creation that can stay outside task history when no durable workflow ownership is needed
- direct assistant-driven repo/company operations when appropriate:
  - update workflows
  - create/edit agents
  - reshape `.autopilot/` structure
  - add packages/files/config
- clear boundary between query and task creation:
  - queries can inspect, brainstorm, draft, and synthesize
  - queries can also perform direct repo-native mutation when the operator wants immediate assistant help over the same filesystem/git surface
  - queries may still create or propose tasks when the operator asks for durable execution/delegation
  - tasks are only created when work needs durable ownership, routing, review state, or execution history

Priority:

- after operator surfaces are strong enough to benefit from it

### Pass 24.9 — Messaging / Session Model clarification pass

Purpose:

- make runtime messaging, workflow messaging, external messaging, and session ownership explicit

Needs:

- clear docs/specs for:
  - runtime transcript/session
  - task reply/approval/reject flow
  - external conversation binding
  - parent/child and artifact handoff
- explicit non-goals for free-form agent-to-agent chat if still deferred

Priority:

- before expanding collaboration claims

### Pass 24.10 — Handler SDK / Surface Authoring Ergonomics V1

Purpose:

- make provider/surface handlers pleasant to author without breaking the canonical handler contract

Needs:

- ergonomic `defineHandler` / op-specific helpers over the existing stdin/stdout envelope/result contract
- typed helpers for notification, intent, and conversation handlers
- provider/surface auth and payload normalization helpers where useful
- tests/examples that prove the SDK compiles down to the same canonical runtime contract

Important:

- this should start as a planning/spec pass first
- verify it preserves current orchestrator/worker/provider boundaries before implementation

Priority:

- after secrets/query/script direction is clear enough to avoid inventing the wrong sugar layer

### Pass 24.11 — Agent Invocation SDK / Stable Invocation Contract V1

Purpose:

- make task/query/agent invocation stable across clients without inventing surface-specific semantics

Needs:

- stable contract for invoking durable task work vs non-task query/assistant work
- ergonomic SDK/client helpers that compile to orchestrator-owned APIs
- explicit boundary between:
  - task/workflow execution
  - query/personal-assistant interactions
  - future client surfaces and SDKs
- preservation of current primitive ownership:
  - orchestrator owns truth
  - workers execute
  - clients do not invent private invocation models

Important:

- this should also start as a planning/spec pass first
- it must be validated against current primitives before implementation

Priority:

- after `Pass 24.8` and `Pass 24.9`, so the task plane vs query plane contract is explicit first

### Pass 24.12 — Company Agent Context Model V1

Purpose:

- define what a company agent should know by default without turning every session into one giant hidden memory blob

Needs:

- explicit layering between:
  - base agent context
  - shared company context
  - invocation-local task/query context
  - compact session carryover
- clear ownership boundaries for which context belongs in git, orchestrator state, worker-local state, or surface/session metadata
- alignment with capability profiles, query mode, and future invocation SDKs

Important:

- this should start as a planning/spec pass first
- it should not invent a new persistence layer or a new truth store

Priority:

- after `Pass 24.8` and `Pass 24.9`, so task/query/session boundaries are explicit first

### Pass 24.13 — Context Assembly / Budget / Snapshot Model V1

Purpose:

- make context selection deterministic and inspectable rather than “whatever the runtime happened to remember”

Needs:

- context assembly rules over:
  - repo/index search results
  - operational state
  - agent defaults
  - session carryover
- explicit context budget and summarization strategy
- guidance for when to use fresh retrieval vs compact snapshots/summaries
- explicit acknowledgement that indexing/agentic search already solves discovery; the missing piece is assembly/boundary discipline

Important:

- this should start as a planning/spec pass first
- it should not become a new retrieval/indexing rewrite

Priority:

- after `Pass 24.12`, because agent context layers should be defined before final assembly rules

### Pass 24.14 — Company User Management / Membership / Roles V1

Purpose:

- make the system credible for a real company with many people without inventing a parallel auth stack

Needs:

- company/user/member/invite/role model for operator-facing surfaces
- clear split between:
  - operator user identity and sessions
  - worker credentials
  - provider/service auth
- role-aware access expectations for future app/dashboard surfaces and current API/CLI/MCP usage
- strong reuse of Better Auth where it cleanly fits login, membership, invite, and session flows

Important:

- this should start as a planning/spec pass first
- do not design a custom auth/user subsystem when Better Auth already covers the relevant primitive well

Priority:

- before any serious role-aware app/dashboard push

### Pass 25.0 — Local -> VPS Migration Assist V1

Purpose:

- make deployment migration feel like the same model, not a different product

Needs:

- repo + DB + env + URL cutover guidance or assist
- same operator flow after migration
- explicit orchestrator URL handling

Priority:

- next, before any serious app/dashboard push

### Pass 25.1 — Managed Cloud / Managed Worker Packaging

Purpose:

- package the same orchestrator/worker model as a paid hosted offering

Needs:

- hosted orchestrator
- BYOS workers as a first-class option
- optional managed worker
- optional managed model/API layer for teams that do not want to bring their own runtime/model access
- same `.autopilot/`, workflows, and operator surfaces as self-hosted

Priority:

- after onboarding direction is clear

### Pass 25.2 — Multi-Worker / URL-Security Validation V1

Purpose:

- validate the architecture against the target deployment shape:
  - one orchestrator
  - multiple workers
  - different PCs/VPSes
  - URL-based connectivity in both public and private networks

Needs:

- explicit validation matrix for:
  - localhost
  - LAN IP
  - public DNS / reverse proxy
  - private overlay such as Tailscale
- check worker enrollment, secret delivery assumptions, provider callbacks, MCP/operator flow, and pack/sync behavior in these topologies
- identify hidden same-machine assumptions
- explicitly validate the intended shape:
  - one orchestrator
  - multiple workers on different PCs/VPSes
  - cluster-known shared state plus legitimate node-local execution state

Priority:

- before calling the deployment model production-ready

### Pass 25.3 — Deployment Packaging / One-Line Local + Docker V1

Purpose:

- turn the validated topology into repeatable packaging/operator flows without changing the architecture

Needs:

- one-line local deploy story
- Docker/self-host packaging story
- split-host packaging expectations for orchestrator vs worker
- truthful handling of public, reverse-proxied, and private-overlay URLs

Important:

- this should start as a planning/spec pass first
- package the same orchestrator/worker model; do not invent a separate “easy mode” architecture

Priority:

- after `Pass 25.2`, so packaging follows validated topology truth

### Pass 25.4 — Operator Doctor / Setup Validation V1

Purpose:

- give operators a fast way to validate runtime, deployment, secret, provider, and surface readiness

Needs:

- `autopilot doctor` / setup validation direction
- runtime install/login/MCP checks
- orchestrator/worker connectivity checks
- secret/provider/surface configuration checks
- actionable diagnostics that compile down to existing primitives and deployment truth

Important:

- this should start as a planning/spec pass first
- it should validate reality, not hide it

Priority:

- after deployment/runtime docs are concrete enough to validate

### Pass 25.5 — Onboarding / Operator Sugar V1

Purpose:

- add small syntax sugar and helper flows that reduce onboarding friction without creating a second control plane

Needs:

- likely helpers such as:
  - `pack add`
  - `registry add`
  - surface/runtime setup helpers
  - targeted bootstrap/setup shortcuts
- explicit rule that sugar compiles down to the same manifests, sync flow, and APIs

Important:

- this should start as a planning/spec pass first
- it should not bypass pack/registry/company truth

Priority:

- after doctor/setup validation direction is clearer

### Pass 25.6 — Spec Boundary / Schema Ownership Cleanup V1

Purpose:

- keep `@questpie/autopilot-spec` a real contract package instead of a dumping ground for every Zod schema

Needs:

- ownership rules for:
  - cross-package/shared contracts
  - worker-local observability schemas
  - orchestrator-local admin/helper schemas
  - authored config schemas
- criteria for what stays local vs what belongs in `spec`
- cleanup direction for weakly-used re-export-only schemas

Important:

- this should start as a planning/spec pass first
- do not turn it into a broad churn-heavy refactor without clear payoff

Priority:

- after the current primitive/productization passes settle enough to audit boundaries sanely

### Post-25.x Operator/Productization Track

After the critical primitive passes and deployment validation are in place, prefer thin operator/productization layers before any large app push by default:

- `autopilot doctor` / setup validation helpers
- onboarding sugar such as `pack add`, `registry add`, and surface/runtime setup helpers
- one-line local deploy helpers
- Docker/self-host packaging helpers
- runtime install/login/MCP setup tutorials
- docs/demo/pitch packaging for the truthful system

These should compile down to the same primitives and deployment model.
They are not a license to invent a second hidden control plane.

### Pass 26.0 — Runtime Adapters V1

Purpose:

- make worker execution runtime-agnostic without changing orchestrator truth

Needs:

- `CodexAdapter`
- `OpenCodeAdapter`
- worker runtime config wiring
- docs-verified CLI behavior per runtime

Known V1 tradeoff:

- Codex and OpenCode currently materialize MCP access by backing up any existing project config, replacing it during the run, and restoring it on cleanup
- this is acceptable for V1, but docs must describe it truthfully and later work should move toward merge/append semantics or less invasive runtime-specific config injection
- crash behavior during the replacement window remains a known operational footgun until that follow-up exists

Priority:

- after bootstrap/surface direction is stable

### Pass 26.1 — Runtime Selection Pipeline V1

Purpose:

- carry agent/runtime selection intent cleanly from authored config to worker execution

Needs:

- per-agent model/provider/variant intent
- orchestrator routing truth
- worker-side model map / runtime translation

Priority:

- after base adapters exist

### Pass 26.2 — MCP Auth Hardening V1

Purpose:

- make MCP auth strong enough for remote, hosted, and private-network operation

Needs:

- preserve easy local/dev dogfood
- harden remote/private URL operator auth
- clarify MCP setup ownership vs company/operator credentials
- reuse Better Auth where it cleanly fits instead of inventing parallel auth/session machinery
- keep service-to-service auth and surface verification aligned with orchestrator-native security

Priority:

- after deployment/security validation direction is clearer

### Pass 26.3 — Schedules / Triggers V1

Purpose:

- add a truthful orchestrator-owned scheduling layer without turning tasks into cron rows

Needs:

- one-shot and recurring schedule model
- timezone-aware trigger semantics
- explicit target semantics for what a schedule starts:
  - query
  - task creation
  - workflow/task execution entrypoint
- clear audit trail over what was scheduled vs what was executed

Important:

- this should start as a planning/spec pass first
- schedules should compile down to the same query/task/workflow primitives
- do not invent a second hidden automation plane

Priority:

- high, after the query/session foundation is clear enough

### Pass 26.4 — Standing Programs / Orders V1

Purpose:

- model persistent repeated operator/program intent in a repo-native, inspectable way

Needs:

- explicit standing order/program model under company/repo truth
- authority, scope, and escalation boundaries
- link to schedules/triggers and/or query/task invocation without collapsing into giant hidden prompt injection
- clear distinction between:
  - standing company/agent instructions
  - task/workflow state
  - session continuity

Important:

- this should start as a planning/spec pass first
- do not copy chat-session “standing orders” literally if it breaks our repo/company truth model

Priority:

- after the schedule/trigger direction is clearer

### Pass 26.5 — Task Audit / Maintenance / Health V1

Purpose:

- give the system a truthful maintenance layer for stuck, stale, failing, or noisy work

Needs:

- task/run health model
- stale blocked task detection
- retry/reminder/escalation planning where appropriate
- operator-facing health/maintenance inspection
- compatibility with future schedules/triggers instead of burying maintenance logic inside ad hoc scripts

Important:

- this should start as a planning/spec pass first
- keep it explicit and auditable rather than magical self-healing

Priority:

- after schedules/standing-program direction is concrete enough

### Pass 26.6 — Hooks / Heartbeat / Periodic Automation V1

Purpose:

- evaluate event hooks and periodic “heartbeat” style automation without breaking session/context truth

Needs:

- explicit event-hook boundary
- explicit periodic automation boundary
- clear relationship to schedules, query continuity, and session ownership
- decision on what should stay deferred until messaging/session/context work is mature

Important:

- this should start as a planning/spec pass first
- do not ship heartbeat-style periodic assistant turns before session/context ownership is clear

Priority:

- only after `Pass 24.9`, `24.12`, and `24.13` make the session/context model truthful

## Later Primitives

These should wait for real evidence:

### Messaging / threads

Only if task-scoped review needs more durable conversational structure than
approval history + provider bindings.

### Hooks / heartbeat

Only after schedules/triggers and session/context ownership are truthful.
Do not introduce periodic assistant behavior before the system knows what continuity and authority it is actually carrying.

### Schedules / triggers

Only after wake-up/review is trustworthy.
Do not automate more work before the human can reliably re-enter the loop.

### npm-compatible registry backend

Only after git-backed registries prove the model.
Do not make npm the first required distribution substrate.

### Policy refinement

Only after repeated patterns emerge in worker access, approval, or action safety.

## Design Guardrails

Before adding a new primitive, ask:

- is this really source-of-truth state?
- or is it just adapter logic?
- or is it just UI sugar?

Prefer:

- primitives in orchestrator
- adapters in provider handlers
- ergonomics in CLI/app/chat clients

Avoid:

- chat product creep
- provider matrices in core

## Later App Direction

If and when a serious UI layer is built, it should be framed as an operator/company app over the same primitives, not as a worker-only shell.

Likely future directions:

- orchestrator/company overview
- my workers and worker fleet views
- task/workflow/company/project overviews
- file and artifact inspection
- direct operator work surfaces over the same query/task primitives
- role-based views and permissions
- extensibility through a living-dashboard-style shell over the same APIs
- a self-hosted/BYOS “internal lovable” style work surface:
  - open projects and see setup drift/diffs
  - left-side chat/assistant rail
  - compact workflow/task/run state views
  - right-side preview, diff, and code/file inspection surfaces

That app should remain:

- CLI/MCP/API-first under the hood
- role-aware, not worker-only
- extensible without becoming a second source of truth
- app-only semantics
- schedule-first automation

## Recommended Order

1. pack distribution / registry v1
2. parent rollup / inspection v1
3. bootstrap / onboarding v1
4. local -> VPS migration assist v1
5. managed cloud / managed worker packaging
6. Operator App / Dashboard Phase A
7. Operator App / Dashboard Phase B
8. messaging/threading only if needed
9. schedules later

### project

# questpie-root

Add project-specific context here: tech stack, key dependencies, folder structure, domain concepts.

This file is synced into CLAUDE.md by `autopilot sync`.
<!-- autopilot:end -->
