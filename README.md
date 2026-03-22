<div align="center">

# QUESTPIE Autopilot

**AI-native company operating system.**
**Your company is a container. Your employees are agents.**

[![License: MIT](https://img.shields.io/badge/license-MIT-B700FF?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-B700FF?style=flat-square)]()
[![Bun](https://img.shields.io/badge/runtime-Bun-B700FF?style=flat-square)](https://bun.sh)

[Website](https://autopilot.questpie.com) · [Docs](https://autopilot.questpie.com/docs) · [GitHub](https://github.com/questpie/autopilot)

</div>

---

## What is this?

A single founder should be able to operate like a 20-person company. Instead of hiring, you define roles. Instead of managing, you give intent. Instead of micromanaging, you approve at gates.

QUESTPIE Autopilot is a multi-agent AI system where your company is a filesystem, your employees are AI agents, and work flows through YAML-defined workflows — from intent to shipped feature.

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

**You approve at gates.** Merge code, deploy to production, publish content — these require your sign-off. Everything else runs autonomously.

**Everything is files.** Tasks are YAML. Communication is Markdown. Knowledge is documents. The entire company state can be `ls`'d, `grep`'d, backed up, and forked. No database, no proprietary formats.

---

## Quick Start

```bash
bunx @questpie/autopilot init my-company
cd my-company
export ANTHROPIC_API_KEY=sk-ant-xxx
autopilot start
autopilot ask "Build a landing page for our product"
autopilot attach peter  # watch Peter code in real-time
```

---

## Features

**Filesystem as database** — Tasks, communication, knowledge, agent memory — everything is plain text files. Git-versioned. Human-readable.

**AI agents with roles** — 8 built-in role templates (strategist, planner, developer, reviewer, devops, design, marketing, CEO). Define your own agents with custom names, tools, and filesystem scope.

**Workflow engine** — YAML-defined processes that move work from intent to deployment. Human gates for code merges, production deploys, and spending decisions.

**Persistent memory** — Agents remember facts, decisions, and mistakes across sessions. Memory is private per agent, extracted automatically after every session.

**Session attach** — `autopilot attach peter` streams an agent's work in real-time. Like `kubectl logs -f` for your AI team. Ctrl+C to detach — agent keeps working.

**Skills as knowledge** — Agents learn from markdown knowledge docs. Built-in skills for code review, testing, API design, deployment, security, and more. Add your own.

**CLI-first** — Full lifecycle from the terminal: init, start, ask, status, tasks, agents, inbox, attach, secrets, knowledge, board.

**Integrations without code** — Any external service (GitHub, Linear, Slack, Stripe) follows the same pattern: add a secret, add a knowledge doc, agent calls the API. No integration modules.

**Artifact serving** — Agents create previews (React apps, HTML pages) that are served via a lazy cold-start router. Get a live link to what your agent built.

**Provider abstraction** — Works with Claude API key or Claude Max subscription via the Agent SDK.

---

## Architecture

```
Human         CLI · Dashboard · WhatsApp · Slack · Email
  ↓
Orchestrator  Watcher · Workflows · Spawner · Context · Memory · Cron · Webhooks
  ↓
Agents        Claude Agent SDK · Role Templates · Tools · Sandboxed FS · Memory
  ↓
Container     Filesystem · YAML/Markdown/JSON · Git · Secrets
```

Each company is an isolated folder. One Bun process watches the filesystem, matches workflows, spawns agents, and routes notifications.

---

## CLI

| Command | What it does |
|---------|-------------|
| `autopilot init <name>` | Create a new company from a template |
| `autopilot start` | Start the orchestrator |
| `autopilot ask "<intent>"` | Give a high-level intent to the CEO agent |
| `autopilot status` | Company overview |
| `autopilot tasks` | List, show, approve, or reject tasks |
| `autopilot agents` | List agents and their roles |
| `autopilot inbox` | Items waiting for your approval |
| `autopilot attach <agent>` | Stream an agent's session live |
| `autopilot secrets` | Manage API keys and credentials |
| `autopilot knowledge` | Manage the company knowledge base |
| `autopilot board` | View dashboard pins from agents |

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

[MIT](LICENSE) — QUESTPIE s.r.o. 2026

<div align="center">

Built by [QUESTPIE](https://questpie.com)

</div>
