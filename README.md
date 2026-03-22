<div align="center">

# QUESTPIE Autopilot

**AI-native company operating system**

[![License: MIT](https://img.shields.io/badge/license-MIT-B700FF?style=flat-square)](LICENSE)
[![Tests: 504 passing](https://img.shields.io/badge/tests-504%20passing-B700FF?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-B700FF?style=flat-square)]()
[![Bun](https://img.shields.io/badge/runtime-Bun-B700FF?style=flat-square)](https://bun.sh)

[Website](https://autopilot.questpie.com) · [Docs](https://autopilot.questpie.com/docs) · [GitHub](https://github.com/questpie/autopilot)

</div>

---

## What is this?

QUESTPIE Autopilot lets a single founder operate like a 20-person company. You define AI agents with names, roles, and tools. You give a high-level intent. They decompose it, plan it, implement it, review it, and ship it -- while you approve at gates.

```bash
$ autopilot ask "Build a pricing page with Stripe integration"

CEO Agent decomposing intent...

  task-050: Scope requirements      -> ivan (strategist)
  task-051: Design UI               -> designer
  task-052: Implement with Stripe   -> peter (developer)
  task-053: Write copy & announce   -> marketer
```

---

## Quick Start

```bash
bunx @questpie/autopilot init my-company
cd my-company
export ANTHROPIC_API_KEY=sk-ant-xxx
autopilot start
autopilot ask "Build a landing page"
autopilot attach peter
```

---

## Features

- **Filesystem as database** -- Tasks are YAML, communication is Markdown, knowledge is documents. Everything is plain text, diffable, and git-versioned.
- **8 AI agent roles** -- CEO, strategist, planner, developer, reviewer, devops, marketing, design. Define your own or use built-in templates.
- **Workflow engine** -- YAML-defined state machines that move work from intent to shipped feature with human approval gates.
- **Persistent memory** -- Every agent accumulates facts, decisions, and learnings across sessions. Isolated per agent, extracted automatically.
- **Session attach** -- `autopilot attach peter` streams an agent's work in real time. Like `kubectl logs -f` for your AI team.
- **13 agent tools** -- send_message, create_task, update_task, add_blocker, resolve_blocker, pin_to_board, unpin_from_board, search_knowledge, update_knowledge, http_request, ask_agent, create_artifact, skill_request.
- **10 built-in skills** -- Project scoping, code review, testing strategy, API design, deployment, security checklist, incident response, release notes, document creation, git workflow.
- **CLI-first** -- 11 commands covering the full lifecycle: init, start, ask, status, tasks, agents, inbox, attach, board, knowledge, secrets.
- **Provider abstraction** -- Claude Agent SDK with support for multiple model tiers (Sonnet for agents, Haiku for memory extraction).
- **Artifact serving** -- Agents create artifacts (HTML pages, apps) that are served instantly via a lazy cold-start router.

---

## Architecture

```
Human Layer    CLI · Dashboard · API
     |
Orchestrator   Watcher · Workflows · Spawner · Memory
     |
Agent Layer    Claude Agent SDK · 8 Roles · 13 Tools
     |
Container      Filesystem · YAML · Git · Secrets
```

Each company is an isolated folder. No database, no proprietary formats. The entire state can be `ls`'d, `cat`'d, `grep`'d, backed up, and forked.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `init <name>` | Scaffold a new company from a template |
| `start` | Start the orchestrator (watcher, workflows, scheduler) |
| `ask <intent>` | Give a high-level intent to the CEO agent |
| `status` | Show company overview with task counts |
| `tasks [list\|show\|approve\|reject]` | Manage tasks |
| `agents [list\|show]` | View agents and their roles |
| `inbox` | Show items pending human approval |
| `attach <agent>` | Stream an agent's session in real time |
| `board` | Manage dashboard pins |
| `knowledge` | Manage the company knowledge base |
| `secrets` | Manage encrypted API keys and credentials |

---

## Project Structure

```
questpie-autopilot/
  apps/
    web/                  Landing page (TanStack Start + Tailwind)
  packages/
    spec/                 Zod schemas, types, path conventions
    orchestrator/         Core engine (watcher, workflows, spawner, memory)
    agents/               Role templates, system prompts
    cli/                  CLI commands (Commander.js)
  templates/
    solo-dev-shop/        Default company template (8 agents, 3 workflows)
  turbo.json              Turborepo config
  biome.json              Linter & formatter
```

---

## Roadmap

- [x] Phase 0 -- Monorepo setup (Bun + Turbo + Biome)
- [x] Phase 1 -- Landing page and documentation site
- [x] Phase 2 -- README and branding
- [x] Phase 3 -- Spec package (16 Zod schemas, 139 tests)
- [x] Phase 4 -- Company template (8 agents, 3 workflows, 30 tests)
- [x] Phase 5 -- Agent prompts (8 roles, 83 tests)
- [x] Phase 6 -- Orchestrator (watcher, workflows, spawner, memory, tools, 252 tests)
- [x] Phase 7 -- CLI (11 commands, 30 tests)
- [ ] Phase 8 -- Dogfooding (run QUESTPIE internally)
- [ ] Phase 9 -- Polish (email/WhatsApp transports, dashboard UI, cost tracking)
- [ ] Phase 10 -- Public launch (npm publish, Product Hunt, Hacker News)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code conventions, and development workflow.

```bash
git clone https://github.com/questpie/autopilot.git
cd autopilot
bun install
npx turbo test    # 504 tests
npx turbo build
```

---

## License

[MIT](LICENSE) -- Copyright (c) 2026 QUESTPIE s.r.o.

<div align="center">

Built by [QUESTPIE s.r.o.](https://questpie.com)

</div>
