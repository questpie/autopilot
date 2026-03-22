# QUESTPIE Autopilot — Architecture & Implementation Plan

> Internal technical document. Source of truth for architectural decisions.
> Last updated: 2026-03-22

---

## 1. System Overview

QUESTPIE Autopilot is an AI-native company operating system. The core architectural bet:
**filesystem as database, agents as employees, SDK as the brain.**

```
┌─────────────────────────────────────────────────────────────┐
│                     CONSUMERS                                │
│  CLI · Dashboard · Mobile · WhatsApp · External APIs         │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls SDK functions
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     SDK LAYER                                │
│                                                              │
│  @questpie/autopilot-spec          Types, schemas, paths     │
│  @questpie/autopilot-agents        Prompt templates          │
│  @questpie/autopilot-orchestrator  Core runtime              │
│    ├── fs/          YAML CRUD + write queue                  │
│    ├── workflow/    State machine engine                      │
│    ├── context/     4-layer context assembler                 │
│    ├── scheduler/   Cron job runner                           │
│    ├── watcher/     FS change detection                      │
│    ├── webhook/     HTTP event receiver                      │
│    ├── session/     Agent session streaming                   │
│    ├── notifier/    Transport dispatcher                     │
│    └── server.ts    Composes everything                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ reads/writes
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  STORAGE LAYER                               │
│                                                              │
│  Phase 1: Local filesystem (YAML/Markdown/JSON)              │
│  Phase 2: Shared filesystem (NFS/EFS/Ceph) for multi-node   │
│  Phase 3: Optional SQLite backend (same schemas, faster)     │
│                                                              │
│  Write Queue (file-level semaphores)                         │
│  Git versioning (audit trail)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. The Concurrency Problem

### Why It Matters

With 4-8 agents running concurrently, all reading/writing YAML files:
- Agent A reads task-040.yaml
- Agent B also reads task-040.yaml
- Agent A writes updated task-040.yaml
- Agent B writes its update → **Agent A's changes lost**

### Solution: Write Queue with File-Level Locks

```typescript
// packages/orchestrator/src/fs/write-queue.ts

class WriteQueue {
  private locks: Map<string, Promise<void>> = new Map()

  async withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock on this file
    while (this.locks.has(path)) {
      await this.locks.get(path)
    }

    // Create lock
    let resolve: () => void
    const lock = new Promise<void>(r => { resolve = r })
    this.locks.set(path, lock)

    try {
      return await fn()
    } finally {
      this.locks.delete(path)
      resolve!()
    }
  }
}

// Usage in task operations:
async function updateTask(root: string, taskId: string, updates: Partial<Task>) {
  const path = await findTaskPath(root, taskId)
  return writeQueue.withLock(path, async () => {
    const task = await readYaml(path, TaskSchema)
    const updated = { ...task, ...updates }
    await writeYaml(path, updated)
    return updated
  })
}
```

**Key design decisions:**
- File-level granularity (not directory-level) — two agents can write different tasks simultaneously
- In-process queue (not distributed) — one Bun process per company
- Read-modify-write within lock — prevents lost updates
- No deadlocks possible — locks are on individual files, no lock ordering needed

### Optimistic Concurrency (Future)

For shared FS scenarios, add version fields:

```yaml
# task-040.yaml
id: task-040
_version: 7  # Increment on every write
title: "Landing page"
status: in_progress
```

```typescript
async function updateTask(root, taskId, updates) {
  return writeQueue.withLock(path, async () => {
    const task = await readYaml(path, TaskSchema)
    const updated = { ...task, ...updates, _version: task._version + 1 }
    await writeYaml(path, updated)
    return updated
  })
}
```

---

## 3. Scaling Architecture

### Phase 1: Single Process (Now)

```
[1 Bun Process]
  └── company/ (local FS)

Limits: 1 company, 1 machine
Handles: ~50 agent sessions/day, ~10K tasks
Good for: Self-hosted, solo dev shop
```

### Phase 2: Multi-Tenant (Autopilot Cloud)

```
[k8s Cluster]
├── Pod: Company A
│   └── [Bun Process] + [PVC volume]
├── Pod: Company B
│   └── [Bun Process] + [PVC volume]
├── Pod: Company C
│   └── [Bun Process] + [PVC volume]
├── Shared Services:
│   ├── PostgreSQL (auth, billing, metering ONLY)
│   ├── Redis (webhook routing, session lookup)
│   ├── Ingress (questpie.com/api/{company-slug}/...)
│   └── Container Registry
└── Scaling: horizontal (add pods)
```

**Key insight:** Each company is isolated. No shared state between companies.
Scaling = adding pods. Simple k8s horizontal scaling.

**Cost per company:** ~128MB RAM, minimal CPU (mostly I/O wait on Claude API).
One node (4GB RAM) can host ~30 companies.

### Phase 3: Shared FS for Large Companies

For companies that need multiple worker processes (100+ concurrent agents):

```
[Shared Storage: NFS / EFS / Ceph]
  └── company/
      ├── tasks/
      ├── comms/
      └── ...

