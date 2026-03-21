# QUESTPIE Autopilot Specification

## Goal

Reusable local-first workflow engine for software delivery with coding agents.

The public product contract is project-agnostic.
Specific local test projects may exist during development, but they are not part of the public specification.

## Product Shape

QUESTPIE Autopilot answers:
- what is ready now?
- what is blocked and why?
- what should run next?
- what prompt or action should be sent to the agent next?
- what validation should happen next?
- what changed during the run?
- what should be mirrored to the tracker?

## Core Principles

- engine and project workspace must be separate
- local state is the execution truth
- project files are AI-managed by default
- tracker sync is adapter-based
- validation is modeled explicitly
- state transitions are explicit
- the system must explain why something is blocked
- TUI is a first-class surface, not an afterthought
- CLI remains scriptable and debuggable
- max-permission execution exists as an explicit profile

## Command Model

Primary UX:

```bash
qap
```

This should open the TUI.

Secondary commands:
- `qap --help`
- `qap ui`
- `qap project init`
- `qap project import`
- `qap project list`
- `qap project use`
- `qap status`
- `qap next`
- `qap run`
- `qap run-task <id>`
- `qap prompt <id>`

## TUI Contract

The TUI must support:
- current task panel
- ready queue panel
- completed/failed tasks panel
- live log panel
- task detail panel
- command input

Minimum slash commands:
- `/init`
- `/project import`
- `/project use`
- `/run`
- `/run-task <id>`
- `/retry <id>`
- `/note <text>`
- `/help`

## AI-Managed Project Files

Primary path:
- user points QAP at a repo, prompt directory, plan artifacts, and optional tracker issue
- agent reads local files and optional tracker context
- agent creates and manages the local project files QAP needs

Fallback path:
- advanced user provides a hand-written config file

The agent should be able to use filesystem access to:
- create the local project workspace
- normalize config
- materialize prompt references
- store handoff artifacts
- manage runtime state files

Suggested local workspace shape:

```text
.qap/
  projects/
    <project-id>/
      project.json
      autopilot.config.ts
      handoff.md
      prompts/
      planning/
      state.json
      session-log.md
      live-status.md
      events.jsonl
```

## State Model

### Task states

- `todo`
- `ready`
- `in_progress`
- `implemented`
- `validated_primary`
- `validated_secondary`
- `committed`
- `done`
- `blocked`
- `failed`

### Derived states

Epic states:
- `todo`
- `in_progress`
- `ready_for_validation`
- `validated`
- `done`
- `blocked`
- `failed`

Project states:
- `bootstrapping`
- `executing`
- `epic_validation`
- `global_validation`
- `done`
- `blocked`

## Dependency Model

Each task can declare:
- `dependsOn`
- `blocks`
- `track`
  - `gate`
  - `main`
  - `sidecar`
- `kind`
  - `implementation`
  - `validation`
  - `cleanup`
  - `migration`
  - `poc`

The readiness engine must answer:
- is the task ready?
- which dependencies are unmet?
- is it a hard gate?
- what becomes ready after completion?

## Execution Model

Main loop:
1. compute ready queue
2. choose next task by priority and readiness
3. prepare execution context
4. render prompt
5. spawn provider process via Bun
6. capture result and classify success/failure
7. run validation
8. persist state and logs
9. mirror reporting through tracker adapter if enabled
10. recompute queue

## Validation Model

Task-level:
- primary validation
- secondary validation

Later extensions:
- epic validation
- global validation
- multi-agent planning validation

## Provider Model

Current providers:
- Claude Code CLI
- Codex CLI

Future providers:
- Claude Code SDK runner
- Codex SDK runner

Permission profiles:
- `safe`
- `elevated`
- `max`

## Tracker Model

Tracker support is adapter-based.

Capabilities may include:
- fetch issue metadata
- update issue state
- add comments
- sync summaries
- sync notes

Tracker is a mirror, not the execution truth.

## Public MVP Scope

MVP must include:
- execution engine
- AI-assisted project init/import
- local project workspace model
- TUI shell
- command input inside TUI
- local state and logs

MVP does not need:
- remote cockpit
- distributed execution
- full planning compiler
- full SDK migration
- polished app generator

## Branding Rules

- product brand is QUESTPIE
- CLI alias is `qap`
- public UI should align with official QUESTPIE branding
- public docs must remain generic and project-agnostic
