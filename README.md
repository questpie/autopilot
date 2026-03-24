<div align="center">

# QUESTPIE Autopilot

**Agents that act, not chat.**

A filesystem-native operating system where AI agents run your company through structured primitives, human approval gates, and a self-evolving dashboard.

[![License: MIT](https://img.shields.io/badge/license-MIT-B700FF?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-B700FF?style=flat-square)]()
[![Bun](https://img.shields.io/badge/runtime-Bun-B700FF?style=flat-square)](https://bun.sh)
[![Beta](https://img.shields.io/badge/status-BETA-B700FF?style=flat-square)]()

[Website](https://autopilot.questpie.com) · [Docs](https://autopilot.questpie.com/docs) · [GitHub](https://github.com/questpie/autopilot)

</div>

---

## What is this?

Autopilot agents don't generate text for you to read. They call **13 structured primitives** that create tasks, write code, deploy services, and build dashboards. You approve the results at explicit human gates.

Your company is a filesystem. Your employees are agents defined in YAML. Work flows through YAML-defined workflows -- from intent to shipped feature. The entire state lives in files you can `ls`, `grep`, back up with `cp`, and fork with `git clone`.

```bash
$ autopilot ask "Build a pricing page with Stripe integration"

CEO Agent decomposing intent...

  task-050: Scope requirements      -> sam (strategist)
  task-051: Design UI               -> jordan (designer)
  task-052: Implement with Stripe   -> max (developer)
  task-053: Write copy & announce   -> morgan (marketing)

Sam is starting now. You'll be notified when approvals are needed.
```

---

## Why Autopilot is different

**Primitives, not chat.** Agents call typed function calls with clear targets and effects -- not text responses for you to copy-paste. Agent thinking is private. Only primitive calls produce visible, auditable effects.

**Living dashboard.** A React app in the company filesystem that agents edit in real time. Custom widgets, custom pages, theme overrides. Changes appear in seconds via HMR. Your agents build your internal tools.

**Zero infrastructure.** One Bun process. One SQLite file. No Docker, no Postgres, no Redis. Vector search and full-text search are embedded in SQLite via sqlite-vec and FTS5. No external services required.

**Human gates.** Explicit approval points for merge, deploy, spend, and publish -- defined in workflow YAML. Hardcoded deny patterns prevent agents from touching auth files. Every agent action is a git commit.

**Session attach.** `autopilot attach max` streams the live session -- like `kubectl logs -f` for AI agents. Watch tool calls in real time. Ctrl+C to detach; the agent keeps working.

**Filesystem-native.** Everything is files. YAML for config. Markdown for knowledge. SQLite for speed. Git auto-commit for versioning. Back up your company with `cp`. Fork it with `git clone`.

---

## Quick Start

```bash
# Install
bun add -g @questpie/autopilot

# Create your AI company
autopilot init my-company
cd my-company

# Configure (API key or Claude Max subscription)
export ANTHROPIC_API_KEY=sk-ant-...  # or OPENAI_API_KEY=sk-...

# Start the orchestrator + dashboard
autopilot start

# Open dashboard
open http://localhost:3001

# Send your first task
autopilot ask "Build me a landing page"

# Watch agents work in real-time
autopilot attach max
```

**What you need:** Bun 1.3.0+ and either an API key (Anthropic or OpenAI) or a Claude Max subscription.

---

## Architecture

```
Human         CLI · Dashboard · Telegram · Webhooks
  |
Orchestrator  Watcher · Workflows · Spawner · Context · Memory · Cron · Webhooks · SSE
  |
Agents        Claude Agent SDK · Codex SDK · 13 Primitives · Sandboxed FS · Memory
  |
Storage       SQLite + Drizzle · YAML/Markdown/JSON · FTS5 + sqlite-vec · Git · Better Auth
```

Each company is a directory with a SQLite sidecar (`.data/autopilot.db`). One Bun process watches the filesystem, matches workflows, spawns agents, and routes notifications. The dashboard runs as a separate Vite dev server on port 3001.

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
| `autopilot attach <agent>` | Stream an agent's session live |
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

## Company structure

```
my-company/
├── company.yaml              Settings, budget, owner
├── team/
│   ├── agents.yaml            Agent definitions
│   ├── humans.yaml            Human team members
│   ├── workflows/             development, marketing, incident
│   ├── schedules.yaml         Cron jobs
│   └── policies/              Approval gates, deny patterns
├── tasks/                     backlog/ active/ review/ blocked/ done/
├── comms/channels/            Agent communication
├── knowledge/                 Brand, technical, business
├── skills/                    Agent Skills (SKILL.md standard)
├── projects/                  Code, docs, design, marketing
├── context/memory/            Per-agent persistent memory
├── secrets/                   Encrypted API keys
├── dashboard/
│   ├── pins/                  Agent status board
│   ├── widgets/               Custom dashboard widgets
│   ├── pages/                 Custom dashboard pages
│   └── overrides/             Theme, layout overrides
├── logs/                      Activity feed, sessions
└── .data/autopilot.db         SQLite (FTS5, embeddings, auth)
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and conventions.

```bash
git clone https://github.com/questpie/autopilot.git
cd autopilot && bun install
bunx turbo build
bunx turbo test
```

---

## License

[MIT](LICENSE) -- QUESTPIE s.r.o. 2026

<div align="center">

Built by [QUESTPIE](https://questpie.com)

</div>
