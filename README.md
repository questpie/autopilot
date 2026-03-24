<div align="center">

# QUESTPIE Autopilot

**AI-native company operating system.**
**Your company is a container. Your employees are agents.**

[![License: MIT](https://img.shields.io/badge/license-MIT-B700FF?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-B700FF?style=flat-square)]()
[![Bun](https://img.shields.io/badge/runtime-Bun-B700FF?style=flat-square)](https://bun.sh)
[![Beta](https://img.shields.io/badge/status-BETA-B700FF?style=flat-square)]()

[Website](https://autopilot.questpie.com) · [Docs](https://autopilot.questpie.com/docs) · [GitHub](https://github.com/questpie/autopilot)

</div>

---

## What is this?

A single founder should be able to operate like a 20-person company. Instead of hiring, you define roles. Instead of managing, you give intent. Instead of micromanaging, you approve at gates.

QUESTPIE Autopilot is a multi-agent AI system where your company is a filesystem backed by SQLite hybrid storage, your employees are AI agents, and work flows through YAML-defined workflows -- from intent to shipped feature.

```bash
$ autopilot ask "Build a pricing page with Stripe integration"

CEO Agent decomposing intent...

  task-050: Scope requirements      → ivan (strategist)
  task-051: Design UI               → designer
  task-052: Implement with Stripe   → peter (developer)
  task-053: Write copy & announce   → marketer

Ivan is starting now. You'll be notified when approvals are needed.
```

---

## How it works

**You give intent.** "Build a pricing page with Stripe integration."

**Agents decompose and execute.** The CEO agent breaks it into scoped tasks. Ivan writes the spec. Adam creates the implementation plan. Peter codes it. Marek reviews it. Ops deploys it. Marketer announces it.

**You approve at gates.** Merge code, deploy to production, publish content -- these require your sign-off. Everything else runs autonomously.

**Everything is files + SQLite.** Tasks are YAML. Communication is Markdown. Knowledge is documents. SQLite provides FTS5 full-text search and sqlite-vec embeddings. The entire company state can be `ls`'d, `grep`'d, backed up, and forked. Git auto-commit tracks every change.

---

## Quick Start

```bash
# Install
bun add -g @questpie/autopilot

# Create your AI company
autopilot init my-company
cd my-company

# Configure your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the orchestrator + dashboard
autopilot start

# Open dashboard
open http://localhost:3001

# Send your first task
autopilot ask "Build me a landing page"

# Watch agents work
autopilot attach max
```

---

## Features

**Hybrid storage** -- YAML/Markdown/JSON files as source of truth, SQLite + Drizzle ORM for indexes, FTS5 full-text search, and sqlite-vec vector embeddings for unified search.

**AI agents with roles** -- 8 built-in role templates (strategist, planner, developer, reviewer, devops, design, marketing, CEO). Define your own agents with custom names, tools, and filesystem scope.

**Multiple agent providers** -- Claude Agent SDK (primary) and Codex SDK. Configure per-agent or company-wide. Provider abstraction makes it easy to add new backends.

**Workflow engine** -- YAML-defined processes that move work from intent to deployment. Human gates for code merges, production deploys, and spending decisions.

**Persistent memory** -- Agents remember facts, decisions, and mistakes across sessions. Memory is private per agent, extracted automatically after every session.

**Unified search** -- FTS5 full-text search + sqlite-vec vector embeddings. Search across tasks, knowledge, channels, and memory with a single query.

**Embedding service** -- Gemini embeddings with local fallback. Automatic indexing of knowledge docs, tasks, and agent memory for semantic search.

**Session attach** -- `autopilot attach max` streams an agent's work in real-time via SSE. Like `kubectl logs -f` for your AI team. Ctrl+C to detach -- agent keeps working.

**Living Dashboard** -- Real-time dashboard on port 3001. Agent activity, task status, board pins, approval gates. Widget runtime with theme overrides.

**Skills as knowledge** -- Agents learn from markdown knowledge docs. Built-in skills for code review, testing, API design, deployment, security, and more. Add your own.

**CLI-first** -- Full lifecycle from the terminal: init, start, ask, status, tasks, agents, inbox, attach, board, channels, knowledge, artifacts, dashboard, auth, git.

**Better Auth** -- Dashboard and API security via Better Auth library.

**SSE realtime** -- Server-Sent Events for session streaming and dashboard updates. No polling.

**Git auto-commit** -- Every filesystem change is automatically committed. Full audit trail of every agent action.

**Transport registry** -- Pluggable notification transports. Telegram adapter built-in, extensible for Slack, email, WhatsApp.

**Language configuration** -- Multi-language support via `language` and `languages` fields in company.yaml. Agents respond in the configured language.

**Provider abstraction** -- Works with Claude API key or Claude Max subscription via the Agent SDK, or OpenAI Codex SDK.

**Artifact serving** -- Agents create previews (React apps, HTML pages) that are served via a lazy cold-start router. Get a live link to what your agent built.

**Integrations without code** -- Any external service (GitHub, Linear, Slack, Stripe) follows the same pattern: add a secret, add a knowledge doc, agent calls the API. No integration modules.

---

## Architecture

```
Human         CLI · Dashboard · WhatsApp · Slack · Email
  ↓
Orchestrator  Watcher · Workflows · Spawner · Context · Memory · Cron · Webhooks · SSE
  ↓
Agents        Claude Agent SDK · Codex SDK · Role Templates · Tools · Sandboxed FS · Memory
  ↓
Storage       SQLite + Drizzle · YAML/Markdown/JSON · FTS5 + sqlite-vec · Git · Better Auth
```

Each company is an isolated folder with a SQLite sidecar. One Bun process watches the filesystem, matches workflows, spawns agents, and routes notifications.

---

## CLI

| Command | What it does |
|---------|-------------|
| `autopilot init <name>` | Create a new company from a template |
| `autopilot start` | Start the orchestrator + dashboard |
| `autopilot ask "<intent>"` | Give a high-level intent to the CEO agent |
| `autopilot status` | Company overview |
| `autopilot tasks` | List, show, approve, or reject tasks |
| `autopilot agents` | List agents and their roles |
| `autopilot inbox` | Items waiting for your approval |
| `autopilot attach <agent>` | Stream an agent's session live (SSE) |
| `autopilot approve <id>` | Approve a task at a human gate |
| `autopilot reject <id>` | Reject a task with feedback |
| `autopilot board` | View dashboard pins from agents |
| `autopilot channels` | List and interact with agent channels |
| `autopilot chat <agent>` | Direct chat with an agent |
| `autopilot knowledge` | Manage the company knowledge base |
| `autopilot artifacts` | List and serve agent-created previews |
| `autopilot dashboard` | Open the Living Dashboard |
| `autopilot auth` | Manage authentication credentials |
| `autopilot git` | Git operations for the company repo |
| `autopilot secrets` | Manage API keys and credentials |

---

## Company structure after init

```
my-company/
├── company.yaml              Settings, budget, owner
├── team/
│   ├── agents.yaml            Agent definitions (8 agents)
│   ├── humans.yaml            Human team members
│   ├── workflows/             development, marketing, incident
│   ├── schedules.yaml         Cron jobs (health checks, standups)
│   └── policies/              Approval gates
├── tasks/                     backlog/ active/ review/ blocked/ done/
├── comms/channels/            Agent communication
├── knowledge/                 Brand, technical, business, skills
├── projects/                  Code, docs, design, marketing
├── context/memory/            Per-agent persistent memory
├── secrets/                   Encrypted API keys
├── dashboard/pins/            Agent status board
└── logs/                      Activity feed, sessions
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and conventions.

```bash
git clone https://github.com/questpie/autopilot.git
cd autopilot && bun install
npx turbo build
npx turbo test
```

---

## License

[MIT](LICENSE) -- QUESTPIE s.r.o. 2026

<div align="center">

Built by [QUESTPIE](https://questpie.com)

</div>