[Worker Pool]
├── Worker 1: Watcher + Workflow Engine
├── Worker 2: Agent Spawner (agents 1-4)
├── Worker 3: Agent Spawner (agents 5-8)
├── Worker 4: Webhook Server + Scheduler
└── Worker 5: API Server + Dashboard

[Queue: Redis / BullMQ / FS-based]
  └── agent-spawn-queue
  └── notification-queue
  └── index-rebuild-queue
```

**Queue over FS as persistent layer:**
```
company/
  _queue/
    pending/
      spawn-peter-1711111111.yaml    # Agent spawn request
      notify-dominik-1711111222.yaml # Notification request
    processing/
      spawn-ivan-1711111000.yaml     # Being processed
    done/
      spawn-peter-1711110000.yaml    # Completed
```

Workers poll `_queue/pending/`, move to `processing/`, execute, move to `done/`.
Simple, debuggable, no external queue dependency. Works on shared FS.

**Alternatively:** Redis/BullMQ for queue (faster, but adds dependency).
Decision: start with FS-based queue, switch to Redis if needed.

### Phase 4: Optional SQLite Backend

For companies with 100K+ tasks where FS listing is slow:

```typescript
// packages/orchestrator/src/fs/storage.ts

interface StorageBackend {
  readTask(id: string): Promise<Task>
  writeTask(id: string, task: Task): Promise<void>
  listTasks(filter?: TaskFilter): Promise<Task[]>
  watchChanges(callback: (event: ChangeEvent) => void): void
}

class YamlFsBackend implements StorageBackend { ... }   // Current
class SqliteBackend implements StorageBackend { ... }    // Future
```

Same schemas, same API, different storage. Config in company.yaml:
```yaml
settings:
  storage_backend: yaml  # or "sqlite"
```

---

## 4. Technology Stack (Definitive)

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Bun | Fast, native TS, built-in test runner, Bun.serve |
| Language | TypeScript (strict) | Type safety, Zod integration |
| Agent SDK | Claude Agent SDK | Primary AI backend |
| Schemas | Zod | Runtime validation + type inference |
| FS Format | YAML (yaml npm) | Human-readable, git-diffable |
| FS Watch | chokidar v4 | Mature, cross-platform |
| CLI Framework | Commander.js | Production-grade, well-documented |
| Cron | node-cron | Simple, reliable |
| Git | simple-git | Programmatic git operations |
| HTTP Server | Bun.serve | Built-in, fast |
| WebSocket | Bun.serve (ws) | Built-in |
| Formatting | Biome | Fast, replaces ESLint+Prettier |
| Build | Turborepo | Monorepo orchestration |
| Embeddings | text-embedding-3-small | For semantic search indexes |
| Memory Extract | Claude Haiku | Cheap summarization ($0.004/session) |
| Dashboard | React + TanStack Start | Already deployed |
| Container | Docker (Bun-based) | Isolated companies |
| Orchestration | k8s (k3s) | Multi-tenant deployment |
| CI/CD | Woodpecker CI | Existing infra |
| DNS/CDN | Cloudflare | Existing infra |
| TLS | cert-manager + Let's Encrypt | Existing infra |

---

## 5. Package Architecture

```
@questpie/autopilot-spec (published, external)
  │  Zod schemas, types, path conventions
  │  Zero runtime deps except zod + yaml
  │  For plugin/integration authors
  │
@questpie/autopilot-agents (internal)
  │  8 system prompt templates
  │  buildSystemPrompt() assembler
  │  Depends on: spec
  │
@questpie/autopilot-orchestrator (internal)
  │  Core runtime — ALL business logic lives here
  │  FS operations, workflow engine, context assembly,
  │  scheduler, watcher, webhooks, sessions, notifier
  │  Depends on: spec, agents
  │
@questpie/autopilot-cli (internal → published as @questpie/autopilot)
  │  Thin CLI shell — calls orchestrator functions
  │  Commander.js commands
  │  Depends on: orchestrator
  │
@questpie/autopilot-dashboard (future, internal)
     React web UI — calls orchestrator via API
     Thin read/write layer over FS
     Depends on: spec (types only)
