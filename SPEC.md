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

### Validation Findings

Each validation run produces structured `ValidationFindings`:
- `mode` — which validation step
- `passed` — boolean
- `summary` — one-line description
- `findings` — list of specific issues
- `recommendation` — `proceed`, `fix-and-retry`, or `block`
- `rawOutput` — truncated agent output

Findings are persisted in `TaskRunState.lastValidation` and `TaskRunState.validationHistory[]`.

### Bounded Remediation Loop

After primary validation failure:
1. Extract findings from validation output
2. Send remediation prompt (original task + findings + diff)
3. Re-validate
4. Fail hard after `maxRemediationAttempts` (default: 1)

Configuration:
- `execution.remediationOnValidationFail` (default: `true`)
- `execution.maxRemediationAttempts` (default: `1`)

Safety bounds:
- No infinite self-healing loops
- Agent error during remediation = immediate task failure
- `stopOnFailure` respects remediation failures

### Inspecting Failed Tasks

CLI:
- `qap show <task-id>` — shows last validation summary
- `qap report task <task-id>` — full validation + remediation history

TUI:
- Failed tasks show validation summary inline

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

## Session Record Schema

Each session is stored as `~/.qap/workspaces/<ws-id>/projects/<prj-id>/sessions/<session-id>.json`:

```typescript
interface SessionMeta {
  id: string;              // UUID
  projectId: string;
  workspaceId: string;
  startedAt: string;       // ISO 8601
  finishedAt?: string;     // ISO 8601
  status: "running" | "completed" | "failed" | "aborted";
  provider: string;        // "claude" | "codex"
  taskCount: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentTaskId?: string;  // Updated progressively during run
  lastEventAt?: string;    // Timestamp of last event
  eventLogPath?: string;   // Path to events.jsonl
  changelogPath?: string;  // Path to session changelog
  notes: string[];         // Session-level steering notes
}
```

Sessions are updated progressively: `currentTaskId`, counters, and `lastEventAt` change as tasks execute.

## Steering Model

Three levels of steering notes, injected into every execution prompt:

### Precedence (all included, in order)

1. **Project steering** — `~/.qap/workspaces/<ws-id>/projects/<prj-id>/steering.md`
2. **Task notes** — `TaskRunState.notes[]` in `.autopilot-state.json`
3. **Session notes** — `SessionMeta.notes[]` in session JSON

### Prompt Injection Rules

- Steering notes are rendered as a `# Steering Notes` section at the top of the execution prompt
- Project steering is always included if it exists
- Task notes are included only for the current task
- Session notes are included from the active session
- Empty notes are omitted (no empty sections)

### CLI Commands

```
qap steer project <text>     Append to project steering
qap steer show               Show project steering
qap note <task-id> <text>    Add task note
qap note show <task-id>      Show task notes
```

### TUI Slash Commands

```
/steer project <text>        Append to project steering
/steer show                  Show project steering
/note <task-id> <text>       Add task note
/note show <task-id>         Show task notes
```

## Branding Rules

- product brand is QUESTPIE
- CLI alias is `qap`
- public UI should align with official QUESTPIE branding
- public docs must remain generic and project-agnostic
