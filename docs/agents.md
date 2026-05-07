# Agents And Workers

Agents are DB-backed config records. Workers execute runs for those agents through `spawn-agent` and Autopilot MCP tools.

## Product Boundary

Agent/team/workflow/capability intent belongs in the config registry and is exposed through `/api/config/*` plus operator settings. Local files are compatibility output, not live truth.

Use local materialization only when a coding-agent runtime needs native files:

```bash
autopilot agent skill add <source> --agent claude-code --agent codex
autopilot agent mcp add <source> --name autopilot --agent claude-code
autopilot agent guide set-section "Autopilot" --body "Use Autopilot tasks, Knowledge, and MCP tools."
```

## Runtime Flow

1. A task or query creates a run.
2. The orchestrator assigns the run to a worker.
3. The worker prepares an isolated Git workspace when project mutation is allowed.
4. The worker connects Claude Code, Codex, or OpenCode through `spawn-agent`.
5. Autopilot MCP tools are attached to the session.
6. The worker streams normalized events, artifacts, session refs, and summaries back to the orchestrator.

## Context

Agents should receive resolved context from the orchestrator:

- identity and capability profile
- task/query details
- relevant Knowledge/resources
- project/run metadata
- MCP tools for Autopilot primitives
- previous session/task summaries when relevant

Shared context should be stored as task state, session messages, Knowledge resources, or artifacts. Do not rely on a shared mutable company filesystem for collaboration.

## Worker Filesystem Use

Filesystem access is allowed inside worker-owned project Git workspaces. It is used for code checkout, editing, tests, diffs, and cleanup.

Company Knowledge is not a filesystem scope. It is accessed through the Knowledge API/resource model.