```

**Publishing strategy:**
- `@questpie/autopilot` — CLI + orchestrator bundled (what users install)
- `@questpie/autopilot-spec` — types only (for plugin authors)
- Everything else is internal workspace packages

---

## 6. Data Flow

### Intent → Completion

```
Human: "Build a pricing page"
  │
  ▼
CLI: autopilot ask "Build a pricing page"
  │ Creates task in /tasks/backlog/ assigned to CEO
  ▼
Watcher: detects new task file
  │
  ▼
Orchestrator: routes to CEO agent
  │ Context: identity + company state + memory + task
  ▼
CEO Agent Session:
  │ Calls: create_task(scope), create_task(plan), create_task(implement)
  │ Sets dependencies: implement depends_on plan depends_on scope
  │ Assigns scope → ivan (strategist)
  ▼
Watcher: detects task-050 assigned to ivan
  │
  ▼
Orchestrator: spawns ivan with task-050 context
  │
  ▼
Ivan: writes spec → /projects/studio/docs/pricing-spec.md
  │ Calls: update_task(task-050, status: done)
  ▼
Watcher: detects task-050 status change
  │
  ▼
Workflow Engine: scope → plan transition
  │ Assigns task-051 to adam (planner)
  ▼
... (continues through plan → implement → review → merge → deploy)
```

### Session Lifecycle

```
1. Trigger fires (task_assigned / schedule / webhook / mention)
2. Orchestrator checks max_concurrent_agents
3. Context Assembler builds 4-layer prompt:
   a. Identity: agent def + company info + team roster
   b. Company State: role-scoped snapshot (active tasks, messages, pins)
   c. Memory: facts, decisions, patterns, mistakes from memory.yaml
   d. Task Context: task YAML, spec, plan, history, code context
4. Agent Spawner creates Claude Agent SDK session
5. Session streams to JSONL log + WebSocket subscribers
6. Agent calls primitives (write files, send messages, create tasks)
7. Each primitive call → activity log + FS write (through write queue)
8. Session completes (or times out)
9. Memory Extractor (Haiku) summarizes session
10. Extracted facts/decisions merged into memory.yaml
11. Workflow Engine checks transitions, routes next step
```

---

## 7. Write Queue Architecture (Detail)

### Single-Process Model (Current)

```typescript
// In-memory async mutex per file path
class WriteQueue {
  private locks = new Map<string, { queue: Array<() => void> }>()

  async acquire(path: string): Promise<() => void> {
    const normalized = normalize(path)
    if (!this.locks.has(normalized)) {
      this.locks.set(normalized, { queue: [] })
      return () => this.release(normalized)
    }

    // Wait in queue
    return new Promise(resolve => {
      this.locks.get(normalized)!.queue.push(() => {
        resolve(() => this.release(normalized))
      })
    })
  }

  private release(path: string) {
    const lock = this.locks.get(path)
    if (!lock) return
    const next = lock.queue.shift()
    if (next) {
      next() // Wake next waiter
    } else {
      this.locks.delete(path) // No waiters, clean up
    }
  }
}

// Singleton per orchestrator instance
export const writeQueue = new WriteQueue()
```

### Multi-Process Model (Future, Shared FS)

```typescript
// File-based lock using atomic rename
class FsLock {
  async acquire(path: string, timeout = 5000): Promise<() => Promise<void>> {
    const lockPath = path + '.lock'
    const lockId = `${process.pid}-${Date.now()}`
    const deadline = Date.now() + timeout

    while (Date.now() < deadline) {
      try {
        // Atomic: create lock file (fails if exists)
        await writeFile(lockPath, lockId, { flag: 'wx' })
        return async () => {
          // Only release if we own the lock
          const content = await readFile(lockPath, 'utf-8')
          if (content === lockId) await unlink(lockPath)
        }
      } catch {
        // Lock exists, wait and retry
        await Bun.sleep(50)
      }
    }
    throw new Error(`Lock timeout: ${path}`)
  }
}
```

### Queue Engine over FS (Future)

```
company/_queue/
├── config.yaml          # Queue settings
├── pending/             # New jobs
│   ├── 001-spawn-peter.yaml
│   └── 002-notify-human.yaml
├── processing/          # Being executed
│   └── 000-spawn-ivan.yaml
├── done/                # Completed (auto-cleaned)
└── failed/              # Failed (for debugging)
```

Job format:
```yaml
id: "001"
type: spawn_agent
created_at: "2026-03-22T14:30:00Z"
payload:
  agent_id: peter
  task_id: task-040
  trigger: task_assigned
