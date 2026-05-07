# @questpie/autopilot-orchestrator

Core runtime for QUESTPIE Autopilot. The orchestrator owns API routes, DB-backed config/state, Knowledge, task/query/session services, run orchestration, and worker coordination.

> This package is consumed by the `@questpie/autopilot` CLI and is not intended as a standalone application package.

## Current Responsibilities

| Component | Role |
| --- | --- |
| API server | Hono HTTP API for operator-web, CLI, MCP, and integrations |
| Task/query/session services | Durable operator workflow state in SQLite |
| Knowledge service | DB/storage-backed resource model for docs, images, OpenAPI specs, and artifacts |
| Config registry | DB-backed agents, workflows, providers, skills, scripts, teams, and scoped overrides |
| Run orchestration | Creates runs, assigns workers, stores events, and completes queries/tasks |
| Worker registry | Resolves worker callback connections for local workspace inspection |
| Workspace inspection | Read-only run/path inspection over worker Git workspaces |
| Git provider adapters | Build compare and change-request links for project run diffs |

## Storage Boundary

SQLite is the durable control/config plane. Knowledge records and artifacts are product resources. Filesystem output is limited to local compatibility materialization, import/export packs, fixtures, and ephemeral Git execution workspaces.

The orchestrator must not treat company Knowledge or config as a generic filesystem explorer.

## Runtime Boundary

Agent execution happens on workers. Workers use `spawn-agent` to connect Claude Code, Codex, or OpenCode and attach Autopilot MCP tools. The orchestrator should not contain direct runtime adapters.

## Links

- [Architecture](../../docs/architecture.md)
- [Documentation](https://autopilot.questpie.com)

## License

MIT
