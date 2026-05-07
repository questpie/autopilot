# Runtime Setup

Worker runtime setup for QUESTPIE Autopilot.

Last updated: 2026-05-04

## Overview

Workers execute coding-agent runs through `spawn-agent`. Autopilot keeps the runtime names `claude-code`, `codex`, and `opencode` in config and DB rows, but these names now resolve to one `SpawnAgentAdapter` instead of separate shell adapters.

Supported runtime IDs:

| Runtime ID | spawn-agent target | Notes |
| --- | --- | --- |
| `claude-code` | `claude` | Claude Code installed/authenticated on the worker |
| `codex` | `codex` | Codex ACP support through `spawn-agent` |
| `opencode` | `opencode` | OpenCode support through `spawn-agent` |

## What The Worker Owns

- preparing an isolated Git workspace for a run
- connecting the selected coding agent through `spawn-agent`
- attaching the Autopilot MCP server to the session
- forwarding streaming events into normalized Autopilot run events
- preserving runtime session IDs when session persistence is enabled
- exposing read-only workspace inspection for project review

## What The Orchestrator Owns

- tasks, queries, runs, sessions, Knowledge, config, and artifacts
- worker leasing and run assignment
- MCP/API routes used by coding agents
- Git provider compare/change-request links for project runs

The orchestrator does not install local coding-agent binaries and does not contain runtime-specific shell adapters.

## Local Tool Materialization

Use `agent-install` through the CLI when local agent files are needed:

```bash
autopilot agent skill add <source> --agent claude-code --agent codex
autopilot agent mcp add <source> --name autopilot --agent claude-code
autopilot agent guide set-section "Autopilot" --body "Use Autopilot tasks, Knowledge, and MCP tools."
```

These commands write native local-agent files for developer ergonomics. They are compatibility output. Durable intent still belongs in the DB-backed config registry.

## Doctor

```bash
autopilot doctor --offline --require-runtime --runtimes claude-code
autopilot doctor --offline --require-runtime --runtimes codex
autopilot doctor --offline --require-runtime --runtimes opencode
```

Doctor validates local availability. It does not prove remote auth, model entitlement, or full runtime behavior.

## Session Persistence

Workers default to local session persistence:

```bash
autopilot worker start --session-persistence local
```

Use `--session-persistence off` for throwaway sessions. The worker stores/returns runtime session references through the normalized run result, and `spawn-agent` handles runtime-specific resume details.

## MCP

During worker execution, Autopilot passes the MCP server definition to `spawn-agent`. The worker should not hand-write `.codex/config.toml`, `opencode.jsonc`, or Claude-specific MCP files as part of run execution.

Outside worker execution, use `autopilot agent mcp add ...` to materialize native MCP config for local developer tools.

## See Also

- [Architecture](../architecture.md)
- [Deployment Variants](./deployment-variants.md)
- [VPS Deployment Runbook](./vps-dogfood-runbook.md)
