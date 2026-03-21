# QUESTPIE Autopilot Roadmap

This roadmap describes the public product direction for `@questpie/autopilot`.

## First Public Alpha

The first public alpha should include:
- execution engine
- local TUI cockpit
- local project management
- planning workflow MVP

Not as polished final systems, but as thin, real, usable slices.

## Phase 1

Execution engine.

Scope:
- task DAG execution
- readiness engine
- agent runners
- prompt rendering
- local state
- validation steps
- changelog and event stream
- optional tracker sync

Goal:
- run real work locally with clear state and monitoring

## Phase 1.5

Local TUI cockpit.

Scope:
- `qap` opens TUI by default
- queue, current task, logs, task detail
- slash-command input
- run, retry, pause, stop from TUI

Recommended implementation direction:
- OpenTUI React

## Phase 2

Project management + planning workflow.

Scope:
- `.qap/` local project workspaces
- `qap project init`
- `qap project import`
- `qap project list`
- `qap project use`
- planning artifacts
- validation results
- handoff into execution

Important rule:
- manual config authoring is fallback
- AI-assisted project setup is the primary path

## Phase 3

Expanded planning and validation.

Scope:
- multi-agent plan validation
- convergence strategies
- backlog compilation
- prompt-pack compilation
- stronger validation policies

## Phase 4

Remote cockpit and richer provider integrations.

Scope:
- remote/local web monitoring
- mobile steering
- Claude Code SDK runner
- Codex SDK runner
- stronger realtime telemetry

## Product Rules

- product brand is QUESTPIE
- package is `@questpie/autopilot`
- CLI alias is `qap`
- public docs stay generic
- private project artifacts stay local