status: pending
retries: 0
max_retries: 3
```

Workers:
1. Poll `pending/` for new jobs (sorted by filename = creation order)
2. Atomic rename to `processing/` (prevents double-pickup)
3. Execute job
4. Move to `done/` or `failed/`

No external queue dependency. Works on any shared filesystem.
Debugging: `ls company/_queue/failed/` to see what went wrong.

---

## 8. API Server Design (for Dashboard + Mobile)

```typescript
// packages/orchestrator/src/api/server.ts

// REST API on port 7778 (or same port as webhook, different path prefix)
// Calls SDK functions directly — thin HTTP layer

GET  /api/company          → loadCompany()
GET  /api/tasks             → listTasks()
GET  /api/tasks/:id         → readTask()
POST /api/tasks/:id/approve → updateTask(id, { status: 'done' })
POST /api/tasks/:id/reject  → updateTask(id, { status: 'blocked' })
GET  /api/agents            → loadAgents() + session statuses
GET  /api/agents/:id        → agent detail + memory stats
GET  /api/pins              → listPins()
GET  /api/activity          → readActivity()
POST /api/ask               → createTask(intent) assigned to CEO
GET  /api/sessions          → streamManager.getActiveStreams()

// WebSocket
WS   /api/ws                → live updates (task changes, agent events, pins)
WS   /api/ws/sessions/:id   → session stream (attach)
```

**Auth (future):** API key in company.yaml, verified per request.
**CORS:** Allow localhost + configured dashboard domain.

---

## 9. Agent SDK Integration (Key Architectural Decision)

### Discovery: Claude Agent SDK Provides Built-in Infrastructure

The `@anthropic-ai/claude-agent-sdk` provides many capabilities we originally planned
to build from scratch. This dramatically simplifies the orchestrator.

### What Agent SDK Handles (DON'T rebuild):

| Capability | Agent SDK Feature | Our Original Plan |
|-----------|------------------|-------------------|
| File read/write/edit | Read, Write, Edit tools | Custom read_file/write_file primitives |
| File search | Glob, Grep tools | Custom search_knowledge |
| Shell execution | Bash tool | Custom run_command primitive |
| FS sandboxing | Permission modes | Custom fs_scope enforcement |
| Subagents | Agent tool + definitions | Custom agent spawner |
| Sessions | Resume, list, fork | Custom session manager |
| MCP integration | Built-in MCP support | N/A |
| Hooks | Pre/PostToolUse, SessionEnd | Custom event system |
| Web search | WebSearch, WebFetch tools | Custom http_request |

### What WE Build (our value-add):

1. **Workflow Engine** — routing between agents based on YAML workflows (SDK has no concept of workflows)
2. **Context Assembly** — 4-layer system prompts via `systemPrompt` option
3. **Memory Extraction** — post-session Haiku summarization via `SessionEnd` hook
4. **Custom Primitives** — send_message, create_task, pin_to_board as MCP tools via `createSdkMcpServer`
5. **Scheduler/Watcher/Webhooks** — trigger infrastructure (SDK doesn't watch FS or handle cron)
6. **CLI** — user interface wrapping SDK's `query()` function
7. **Orchestrator** — composition layer that wires everything together

### Agent Spawning Pattern

```typescript
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

// Our custom primitives exposed as MCP tools
const autopilotTools = createSdkMcpServer({
  name: 'autopilot',
  tools: [
    tool('send_message', 'Send message to agent or channel', {
      to: z.string(), content: z.string(), priority: z.string().optional()
    }, async (args) => {
      await sendChannelMessage(companyRoot, args.to, { ... })
      return { content: [{ type: 'text', text: 'Message sent' }] }
    }),
    tool('create_task', 'Create a new task', {
      title: z.string(), type: z.string(), assigned_to: z.string().optional()
    }, async (args) => {
      const task = await createTask(companyRoot, { ... })
      return { content: [{ type: 'text', text: `Created ${task.id}` }] }
    }),
    tool('pin_to_board', 'Pin item to dashboard', {
      group: z.string(), title: z.string(), type: z.string()
    }, async (args) => {
      await createPin(companyRoot, { ... })
      return { content: [{ type: 'text', text: 'Pinned' }] }
    }),
  ]
})

