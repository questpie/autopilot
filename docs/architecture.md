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
│  FS Watcher ──── watches tasks/, comms/, team/          │
│  Workflow Engine ── matches task state → next step      │
│  Agent Spawner ──── Claude Agent SDK sessions           │
│  Context Builder ── role-scoped company snapshots       │
│  Memory Extractor ── persists learnings post-session    │
│  Scheduler ──── cron jobs from schedules.yaml           │
│  Webhook Server ── port 7777, HMAC-verified             │
│  API Server ──── port 7778, Hono REST                   │
│  Git Manager ──── auto-commit agent changes             │
│  Stream Manager ── SSE for live session attach          │
└──────────────────────┬──────────────────────────────────┘
                       │ spawn / assign / notify
┌──────────────────────▼──────────────────────────────────┐
│  AGENT LAYER                                            │
│                                                         │
│  8 roles with system prompts + scoped tools             │
│  14 structured primitives (not chat)                    │
│  Sandboxed filesystem access                            │
│  Per-agent persistent memory                            │
└──────────────────────┬──────────────────────────────────┘
                       │ read / write / tool calls
┌──────────────────────▼──────────────────────────────────┐
│  STORAGE                                                │
│                                                         │
│  Filesystem: YAML, Markdown, JSON (company state)       │
│  SQLite: tasks, messages, sessions, auth (sidecar DB)   │
│  FTS5: full-text search over all entities               │
│  sqlite-vec: vector embeddings for semantic search      │
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
   - **Tool list** — available primitives scoped to the agent's role
4. The agent spawner creates a Claude session via Agent SDK
5. The agent executes tool calls (primitives)
6. Post-session: memory extractor (Claude Haiku) persists learnings to `context/memory/{agentId}/memory.yaml`
7. Task moves to next workflow step

## Primitives (Agent Tools)

Agents don't generate text. They call structured primitives:

| Category | Primitives |
|----------|-----------|
| Communication | `send_message`, `ask_agent` |
| Tasks | `create_task`, `update_task`, `add_blocker`, `resolve_blocker` |
| Dashboard | `pin_to_board`, `unpin_from_board` |
| Knowledge | `search_knowledge`, `update_knowledge` |
| Content | `create_artifact`, `skill_request` |
| External | `search`, `http_request` |

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
- Auth (Better Auth tables — users, sessions, tokens)
- Search index (FTS5 virtual tables)
- Embeddings (sqlite-vec virtual tables)
