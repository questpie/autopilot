# Workflow Operating Memo

> Status: local engineering note, not canonical product/spec truth.
> Canonical Autopilot specs live in `/Users/drepkovsky/questpie/specs/autopilot/`.
> If this file conflicts with the external specs, prefer the external specs.

Last updated: 2026-03-31

## Thesis

Autopilot should treat workflows as the primary unit of execution.

Agents are workers inside the system. Workflows are the system.

That means:

- a task with a workflow is not just a prompt with extra metadata
- workflow state is operational state owned by the app
- agents execute the current step, not the whole journey
- validation and advancement are runtime decisions, not social conventions

## Operational Model

The intended lifecycle is:

1. A goal or trigger creates a task.
2. The task references a workflow definition from `team/workflows/*.yaml`.
3. The orchestrator compiles that workflow into a normalized step contract.
4. The app evaluates the current step and records runtime state.
5. An agent, human, or child workflow handles the current step.
6. Validation determines whether the workflow can advance.
7. The workflow completes and is archived as runtime history.

## Planes of the System

### 1. Authored Plane (filesystem)

Human-editable source material lives in the company filesystem:

- `company.yaml`
- `team/agents/*.yaml`
- `team/humans/*.yaml`
- `team/workflows/*.yaml`
- `team/schedules/*.yaml`
- `team/webhooks/*.yaml`
- `skills/`
- `knowledge/`
- `dashboard/`

These are source-of-truth inputs, not runtime state.

### 2. Control Plane (SQLite)

Operational state lives in SQLite and must be queryable:

- tasks
- messages
- activity
- agent sessions
- search indexes
- auth tables
- workflow runs
- step runs
- future budget / retry / escalation telemetry

If the app needs the value to resume, inspect, dedupe, audit, or route work, it belongs in SQLite.

### 3. Timeline Plane (durable streams)

Durable streams are append-only replay logs.

They are useful for:

- live tails
- session replay
- workflow timeline replay
- operator debugging

They are not the source of truth for control state.

## Enforcement Rules

These rules should hold regardless of which agent runs a task:

- the current workflow step is determined by runtime state, not agent memory
- the agent should only execute the current step scope
- the app should decide advancement, not the agent
- human gates must be enforced by the runtime
- child workflow spawning must be idempotent
- restarts must not duplicate workflow side effects
- missing workflow schema or migration state should fail loudly

## Prompt Layer vs Runtime Layer

Prompt instructions help agents behave better, but they are not enough.

Use prompt/system memo for:

- explaining the working model
- telling agents to stay inside step scope
- reinforcing that workflow completion is app-owned state

Use runtime enforcement for:

- step state
- validation gates
- transitions
- retries
- escalation
- idempotency
- archival
- inspection

If a behavior matters for correctness, it should live in the runtime layer.

## Current Direction

We are moving toward this exact shape:

- workflow YAML defines authored structure
- compiler normalizes it into executable step contracts
- orchestrator records `workflow_runs` and `step_runs`
- sub-workflows spawn idempotently
- durable streams capture timeline events
- agents receive a workflow operating memo, but the app remains the enforcer

## What Still Needs To Be True

To fully match the target mental model, the app still needs:

- explicit archive/completion policy for workflow runs
- richer validation outcomes and retry policies
- central escalation engine
- budget/cost telemetry per step
- operator UI for workflow timelines
- skill and docs alignment everywhere the old looser model still leaks through