// Spawn agent using SDK
async function spawnAgent(agent: Agent, task: Task, context: AssembledContext) {
  for await (const message of query({
    prompt: `Work on task: ${task.title}\n\n${task.description}`,
    options: {
      systemPrompt: context.systemPrompt,
      cwd: companyRoot,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      mcpServers: { autopilot: autopilotTools },
      permissionMode: 'acceptEdits',
      maxTurns: 50,
      model: agent.model,
      hooks: {
        PostToolUse: [{ matcher: '.*', hooks: [logToActivityFeed] }],
        SessionEnd: [{ matcher: '.*', hooks: [extractMemoryWithHaiku] }],
      },
    },
  })) {
    // Stream to JSONL log + WebSocket subscribers
    if ('result' in message) {
      streamManager.emit(sessionId, { type: 'text', content: message.result })
    }
  }
}
```

### Implications

- **No custom agent spawner needed** — SDK's `query()` handles the agentic loop
- **No custom file tools needed** — SDK's built-in Read/Write/Edit/Glob/Grep
- **No custom sandboxing** — SDK's `permissionMode` + `allowedTools`
- **Hooks replace our event system** — PostToolUse for activity logging, SessionEnd for memory
- **MCP for custom primitives** — `createSdkMcpServer` + `tool()` for our domain-specific tools
- **Subagents for delegation** — CEO can spawn subagents via SDK's Agent tool

---

## 10. Implementation Status

### Done (Fáza 0-7)
- [x] Monorepo setup (Bun + Turbo + Biome)
- [x] Landing page (live at autopilot.questpie.com)
- [x] README + badges
- [x] @questpie/autopilot-spec — 16 schemas, 139 tests
- [x] Company template (solo-dev-shop) — 30 tests
- [x] Agent prompts — 8 templates, 83 tests
- [x] Orchestrator FS layer — YAML CRUD, tasks, messages, pins, activity
- [x] Workflow engine — state machine, transitions, loader
- [x] Context assembler — 4-layer assembly
- [x] Scheduler — cron-based
- [x] Watcher — chokidar event detection
- [x] Webhook server — HTTP with auth
- [x] Session stream manager — subscribe/emit
- [x] Notifier — activity log integration
- [x] Orchestrator server — composes all modules
- [x] CLI — 8 commands (init, status, ask, tasks, agents, inbox, attach, start)
- [x] Documentation pages (7 doc pages)
- [x] k8s deployment (autopilot.questpie.com)
- [x] 369+ tests passing

### Next Priority
- [ ] **Write Queue** — file-level locking for concurrent agent writes
- [ ] **Agent Spawner** — Claude Agent SDK integration (needs API key)
- [ ] **Memory Extractor** — post-session Haiku summarization
- [ ] **Tool implementations** — all primitives as callable functions
- [ ] **API Server** — REST + WebSocket for dashboard
- [ ] **CLI polish** — interactive prompts, better error handling, colors
- [ ] **`autopilot start`** — fully wired orchestrator lifecycle
- [ ] **Dogfooding** — set up QUESTPIE s.r.o. as first company

### Future
- [ ] Dashboard (React web UI)
- [ ] Shared FS support (NFS/EFS for multi-node)
- [ ] FS-based queue engine
- [ ] SQLite optional backend
- [ ] Linear bidirectional sync
- [ ] Embedding indexes + semantic search
- [ ] WhatsApp/Telegram transport
- [ ] Multi-tenant cloud (k8s, billing, auth)

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | YAML over SQLite | Human-readable, git-diffable, zero deps. Revisit at 100K+ tasks |
| 2026-03-22 | Single process per company | Simplest scaling model. One pod = one company. No shared state |
| 2026-03-22 | SDK-first architecture | CLI, dashboard, API all consume the same SDK. No logic in consumers |
| 2026-03-22 | In-process write queue | File-level async mutex. Sufficient for single-process model |
| 2026-03-22 | TanStack Start for landing | SSR, same stack as QUESTPIE docs, Bun-based |
| 2026-03-22 | Commander.js for CLI | Production-grade, well-documented, widely used |
| 2026-03-22 | chokidar v4 for FS watch | Mature, cross-platform, handles edge cases |
| 2026-03-22 | No external queue (MVP) | FS-based queue later if multi-process needed |
| 2026-03-22 | Subdomain deployment | autopilot.questpie.com (simpler than path prefix) |

---

## 11. Cost Model

### Per-Session Costs (Claude API)
- Agent session (Sonnet): ~$0.03-0.08 per session (varies by complexity)
- Memory extraction (Haiku): ~$0.004 per session
- Context assembly: free (local computation)

### Monthly Estimates (Active Solo Dev)
- 50 sessions/day × 30 days = 1,500 sessions
- Agent cost: 1,500 × $0.05 = **$75/month**
- Memory extraction: 1,500 × $0.004 = **$6/month**
- Total: **~$81/month** in API costs

### Autopilot Cloud Pricing (Future)
- Free tier: 100 sessions/month (community)
- Pro: $49/month + API usage (bring your own key)
- Business: $299/month (managed, included API budget)
- Enterprise: custom
