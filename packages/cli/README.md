# @questpie/autopilot

CLI for running QUESTPIE Autopilot locally, connecting workers, managing tasks and Knowledge, and materializing local agent compatibility files.

Autopilot's durable product state lives in the orchestrator database and storage. The filesystem is used for import/export packs, generated runtime compatibility files, fixtures, and ephemeral Git workspaces for project runs.

## Install

```bash
bun add -g @questpie/autopilot
```

## Quick Start

```bash
autopilot bootstrap
autopilot start
autopilot query "Summarize the current project state"
```

`autopilot start` launches the orchestrator and a local worker. Workers execute through `spawn-agent` and attach Autopilot MCP tools to Claude Code, Codex, or OpenCode sessions.

## Core Commands

| Command | Description |
| --- | --- |
| `autopilot start` | Start orchestrator + local worker for development |
| `autopilot server start` | Start only the orchestrator API |
| `autopilot worker start` | Start/connect a worker |
| `autopilot query` | Run a taskless operator query |
| `autopilot tasks` | List and manage tasks |
| `autopilot runs` | Inspect run state and artifacts |
| `autopilot knowledge` | Import/search/manage Knowledge resources |
| `autopilot agent skill add` | Install SKILL.md packages through `agent-install` |
| `autopilot agent mcp add` | Materialize MCP server config through `agent-install` |
| `autopilot agent guide set-section` | Upsert AGENTS.md guidance through `agent-install` |
| `autopilot sync` | Materialize local compatibility files and packs |
| `autopilot doctor` | Check local setup, worker runtimes, and API health |

## Links

- [Architecture](../../docs/architecture.md)
- [Documentation](https://autopilot.questpie.com)

## License

MIT
