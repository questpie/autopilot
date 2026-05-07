# Skills Architecture Memo

Status: current MVP direction  
Updated: 2026-05-04

## Boundary

Skills are product config plus local agent materialization.

- Durable skill intent belongs in DB-backed config records.
- Local `SKILL.md` files are import/export or runtime compatibility output.
- `agent-install` is the preferred materialization path for Claude Code, Codex, OpenCode, and other local coding agents.
- Worker execution uses `spawn-agent`; Autopilot does not inject whole skill bodies as a primary runtime strategy.

## Current Surfaces

| Surface | Role |
| --- | --- |
| `/api/config/skills` | DB-backed skill definitions |
| Operator Settings | Manage config records and scoped overrides |
| `autopilot skill list/show/find` | Inspect repo-local skills |
| `autopilot skill discover` | Search upstream public skills CLI |
| `autopilot agent skill add` | Materialize skills through `agent-install` |
| Capability profiles | Bind skill IDs to agents/workflow steps |

## Rules

1. Do not make skill files the live source of truth.
2. Do not add a primary Files surface for skills.
3. Keep installed/native agent files regenerable from config/import state.
4. Keep public discovery separate from company-private config.
5. Workers receive resolved skill/capability hints from the orchestrator and rely on native runtime loading where available.
