# Workflow Operating Memo

Status: local engineering note  
Updated: 2026-05-04

## Thesis

Autopilot treats workflows as app-owned execution state. Agents execute assigned work; they do not own workflow progression.

## Runtime Model

1. A task/query creates a run.
2. The task references a workflow config record when workflow-backed.
3. The orchestrator evaluates the current step and persists runtime state.
4. A worker/human/child workflow handles the current step.
5. Validation determines whether the workflow can advance.
6. Runs emit artifacts, summaries, session refs, and activity.

Workflow definitions are DB-backed config records after import. Local files may seed or export config, but live workflow state is not read from a company filesystem.

## State Planes

### Control Plane

SQLite stores tasks, runs, workflow state, sessions, workers, schedules, config, and auth.

### Knowledge Plane

Knowledge/resources store docs, images, OpenAPI specs, durable summaries, and artifacts.

### Worker Execution Plane

Workers use isolated Git workspaces for project execution and `spawn-agent` for coding-agent sessions. Project inspection is run/path + git diff oriented.

### Timeline Plane

Run events and streams are append-only replay/debug data. They are not the source of truth for workflow advancement.

## Agent Guidance

Agents should:

- operate on the current task/run only
- use Autopilot MCP tools for task/Knowledge/workflow actions
- emit artifacts and summaries instead of depending on shared filesystem state
- let the orchestrator enforce advancement, validation, and human gates
