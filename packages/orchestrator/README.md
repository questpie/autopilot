# @questpie/autopilot-orchestrator

Core runtime for QUESTPIE Autopilot — watches the company filesystem, matches workflows, spawns agents, and routes notifications. This is the engine behind the `autopilot start` command.

> **Not meant to be used standalone.** This package is consumed by the [`@questpie/autopilot`](https://www.npmjs.com/package/@questpie/autopilot) CLI.

## What it does

Monitors a company directory for changes, evaluates workflow trigger conditions, spawns agent sessions, assembles context, and manages the full lifecycle of tasks.

## Key components

| Component | Role |
| --- | --- |
| **Watcher** | Filesystem watcher (chokidar) that detects changes in the company directory |
| **Workflow Engine** | Matches file events and cron triggers to workflow definitions |
| **Agent Spawner** | Launches agent sessions with the appropriate provider and tools |
| **Context Assembler** | Builds agent context from company knowledge, task history, and relevant files |
| **Cron Scheduler** | Runs scheduled workflows via node-cron |
| **Webhook Server** | Receives inbound webhooks to trigger workflows |
| **API Server** | HTTP API for the dashboard and external integrations |
| **Session Stream** | Real-time streaming of agent session output |
| **Git Manager** | Manages git operations for version-controlled company directories |
| **Embedding Service** | Indexes company knowledge for semantic search |

## Database

SQLite via Drizzle ORM, with FTS5 for full-text search and sqlite-vec for vector embeddings. Single file, no external database required.

## Agent providers

- **Claude Agent SDK** — Anthropic's agent protocol (primary)
- **Codex SDK** — OpenAI's agent protocol

## Embedding providers

Pluggable embedding backend with built-in support for:

- **E5** — local transformer model via @huggingface/transformers
- **Gemini** — Google's embedding API
- **Nomic** — Nomic embedding API
- **FTS-only fallback** — keyword search when no embedding provider is configured

## Links

- [GitHub](https://github.com/questpie/autopilot)
- [Documentation](https://autopilot.questpie.com)

## License

MIT
