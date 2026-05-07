# Architecture

## Current MVP Direction

Autopilot is a DB-backed operator system for tasks, Knowledge, workers, MCP tools, and multi-agent orchestration. The filesystem is not the product database. It is used for import/export packs, local compatibility materialization, fixtures, and ephemeral Git workspaces created for project execution runs.

```
┌─────────────────────────────────────────────────────────┐
│  OPERATOR SURFACES                                      │
│  Dashboard · Chat · Tasks · Knowledge · CLI · MCP        │
└──────────────────────┬──────────────────────────────────┘
                       │ intent / approvals / messages
┌──────────────────────▼──────────────────────────────────┐
│  ORCHESTRATOR                                           │
│  Hono API · task/query/session services · Knowledge API  │
│  config registry · scheduler · run orchestration         │
└──────────────────────┬──────────────────────────────────┘
                       │ claim / stream / inspect
┌──────────────────────▼──────────────────────────────────┐
│  WORKERS                                                │
│  spawn-agent runtime adapter · MCP server attachment     │
│  isolated Git workspaces · read-only workspace inspect   │
└──────────────────────┬──────────────────────────────────┘
                       │ durable state / blobs / git diffs
┌──────────────────────▼──────────────────────────────────┐
│  STORAGE                                                │
│  SQLite control/config state · Knowledge records/blobs   │
│  artifact storage · Git provider links for project runs  │
└─────────────────────────────────────────────────────────┘
```

## Planes

### Database Control Plane

SQLite stores the durable state the product queries and enforces:

- tasks, queries, runs, run events, sessions, and messages
- users, auth, preferences, and project registrations
- DB-backed config records for agents, teams, workflows, providers, skills, scripts, and context settings
- Knowledge document metadata and searchable resource records

### Knowledge Plane

Knowledge is the product resource model. It is not a generic filesystem explorer.

- Markdown and text resources render through rich read views.
- OpenAPI resources render through the Scalar React reference.
- Images and binary resources are resource objects backed by storage.
- Future renderer plugins attach to resource MIME/type/config, not to a primary Files product area.

### Worker Execution Plane

Workers execute project work in isolated Git workspaces:

- the worker prepares an ephemeral worktree for a run
- `spawn-agent` connects to Claude Code, Codex, or OpenCode through ACP/native adapters
- Autopilot MCP tools are attached to the session
- the orchestrator receives run events, artifacts, summaries, and workspace inspection data
- project review is git diff/provider oriented, with GitHub first and adapter seams for GitLab later

The worker API is read-only. It exposes runtime status, workspace tree/read inspection, and git diffs for active runs. It does not become a second orchestrator or a company filesystem browser.

### Filesystem Compatibility Plane

The filesystem remains useful for:

- project source checkout and ephemeral Git run workspaces
- import/export packs and versionable distribution
- local bootstrap and runtime compatibility output such as `AGENTS.md`, native skill folders, or MCP launcher materialization
- test fixtures and development-only snapshots

Durable product intent belongs in the database/config registry. Local files generated for agents are materialized output, not the source of truth.

## Runtime Model

The worker runtime adapter is `SpawnAgentAdapter`.

Supported runtime IDs remain `claude-code`, `codex`, and `opencode`, but they are connected through `spawn-agent` instead of separate direct adapters. Local agent setup should use `agent-install` where possible so agents receive native skills, MCP config, and workspace instructions in the format their runtime expects.

## Operator UI

Primary product modes:

- Dashboard/Home
- Chat
- Tasks
- Knowledge

Secondary/admin surfaces such as workflows, schedules, integrations, runtime, agents, and project inspection should remain scoped and contextual. They should not become new primary top-level modes for the MVP.
