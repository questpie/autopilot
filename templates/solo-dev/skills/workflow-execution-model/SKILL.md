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

### Workflows Define Structure, Agents Execute Steps

A workflow is a YAML-defined sequence of steps with typed transitions:

- **Steps** with scoped instructions and role assignments
- **Step types**: `agent` (AI executes), `human_gate` (pauses for approval), `terminal` (workflow complete)
- **Transitions** that define which step follows based on outcome (e.g., `done → next_step`)
- **Human gates** with `min_approvals` from specified reviewer roles
- **Schedules** — workflows trigger on cron via schedule definitions

The orchestrator evaluates the workflow as a pure function — no side effects. It determines what action to take (assign agent, wait for approval, complete) based on current task state.

### Agent Assignment

Each workflow step specifies an agent by:
- **Role** — any agent with a matching role can be assigned
- **Specific ID** — a named agent handles the step

The assigned agent uses its own configured model (via OpenRouter). Model selection is per-agent, not per-step.

### Concurrency

The system enforces a maximum of 5 concurrent agent sessions. Tasks beyond this limit queue until a slot opens.

### Context Assembly

When an agent starts a session, it receives assembled context:
- **Identity** — agent role prompt and configuration
- **Company state** — project and team information
- **Memory** — extracted facts, decisions, mistakes, and patterns from prior sessions
- **Task context** — current task details, workflow step instructions, relevant history

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
- `reviewer_roles` — which roles can approve

The workflow will not advance past a human gate until approval criteria are met.

### Validation

The only implemented validation gate is `human_gate`. There are no automated validation gates (no typecheck, test, lint, or visual comparison). If you need automated checks, run them as part of an agent step's instructions.

## Task-Workflow Lifecycle

```
Schedule/Trigger fires
  → Creates task (with workflow reference)
  → Workflow engine evaluates first step
  → Assigns agent based on step role/ID
  → Agent spawns with assembled context
  → Agent completes work, marks task done
  → task_changed event fires
  → Workflow engine evaluates transitions
  → Advances to next step (or human_gate pauses)
  → Until terminal step → task complete
```

Task state tracks the current `workflow_step` and full transition history.

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
3. **Task history is the record** — every workflow transition is recorded
4. **Pure evaluation functions** — the workflow engine has no side effects
5. **Event-driven advancement** — `task_changed` events trigger workflow evaluation
6. **Human gates are first-class** — can pause any workflow for human decision
7. **Agents do not know about workflows** — they work on tasks; the orchestrator routes based on workflow state

## Limitations

- **No model routing per step** — each agent uses its own default model for all steps it handles
- **No automated validation gates** — only `human_gate` is functional
- **No retry/escalation on failure** — failed steps do not automatically retry or escalate to a smarter model
- **No sub-workflow execution** — `sub_workflow` exists in the schema but returns `no_action`
- **No parallel step execution** — steps run sequentially only
- **No step timeouts** — steps run until the agent completes or is interrupted
- **No token tracking** — `tokens_used` is always 0
- **No step actions** — `notify`, `pin`, `move_task_to` are not implemented
- **No `on_reject` / `max_rounds`** — not implemented
- **No `can_skip_if`** — not implemented
