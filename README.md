<div align="center">

# QUESTPIE Autopilot

> AI-native company operating system. Your company is a container. Your employees are agents.

[![License: MIT](https://img.shields.io/badge/license-MIT-B700FF?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-B700FF?style=flat-square)]()
[![Bun](https://img.shields.io/badge/runtime-Bun-B700FF?style=flat-square)](https://bun.sh)
[![Beta](https://img.shields.io/badge/status-BETA-B700FF?style=flat-square)]()

</div>

---

## Quick Start

### One-line install (VPS/server)
```bash
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

### Docker
```bash
git clone https://github.com/questpie/autopilot
cd autopilot
cp .env.example .env
docker compose up
```

> **Authentication:**
> Set your OpenRouter API key in `.env` (`OPENROUTER_API_KEY=sk-or-...`)
> or run `autopilot provider set openrouter --api-key <key>`.
> One key gives you access to all models (Anthropic, OpenAI, Google, etc.).

### bunx (local dev)
```bash
bunx @questpie/autopilot init my-company
cd my-company

# Set your OpenRouter API key
autopilot provider set openrouter --api-key sk-or-...

bunx @questpie/autopilot start
```

---

## What Happens

```bash
$ autopilot ask "Build a pricing page with Stripe"

CEO Agent decomposing intent...

  task-050: Scope requirements      → Sam (strategist)
  task-051: Design UI               → Jordan (design)
  task-052: Implement with Stripe   → Max (developer)
  task-053: Write copy & announce   → Morgan (marketing)

Sam is starting now. You'll be notified when approvals are needed.
```

1. You give intent
2. CEO agent decomposes into tasks
3. Agents execute: strategist → planner → developer → reviewer → devops
4. You approve at gates (merge, deploy, spend)
5. Everything is files. Every action is a git commit.

---

## Your Team, Your Rules

Autopilot ships with 8 default agents across 8 roles — meta, strategist, planner, developer, reviewer, devops, marketing, design. Customize them or create your own in `team/agents/*.yaml`.

```yaml
# team/agents/max.yaml
id: max
name: Max
role: developer
description: Implementation, tests, debugging
model: anthropic/claude-sonnet-4
tools: [fs, terminal]
fs_scope:
  read: ["**"]
  write: ["**"]
```

---

## Architecture

```
Human         CLI · Dashboard · Telegram · Webhooks
  │
Orchestrator  Watcher · Workflows · Spawner · Context · Memory · Cron · Durable Streams
  │
Agents        TanStack AI + OpenRouter · Per-Agent Model Picker · 7 Tools · Sandboxed FS · Memory
  │
Storage       SQLite + Drizzle · YAML/MD/JSON · FTS5 + sqlite-vec · Git
```

- **Config is files** — YAML, Markdown, JSON. `ls` your company config.
- **Runtime is SQLite** — tasks, messages, sessions, search. Zero external deps.
- **Git is the audit trail** — every agent action = commit.
- **MCP server** — expose Autopilot to Claude Desktop/Code via tasks, agents, search, sessions.
- **Durable Streams** — persistent session streams with live tailing and replay.
- **Per-agent model picker** — assign different models to different agents via OpenRouter.
- **One Bun process** — orchestrator + API + dashboard. ~100MB RAM.

---

## Self-Hosted

Autopilot is designed to run on YOUR infrastructure. No SaaS lock-in.

| Setup | Command | Cost |
|-------|---------|------|
| Local (macOS/Linux) | `bunx @questpie/autopilot start` | Free (+ API costs) |
| Docker | `docker compose up` | Free (+ API costs) |
| Hetzner VPS | [One-click deploy →](docs/guides/vps-deployment.md) | €4.35/mo + API |
| Any VPS | `curl ... install.sh \| bash` | Your VPS + API |

[→ Full VPS deployment guide](docs/guides/vps-deployment.md)

---

## CLI Reference

```bash
autopilot init <name>        # Create a new company
autopilot start              # Start orchestrator + dashboard
autopilot ask "<intent>"     # Send intent to CEO
autopilot status             # Company overview
autopilot tasks              # List tasks
autopilot agents             # List agents
autopilot attach <agent>     # Watch agent work (live)
autopilot inbox              # Pending approvals
autopilot approve <id>       # Approve action
autopilot reject <id>        # Reject action
autopilot chat <agent>       # Direct chat with agent
autopilot dashboard          # Open web dashboard
autopilot secrets            # Manage API keys
autopilot auth               # Manage authentication
autopilot provider set <p>   # Configure AI provider (openrouter)
```

---

## Company Structure

```
my-company/
├── company.yaml              # Company configuration
├── team/
│   ├── agents/               # AI agent definitions (one file per agent)
│   ├── humans/               # Human team members (one file per human)
│   ├── roles.yaml            # RBAC role definitions
│   ├── schedules/            # Cron-triggered jobs (one file per schedule)
│   ├── webhooks/             # External webhook integrations (one file per webhook)
│   ├── workflows/            # development (12), marketing (7), incident (8)
│   └── policies/             # Human approval requirements
├── knowledge/                # Searchable knowledge base (markdown)
├── skills/                   # Agent skills (agentskills.io, 20 built-in)
├── dashboard/                # Living dashboard (pins, widgets, pages)
├── tasks/                    # Task status directories (runtime)
├── comms/                    # Communication channels (runtime)
├── logs/                     # Activity & session logs (runtime)
├── context/memory/           # Per-agent persistent memory (runtime)
├── secrets/                  # Encrypted secrets (runtime)
├── projects/                 # Project workspaces (runtime)
├── artifacts/                # Generated apps & content (runtime)
└── .data/autopilot.db        # SQLite (tasks, messages, FTS5, embeddings)
```

> **Note:** Tasks, messages, and activity are stored in SQLite (`.data/autopilot.db`), not as YAML files. Runtime directories are created by `autopilot init`, not from the template.

> **Config format:** Legacy monolithic files (`team/agents.yaml`, `team/humans.yaml`, `team/webhooks.yaml`, `team/schedules.yaml`) are no longer supported. Use folder-based config only.

---

## Deploy to Hetzner

Best price/performance for self-hosting. ARM64 servers from €4.35/mo.

```bash
# On your Hetzner VPS (Ubuntu 24.04):
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/autopilot && cd /opt/autopilot
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

[Get €20 free credits →](https://hetzner.cloud/?ref=Akyzglz8k22M)

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Agents & Roles](docs/agents.md)
- [Config Folder Migration](docs/guides/config-folder-migration.md)
- [CLI Reference](docs/cli.md)
- [VPS Deployment](docs/guides/vps-deployment.md)
- [Docker Guide](docs/guides/docker.md)
- [Security & Auth](docs/security.md)

---

## Contributing

```bash
git clone https://github.com/questpie/autopilot.git
cd autopilot && bun install
bunx turbo build
bunx turbo test
```

---

## License

[MIT](LICENSE) — QUESTPIE s.r.o. 2026

<div align="center">

Built by [QUESTPIE](https://questpie.com)

</div>
