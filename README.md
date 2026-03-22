<div align="center">

<br />

<img src="https://img.shields.io/badge/QUESTPIE-Autopilot-B700FF?style=for-the-badge&labelColor=000" alt="QUESTPIE Autopilot" />

**AI-Native Company OS**

# QUESTPIE Autopilot

**AI-native company operating system.**
**Define agents. Assign roles. Give intent. They handle the rest.**

[![Coming Soon](https://img.shields.io/badge/status-coming%20soon-B700FF?style=flat-square)](https://autopilot.questpie.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-B700FF?style=flat-square)](LICENSE)
<!-- [![Discord](https://img.shields.io/badge/discord-join-B700FF?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/questpie) -->
[![TypeScript](https://img.shields.io/badge/TypeScript-Bun-B700FF?style=flat-square)](https://bun.sh)

[Website](https://autopilot.questpie.com) · [Docs](https://autopilot.questpie.com/docs) · [Discord](https://discord.gg/questpie) · [GitHub](https://github.com/questpie/autopilot)

</div>

---

## What is this?

A single founder should be able to operate like a 20-person company. Instead of hiring, you define roles. Instead of managing, you give intent. Instead of micromanaging, you approve at gates.

QUESTPIE Autopilot is an AI-native company operating system where every company is an isolated container with a filesystem, agents are employees with persistent identity, and you -- the human -- are the CEO.

```bash
$ autopilot ask "Build a pricing page with Stripe integration"

CEO Agent decomposing intent...

  task-050: Scope requirements      -> sam (strategist)
  task-051: Design UI               -> jordan (designer)
  task-052: Implement with Stripe   -> max (developer)
  task-053: Write copy & announce   -> morgan (marketer)

Sam is starting now. You'll be notified when approvals are needed.

$ autopilot attach max
[14:30:12] max  Reading spec to understand pricing page requirements...
[14:30:15] max  read_file -> pricing-spec.md
[14:30:22] max  Need Stripe checkout. Creating PricingTable component...
[14:30:45] max  write_file -> PricingTable.tsx (142 lines)
[14:31:00] max  -> dev: "PricingTable done. Moving to checkout flow."
[14:31:02] max  pin_to_board -> "Pricing Page: 50%"
```

> Agent names above come from the **Solo Dev Shop** template — one of many starting points. You define your own team, names, roles, and tools in `agents.yaml`.

You give a high-level intent. Your team of AI agents decomposes it, plans it, implements it, reviews it, deploys it, and announces it. You approve at gates.

---

## Quick Start

> Coming soon. QUESTPIE Autopilot is in active development.

```bash
# Install
bunx @questpie/autopilot init my-company

# Navigate
cd my-company

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-xxx

# Start the orchestrator
autopilot start

# Give intent
autopilot ask "Build a landing page for our product"

# Watch an agent work in real-time
autopilot attach max
```

---

## Features

- **Define Your Team** -- Create agents in YAML. Give them names, assign role templates, configure tools and filesystem scope. Start from a template or build from scratch. Add or remove agents anytime via CLI or the CEO agent.

- **Role Templates** -- Strategist, developer, reviewer, planner, devops, marketing, design -- pick from built-in templates or create your own. Each template defines default tools, FS scope, and a system prompt. Multiple agents can share the same role.

- **Per-Agent Memory** -- Every agent has their own persistent memory: facts, decisions, mistakes, learnings. Extracted automatically after each session. Isolated -- no agent reads another's memory.

- **Company as Container** -- Your company is a folder. YAML, Markdown, Git. No database, no proprietary formats. The entire company can be `ls`'d, `cat`'d, `grep`'d, backed up, forked.

- **Filesystem = Database** -- Tasks are YAML files. Communication is Markdown. Knowledge is documents. Git is your version control. Everything is plain text, everything is diffable.

- **Primitives, Not Chat** -- Agents don't chat. They call structured primitives: `send_message()`, `create_task()`, `git_commit()`, `pin_to_board()`. Clean inputs, clean outputs.

- **Workflow Engine** -- YAML-defined processes that move work from intent to deployed feature. Owned by the CEO agent. Evolve based on metrics and team feedback.

- **Session Attach** -- `kubectl logs -f` for your AI team. Watch any agent work in real-time. See their thinking, file reads, file writes, tool calls, messages.

- **Triggers & Events** -- Cron schedules and webhooks defined in YAML. Daily standups, weekly reviews, GitHub push handlers, Linear sync -- all declarative.

- **Human Gates** -- You approve merges, deploys, spending, and publishing. Agents propose, you decide. Full control over everything that matters.

- **Transport System** -- Notification routing to WhatsApp, Telegram, Slack, Email, Discord. Define rules per urgency level.

- **Integrations** -- GitHub (bidirectional sync), Linear (bidirectional sync), any API via MCP connections. Agents use tools, not wrappers.

- **Dashboard** -- Pins, tasks, activity feed, intent input. A command center for your AI company.

---

## Define Your Team

Agents are defined in a single YAML file. Each agent gets a name, a role template, tools, filesystem scope, and their own persistent memory.

```yaml
# /company/team/agents.yaml

agents:
  - id: sam
    name: Sam
    role: strategist            # Role template
    description: "Scopes features, writes specs, analyzes requirements"
    fs_scope:
      read: ["/knowledge", "/projects", "/tasks"]
      write: ["/tasks", "/comms", "/knowledge"]
    tools: [read_file, write_file, send_message, create_task, search_knowledge]

  - id: max
    name: Max
    role: developer
    description: "Writes code, creates branches and PRs"
    fs_scope:
      read: ["/projects", "/tasks", "/knowledge/technical"]
      write: ["/projects", "/tasks", "/comms"]
    tools: [read_file, write_file, git_commit, git_create_pr, send_message]

  # Add as many agents as you need...
  - id: alice
    name: Alice
    role: developer             # Multiple agents can share a role
    description: "Frontend specialist, React and CSS"
    fs_scope:
      read: ["/projects/frontend", "/tasks", "/knowledge/technical"]
      write: ["/projects/frontend", "/tasks", "/comms"]
    tools: [read_file, write_file, git_commit, git_create_pr, send_message]
```

```bash
# Or use the CLI
autopilot agent add --name "Alice" --role developer --desc "Frontend specialist"
autopilot agent remove alice
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HUMAN LAYER                            │
│                                                             │
│  CLI: autopilot ask / inbox / attach / approve              │
│  Dashboard: board, tasks, agents, activity, intent          │
│  External: WhatsApp, Telegram, Slack, Email                 │
└────────────────────────┬────────────────────────────────────┘
                         │ intent / approvals / messages
                         v
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Bun)                        │
│                                                             │
│  FS Watcher        Workflow Engine       Agent Spawner      │
│  Context Assembler Memory Extractor      Cron Scheduler     │
│  Webhook Server    Notification Router   Session Stream     │
│  Sync Engine       ~1500 LOC total                          │
└────────────────────────┬────────────────────────────────────┘
                         │ spawn / assign / notify / stream
                         v
┌─────────────────────────────────────────────────────────────┐
│                     AGENT LAYER                             │
│                                                             │
│  Defined in agents.yaml — any number of agents              │
│  Each = AI session + role template + tools + FS scope       │
│  Per-agent memory, isolated context, structured primitives  │
│                                                             │
│  Role templates: strategist, developer, reviewer, planner,  │
│  devops, marketing, design, meta — or define your own       │
└────────────────────────┬────────────────────────────────────┘
                         │ read / write / tool calls
                         v
┌─────────────────────────────────────────────────────────────┐
│                  COMPANY CONTAINER                          │
│                                                             │
│  /company/                                                  │
│    team/       agents, humans, workflows, schedules         │
│    tasks/      YAML task files by status                    │
│    comms/      channels, direct messages                    │
│    knowledge/  brand, technical, business, legal            │
│    projects/   code, docs, design, marketing assets         │
│    infra/      k8s manifests, monitoring, runbooks          │
│    context/    memory, indexes, snapshots                   │
│    secrets/    encrypted API keys and credentials           │
│    dashboard/  pins and board config                        │
│    logs/       activity, sessions, errors, webhooks         │
│                                                             │
│  Docker container, git-versioned, isolated per company      │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict) |
| AI | [Anthropic Claude](https://anthropic.com) via Agent SDK |
| Frontend | [TanStack Start](https://tanstack.com/start) + Tailwind CSS |
| Build | [Turborepo](https://turbo.build) monorepo |
| Linting | [Biome](https://biomejs.dev) |
| Container | Docker |
| Orchestration | k8s / k3s |

---

## Project Structure

```
questpie-autopilot/
├── apps/
│   └── web/                 TanStack Start landing page + docs
├── packages/
│   ├── spec/                Zod schemas, types, path conventions
│   ├── orchestrator/        Core runtime engine
│   ├── cli/                 CLI commands
│   └── agents/              Agent role templates & prompts
├── templates/               Company templates (solo-dev-shop, etc.)
├── local_specs/             Design documents & specifications
├── turbo.json               Turborepo config
├── biome.json               Linter & formatter
└── package.json             Workspace root
```

---

## Roadmap

- [x] Product specification & design documents
- [x] Branding, packaging & distribution plan
- [x] Landing page (TanStack Start + Tailwind)
- [ ] `@questpie/autopilot-spec` -- Zod schemas & filesystem conventions
- [ ] Orchestrator -- FS watcher, workflow engine, agent spawner
- [ ] Agent system -- role templates, tool definitions, MCP integration
- [ ] CLI -- `autopilot init`, `ask`, `attach`, `inbox`, `approve`
- [ ] Dashboard -- web UI with board, tasks, activity feed
- [ ] Transport system -- WhatsApp, Telegram, Slack, Email routing
- [ ] Linear & GitHub bidirectional sync
- [ ] Scheduled triggers & webhook handlers
- [ ] Per-agent persistent memory system (4 layers)
- [ ] Docker containerization & managed cloud
- [ ] npm publish `@questpie/autopilot`
- [ ] Public launch (Product Hunt, Hacker News)

---

## Contributing

QUESTPIE Autopilot is open source and we welcome contributions. The project is in early development -- if you're interested in building the future of AI-native company operations, we'd love your help.

```bash
# Clone the repo
git clone https://github.com/questpie/autopilot.git
cd autopilot

# Install dependencies
bun install

# Start the dev server (landing page)
bun run dev

# Run linting
bun run lint

# Build everything
bun run build
```

### Guidelines

- TypeScript strict mode, no `any`
- Biome for formatting and linting
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Keep it simple -- pick the simpler option when in doubt

---

## License

MIT License

Copyright (c) 2026 QUESTPIE s.r.o.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

<div align="center">

Built by [QUESTPIE s.r.o.](https://questpie.com)

**Define agents. Assign roles. Give intent. They handle the rest.**

[![GitHub](https://img.shields.io/badge/GitHub-questpie%2Fautopilot-B700FF?style=flat-square&logo=github)](https://github.com/questpie/autopilot)

</div>
