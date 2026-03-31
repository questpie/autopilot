---
name: Workflow-Based Execution Model
description: Core architecture behind Autopilot's workflow-based AI task execution
metadata:
  roles: [all]
  tags: [architecture, workflows, agents, schedules]
---

# Workflow-Based AI Task Execution

## Core Thesis

AI models are good at individual steps. They are bad at completing full tasks end-to-end. The longer an AI agent runs autonomously, the more it drifts — losing context, making compounding mistakes, diverging from the original intent.

The fix is **structure**.

Autopilot breaks every task into a **workflow** — a sequence of small, scoped steps. Each step gets fresh context, clear instructions, and optional human review before proceeding.

## How It Works

### Workflows Are the Runtime Primitive

A workflow is no longer just YAML routing. It is the primary execution contract for a task.

- **Filesystem definitions** live in `team/workflows/*.yaml`
- **Compiled step contracts** normalize legacy and explicit fields into runtime-safe structure
- **Runtime state** lives in SQLite as `workflow_runs` and `step_runs`
- **Timeline replay** is appended to Durable Streams as a secondary event log

The app owns workflow state. Agents do not.

### Workflows Define Structure, Agents Execute Steps

A workflow step can now carry:

- **Executor** details (`agent`, `human`, `tool`, `sub_workflow`)
- **Instructions** for the current step only
- **Validation** mode (`auto`, `review`, `human`, `tool`, `composite`)
- **Failure policy** (`retry`, `revise`, `escalate`, `block`, `spawn_workflow`)
- **Model policy** hints for routing and review behavior
- **Sub-workflow spawning** with input mapping and idempotency keys

The workflow engine still evaluates transitions as a pure decision layer, but the orchestrator now persists the resulting runtime state.

### Agent Assignment

Each workflow step specifies an agent by:
- **Role** — any agent with a matching role can be assigned
- **Specific ID** — a named agent handles the step

The assigned agent uses its configured model today, while workflow steps can also declare `model_policy` as the beginning of step-level routing.

### Concurrency

The system enforces a maximum of 5 concurrent agent sessions. When the limit is reached, additional spawns are skipped with a warning (no internal queue).

### Context Assembly

When an agent starts a session, it receives assembled context:
- **Identity** — agent role prompt and configuration
- **Company state** — project and team information
- **Memory** — extracted facts, decisions, mistakes, and patterns from prior sessions
- **Task context** — current task details, workflow step instructions, relevant history

When a task has a workflow, the prompt also includes a **workflow operating memo** that tells the agent:

- execute the current step only
- do not invent hidden process outside the workflow
- treat advancement and validation as app-owned runtime state

### Agent Memory

After each agent session completes, the system extracts and stores:
- Facts learned
- Decisions made
- Mistakes encountered
- Patterns observed

This memory is available to future sessions for the same agent.

### Human Gates

Human gates pause workflow execution until a human approves. Configuration includes:
- `min_approvals` — how many approvals are needed
- `reviewers_roles` — which roles can approve

The workflow will not advance past a human gate until runtime approval criteria are met.

### Validation

Validation is now part of the step contract and runtime metadata, but only review/human waiting behavior is currently enforced deeply. Automated validators still need to be implemented case by case or executed inside the step's work instructions.

So the right mental model is:

- validation is a first-class workflow concept
- persistence for validation state exists
- full auto-validator execution is not complete yet

## Task-Workflow Lifecycle

```
Schedule/Trigger fires
  → Creates task (with workflow reference)
  → Workflow engine evaluates first step
  → Assigns agent based on step role/ID
  → Agent spawns with assembled context
  → Agent completes work, marks task done
  → Workflow engine evaluates transitions when orchestrator processes the task
  → Advances to next step (or human_gate pauses)
  → Until terminal step → task complete
```

Task state tracks the current `workflow_step`, while SQLite tracks durable workflow runtime state.

## Runtime Records

Execution state now has two durable runtime records:

- **`workflow_runs`** — one current run per task/workflow, including current step, status, trigger, and metadata
- **`step_runs`** — durable per-step attempts with executor info, validation mode, failure action, child workflow linkage, and snapshots

This is important: task history is no longer the only record. Workflow execution has its own queryable runtime model.

## Storage Philosophy

- **Filesystem** = authored inputs and human-editable source material
- **SQLite** = control plane and resumable runtime state
- **Durable Streams** = append-only timeline for replay/debugging

If the application needs the value to dedupe work, resume after restart, inspect history, or enforce transitions, it belongs in SQLite.

## Architecture

```
team/
├── agents/*.yaml      — agent definitions (role, model, tools, fs_scope)
├── humans/*.yaml      — human team members (notification routing, approval scopes)
├── workflows/*.yaml   — workflow definitions (steps, transitions, gates)
├── schedules/*.yaml   — cron triggers for workflows/agents
└── roles/*.md         — role prompts with frontmatter defaults
```

## Key Design Principles

1. **Workflows are YAML files, not code** — living documents, versioned, auditable
2. **Workflows define routes, agents execute steps** — clean separation of concerns
3. **Runtime state is app-owned** — the app persists workflow execution in SQLite
4. **Pure evaluation functions** — the workflow engine still computes decisions without side effects
5. **Deterministic evaluation** — workflow decisions are computed from current task/workflow state
6. **Human gates are first-class** — can pause any workflow for human decision
7. **Agents do not own the journey** — they work the current step; the orchestrator owns routing and advancement

## Limitations

- **No model routing per step** — each agent uses its own default model for all steps it handles
- **Automated validation is partial** — validation contracts are modeled, but most concrete auto-validators are not implemented yet
- **Retry/escalation policy is not centrally enforced yet** — failure policy exists in the contract, but the full policy engine is still ahead
- **Sub-workflow execution is early-stage** — idempotent child workflow spawning works, but broader parent/child orchestration is still incomplete
- **No parallel step execution** — steps run sequentially only
- **No spawn queue at concurrency limit** — over-limit spawns are skipped
- **No step timeouts** — steps run until the agent completes or is interrupted
- **No token tracking** — `tokens_used` is always 0
- **No step actions** — `notify`, `pin`, `move_task_to` are not implemented
- **No full archive lifecycle yet** — completed workflow runs are durable, but archive policy is still incomplete
- **No central cost/quality telemetry yet** — workflow economics are not yet a first-class operator surface
