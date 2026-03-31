# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────┐
│  HUMAN LAYER                                            │
│  CLI · Dashboard · Telegram · Webhooks · WhatsApp       │
└──────────────────────┬──────────────────────────────────┘
                       │ intent / approvals / messages
┌──────────────────────▼──────────────────────────────────┐
│  ORCHESTRATOR (single Bun process)                      │
│                                                         │
│  FS Watcher ──── watches team/, knowledge/, dashboard/  │
│  Workflow Engine ── compiles + evaluates workflow steps  │
│  Agent Spawner ──── Claude Agent SDK sessions           │
│  Context Builder ── role-scoped company snapshots       │
│  Memory Extractor ── persists learnings post-session    │
│  Scheduler ──── cron jobs from team/schedules/*.yaml    │
│  Webhook Routes ── /webhooks/*, HMAC-verified           │
│  API Server ──── port 7778, Hono REST                   │
│  Git Manager ──── auto-commit agent changes             │
│  Stream Manager ── SSE for live session attach          │
│  Workflow Store ── workflow_runs + step_runs in SQLite  │
└──────────────────────┬──────────────────────────────────┘
                       │ spawn / assign / notify
┌──────────────────────▼──────────────────────────────────┐
│  AGENT LAYER                                            │
│                                                         │
│  8 roles with system prompts + scoped tools             │
│  7 unified tools (not chat)                             │
│  Sandboxed filesystem access                            │
│  Per-agent persistent memory                            │
└──────────────────────┬──────────────────────────────────┘
                       │ read / write / tool calls
┌──────────────────────▼──────────────────────────────────┐
│  STORAGE                                                │
│                                                         │
│  Filesystem: YAML, Markdown, JSON (authored state)      │
│  SQLite: tasks, messages, sessions, workflow runtime    │
│  FTS5: full-text search over all entities               │
│  sqlite-vec: vector embeddings for semantic search      │
│  Durable Streams: append-only replay timelines          │
│  Git: auto-commit for audit trail                       │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Bun 1.3+ |
| Language | TypeScript (strict) |
| Agent SDK | Anthropic Claude Agent SDK |
| HTTP Framework | Hono |
| Database | SQLite via bun:sqlite + Drizzle ORM |
| Search | FTS5 (full-text) + sqlite-vec (vector) |
| Auth | Better Auth |
| FS Watch | chokidar |
| CLI | Commander.js |
| Dashboard | React 19 + TanStack Start + Tailwind |
| Build | Turbo monorepo |

## How Agent Spawning Works

1. A task is created in SQLite (from CLI, webhook, or another agent)
2. The workflow engine matches the task to a workflow step
3. The context builder assembles a prompt with 6 layers:
   - **Identity** (~2K tokens) — role, tools, team info
   - **Company state** (~3-5K tokens) — role-scoped snapshot
   - **Agent memory** (~15-20K tokens) — persistent facts, decisions, patterns
   - **Task context** (~8-15K tokens) — task details, specs, history
   - **Skills discovery** — available skills from `skills/` directory
   - **Tool list** — available unified tools scoped to the agent's role
4. The agent spawner creates a Claude session via Agent SDK
5. The agent executes unified tool calls
6. Post-session: memory extractor (Claude Haiku) persists learnings to `context/memory/{agentId}/memory.yaml`
7. The orchestrator persists workflow runtime state and moves the task to the next workflow step when validation allows it

## Workflow Execution Model

Autopilot now treats workflows as a first-class runtime primitive:

1. Workflow definitions live in `team/workflows/*.yaml`
2. The orchestrator compiles them into normalized step contracts
3. The workflow engine evaluates the current step and recommended action
4. SQLite persists execution in:
   - `workflow_runs` — one durable run per task/workflow
   - `step_runs` — per-step attempts, executor info, validation mode, child workflow linkage
5. Durable Streams appends timeline events for replay/debugging

This matters because the app, not the agent, owns workflow state.

## Storage Planes

### Filesystem = authored plane

Use the filesystem for human-editable source material:

- config
- workflow definitions
- role prompts
- skills
- knowledge
- artifacts and project files

### SQLite = control plane

Use SQLite for anything the app must query, resume, dedupe, or enforce:

- tasks
- messages
- activity
- agent sessions
- workflow runs
- step runs
- auth
- search indexes

### Durable Streams = timeline plane

Use Durable Streams for live tailing and replay. It is a timeline layer, not the source of truth for workflow control state.

## Unified Tools

Agents don't generate text. They call 7 unified tools:

| Category | Tools |
|----------|-------|
| Workflow | `task` |
| Collaboration | `message`, `pin` |
| Internal Search | `search` |
| External APIs | `http` |
| Web Discovery | `search_web`, `browse` |

## Git Auto-Commit

Every agent file operation is automatically committed:
- Agent writes file → GitManager stages + commits
- Commit message includes agent name, task ID, action
- Full audit trail in git log
- Human approval gates before merge to main

## SQLite Schema

The sidecar database (`.data/autopilot.db`) stores:
- Tasks (indexed, searchable)
- Messages (channels + direct)
- Sessions (agent session logs)
- Workflow runs and step runs (durable execution state)
- Auth (Better Auth tables — users, sessions, tokens)
- Search index (FTS5 virtual tables)
- Embeddings (sqlite-vec virtual tables)
