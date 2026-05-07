# QUESTPIE Autopilot

AI operator for running work through tasks, Knowledge, workers, and external MCP/provider surfaces.

Autopilot's current MVP direction is intentionally narrow:

- Dashboard/Home for daily attention and recent work
- Chat for query and task conversation
- Tasks for durable execution state
- Knowledge for company/project resources and artifacts
- Workers for isolated execution through `spawn-agent`
- MCP/provider adapters for external channels and tools

Developer filesystem access is not a product surface. It is limited to project workspaces for Git-backed runs, where a worker can clone or prepare an isolated workspace, produce diffs/artifacts, and then release the workspace.

## Quick Start

```bash
bun install
bun run --cwd packages/orchestrator dev
bun run --cwd apps/operator-web dev
```

The operator UI opens to the dashboard and keeps the primary navigation to Dashboard, Chat, Tasks, and Knowledge.

For a local worker:

```bash
bun run --cwd packages/cli autopilot worker start --url http://localhost:7778
```

Workers use the `SpawnAgentAdapter` path for Claude Code, Codex, and OpenCode-compatible execution instead of direct runtime adapters.

## Current Architecture

```text
Operator UI
  Dashboard / Chat / Tasks / Knowledge

Orchestrator
  Hono API / tasks / runs / sessions / config / Knowledge / projects

Workers
  spawn-agent runtime / agent-install helpers / isolated Git workspaces

External Surfaces
  MCP server / provider handlers / notification and conversation bridges

Persistence
  SQLite + Drizzle / Knowledge DB records / blob storage / Git diffs for project work
```

## Source Of Truth

- Config and runtime state live in the database.
- Knowledge objects live in DB-backed records with storage for larger content.
- Artifacts are Knowledge-like resources that can be rendered, referenced, and attached.
- Project development uses ephemeral Git workspaces and diffs.
- Workspace inspection is read-only and scoped to project runs.

`.autopilot` authored files are compatibility/bootstrap input. They are imported into the DB config registry and are not the live source of truth for the operator product.

## Knowledge

Knowledge is the user-facing resource surface. It covers company/project documents, task/run artifacts, markdown, images, OpenAPI documents, and renderer-backed previews.

Expected renderer direction:

- Markdown content through markdown rendering
- editable document content through Tiptap
- raw code/diff/YAML/JSON through code-oriented viewers
- OpenAPI through Scalar React references
- images through native image previews

## Workers And Projects

Workers execute runs through `spawn-agent`. Runtime setup and agent-facing capability installation should go through:

- `agent-install` for skills, MCP config, and guide sections
- `spawn-agent` for portable runtime execution

Project work is Git-oriented:

- prepare isolated workspace
- run agent work
- capture diff and artifacts
- expose compare/PR links through Git provider adapters
- release the workspace when the run no longer needs it

The rest of Autopilot is database-backed.

## CLI

Core commands:

```bash
autopilot start
autopilot worker start
autopilot task
autopilot task create --title "..." --type feature
autopilot run
autopilot run show <run-id>
autopilot knowledge list
autopilot agent skill add <skill>
autopilot agent mcp add <name>
autopilot doctor
```

## Development Checks

```bash
bun test
bun run --cwd packages/spec typecheck
bun run --cwd packages/worker typecheck
bun run --cwd packages/orchestrator typecheck
bun run --cwd packages/cli typecheck
bun run --cwd apps/operator-web typecheck
bun run --cwd apps/operator-web build
```

## Documentation

- [Architecture](docs/architecture.md)
- [Source of Truth Map](docs/source-of-truth-map.md)
- [Runtime Setup](docs/guides/runtime-setup.md)
- [Operator UI v2 Spec](docs/internal/operator-ui-v2-spec.md)
- [Config Folder Migration](docs/guides/config-folder-migration.md)

## License

MIT
