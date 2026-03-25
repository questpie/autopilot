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
cp .env.example .env  # Add your ANTHROPIC_API_KEY
docker compose up
```

### npx (local dev)
```bash
npx @questpie/autopilot init my-company
cd my-company
npx @questpie/autopilot start
```

---

## What Happens

```bash
$ autopilot ask "Build a pricing page with Stripe"

CEO Agent decomposing intent...

  task-050: Scope requirements      → Ivan (strategist)
  task-051: Design UI               → Luna (designer)
  task-052: Implement with Stripe   → Peter (developer)
  task-053: Write copy & announce   → Sofia (marketing)

Ivan is starting now. You'll be notified when approvals are needed.
```

1. You give intent
2. CEO agent decomposes into tasks
3. Agents execute: strategist → planner → developer → reviewer → devops
4. You approve at gates (merge, deploy, spend)
5. Everything is files. Every action is a git commit.

---

## Your AI Team

| Agent | Role | Does |
|-------|------|------|
| Sam (CEO) | Orchestrator | Decomposes intent, delegates, unblocks |
| Ivan (Strategist) | Research | Market analysis, competitor research, specs |
| Adam (Planner) | Planning | Task breakdown, architecture, implementation plans |
| Peter (Developer) | Code | Implementation, tests, debugging |
| Marek (Reviewer) | Quality | Code review, security audit |
| Viktor (DevOps) | Infra | Deploy, CI/CD, monitoring |
| Sofia (Marketing) | Growth | Content, SEO, campaigns |
| Luna (Design) | Design | UI/UX, visual design, branding |

---

## Architecture

```
Human         CLI · Dashboard · Telegram · Webhooks
  │
Orchestrator  Watcher · Workflows · Spawner · Context · Memory · Cron · SSE
  │
Agents        Claude Agent SDK · 13 Primitives · Sandboxed FS · Memory
  │
Storage       SQLite + Drizzle · YAML/MD/JSON · FTS5 + sqlite-vec · Git
```

- **Everything is files** — YAML, Markdown, JSON. `ls` your company.
- **Git is the audit trail** — every agent action = commit.
- **SQLite sidecar** — tasks, messages, sessions, search. Zero external deps.
- **One Bun process** — orchestrator + API + dashboard. ~100MB RAM.

---

## Self-Hosted

Autopilot is designed to run on YOUR infrastructure. No SaaS lock-in.

| Setup | Command | Cost |
|-------|---------|------|
| Local (macOS/Linux) | `npx @questpie/autopilot start` | Free (+ API costs) |
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
```

---

## Company Structure

```
my-company/
├── company.yaml              Settings, budget, owner
├── team/
│   ├── agents.yaml           Agent definitions
│   ├── humans.yaml           Human team members
│   ├── workflows/            development, marketing, incident
│   └── schedules.yaml        Cron jobs
├── tasks/                    backlog/ active/ review/ blocked/ done/
├── comms/channels/           Agent communication
├── knowledge/                Brand, technical, business docs
├── projects/                 Code, docs, design, marketing
├── context/memory/           Per-agent persistent memory
├── secrets/                  Encrypted API keys
├── dashboard/pins/           Agent status board
└── .data/autopilot.db        SQLite (FTS5, embeddings, auth)
```

---

## Deploy to Hetzner

Best price/performance for self-hosting. ARM64 servers from €4.35/mo.

```bash
# On your Hetzner VPS (Ubuntu 24.04):
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/autopilot && cd /opt/autopilot
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

[Get €20 free credits →](https://hetzner.cloud/?ref=XXXXXX)

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
