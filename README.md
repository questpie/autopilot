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

> **Authentication** (choose one per provider):
> - **Subscription login** (recommended): `autopilot provider login claude` / `autopilot provider login codex`
>   Works on VPS too — prints a link to open on any device (phone/laptop).
> - **API key** (alternative): set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in `.env`

### bunx (local dev)
```bash
bunx @questpie/autopilot init my-company
cd my-company

# Authenticate (choose one)
autopilot provider login claude    # Use Claude subscription (recommended)
# OR
export ANTHROPIC_API_KEY=sk-ant-...  # Use API key

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

Autopilot ships with 8 default agents across 8 roles — meta, strategist, planner, developer, reviewer, devops, marketing, design. Customize them or create your own in `team/agents.yaml`.

```yaml
# team/agents.yaml
agents:
  - name: CEO
    role: meta
    description: Decomposes intent, delegates, unblocks

  - name: Max
    role: developer
    description: Implementation, tests, debugging

  # Add your own roles, rename agents, change responsibilities
```

---

## Architecture

```
Human         CLI · Dashboard · Telegram · Webhooks
  │
Orchestrator  Watcher · Workflows · Spawner · Context · Memory · Cron · SSE
  │
Agents        Claude Agent SDK · 14 Primitives · Sandboxed FS · Memory
  │
Storage       SQLite + Drizzle · YAML/MD/JSON · FTS5 + sqlite-vec · Git
```

- **Config is files** — YAML, Markdown, JSON. `ls` your company config.
- **Runtime is SQLite** — tasks, messages, sessions, search. Zero external deps.
- **Git is the audit trail** — every agent action = commit.
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
autopilot provider login <p> # Authenticate with subscription (claude/codex)
```

---

## Company Structure

```
my-company/
├── company.yaml              # Company configuration
├── team/
│   ├── agents.yaml           # AI agent definitions (8 default agents)
│   ├── humans.yaml           # Human team members
│   ├── roles.yaml            # RBAC role definitions
│   ├── schedules.yaml        # Cron-triggered agent jobs
│   ├── webhooks.yaml         # External webhook integrations
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
