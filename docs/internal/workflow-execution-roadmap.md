# Workflow-Based Execution Roadmap

> Status: local engineering note, not canonical product/spec truth.
> Canonical Autopilot specs live in `/Users/drepkovsky/questpie/specs/autopilot/`.
> If this file conflicts with the external specs, prefer the external specs.

> Goal: move Autopilot from a workflow-aware orchestrator to a true workflow-based AI execution system.
> Last updated: 2026-03-31

## Why This Exists

Autopilot already has workflows, schedules, agents, human gates, and a working orchestrator.
What it does not yet have is the full mental model we want to standardize on:

- the orchestrator should compile goals into explicit workflows
- each workflow step should have a narrow execution contract
- validation should be a first-class gate, not an informal convention
- escalation should be policy-driven, not ad hoc
- replay, checkpoints, and cost routing should be built into the runtime

This roadmap defines the next three phases needed to get there.

## Target Mental Model

The target system behaves like this:

1. A high-level goal enters the system.
2. The orchestrator converts that goal into a typed workflow.
3. Each step runs with fresh scoped context.
4. Each step produces structured outputs.
5. A validation gate decides whether the workflow can continue.
6. If validation fails, the runtime retries, revises, escalates, or blocks based on policy.
7. Every step is checkpointed, inspectable, replayable, and cost-attributed.

In short: AI handles steps, the workflow runtime handles the journey.

---

## Phase 1 - Step Contract and Executable Workflow Spec

### Objective

Replace the current loose step model with an explicit execution contract so every workflow step says:

- who or what runs it
- what inputs it receives
- what outputs it must produce
- how it is validated
- what happens on failure
- whether it can spawn a sub-workflow

### Why This Phase Comes First

The current workflow schema is good enough for transitions and assignment, but not strict enough for the desired mental model. Before we improve runtime behavior, we need the workflow definition itself to carry the right semantics.

### Current Gaps

- `WorkflowStepSchema` models assignment and transitions, but not a full execution contract.
- Validation is split across step review, human gates, tests, and runtime conventions.
- Retry, escalation, and sub-workflow spawning are not first-class step primitives.
- Model routing exists indirectly through agent config, not as a workflow execution policy.

### Deliverables

#### 1. Step contract in spec

Extend `packages/spec/src/schemas/workflow.ts` so a step can define:

- `executor`
  - `kind`: `agent | human | tool | sub_workflow`
  - `role` or `agent_id`
  - optional `model_policy`
- `instructions`
  - short execution brief for the step
  - optional system constraints / success criteria
- `inputs`
  - explicit sources from task context, workflow inputs, previous step outputs, or external trigger payloads
- `outputs`
  - typed output declarations with stable ids
- `validate`
  - `mode`: `auto | human | review | tool | composite`
  - optional validator refs, thresholds, required artifacts, expected files, required tests
- `on_fail`
  - `retry`
  - `revise`
  - `escalate`
  - `block`
  - `spawn_workflow`
- `max_retries`
- `spawn_workflow`
  - workflow id
  - input mapping
  - result mapping back into the parent step

#### 2. Normalized runtime types

Add normalized TypeScript runtime types for:

- compiled workflow definition
- compiled step contract
- resolved input bindings
- step output envelope
- validation result envelope
- failure policy result

#### 3. Backward-compatible migration layer

Keep existing simple workflows working during rollout by compiling old step fields into the new contract where possible.

Examples:

- `type: agent` -> `executor.kind = agent`
- `review` -> `validate.mode = review`
- `type: human_gate` -> `validate.mode = human`

This compatibility layer should exist in the compiler, not as long-term dual runtime behavior.

#### 4. Authoring guidance

Document the new format and add at least one canonical example for:

- feature workflow
- design-to-code workflow
- recurring scheduled workflow

### Suggested Schema Shape

```yaml
id: billing-toggle
name: Billing Toggle Feature
steps:
  - id: research
    executor:
      kind: agent
      role: strategist
      model_policy: cheap-research
    instructions: Find current pricing toggle patterns and recommend one.
    inputs:
      - from: workflow_input.feature_brief
    outputs:
      - id: recommendation
        type: json
    validate:
      mode: auto
      rules:
        - type: min_items
          target: recommendation.examples
          value: 3
    on_fail: escalate
    max_retries: 1
    transitions:
      done: design
```

### Code Areas Likely Touched

- `packages/spec/src/schemas/workflow.ts`
- `packages/spec/tests/schemas.test.ts`
- `packages/orchestrator/src/workflow/engine.ts`
- `packages/orchestrator/src/workflow/loader.ts`
- `packages/orchestrator/src/server.ts`
- docs for workflow authoring

### Acceptance Criteria

- workflows can declare step-level execution, validation, retry, escalation, and sub-workflow behavior
- old simple workflows still parse through a compile layer during migration
- runtime receives a compiled step contract instead of reading raw YAML fields ad hoc
- at least 3 example workflows demonstrate the new shape
- schema and engine tests cover happy path, invalid contracts, and migration behavior

### Non-Goals

- full checkpoint persistence
- replay UI
- global model economics dashboard

---

## Phase 2 - Workflow Runtime State Machine, Checkpoints, and Replay

### Objective

Turn workflow execution into a durable state machine so each step can be resumed, replayed, audited, and debugged without guessing from task history.

### Why This Phase Matters

The desired mental model requires workflows to be white boxes. Right now the system knows the current workflow step, but it does not yet model the full lifecycle of a step execution as a first-class runtime object.

### Current Gaps

- task state is the main source of truth, but step runs are not modeled explicitly
- crash recovery is partial and step-level resumability is limited
- replay requires reconstructing behavior from task history and logs
- validation state, retries, and escalations are not persisted as distinct runtime events

### Deliverables

#### 1. Durable workflow run model

Add persistent runtime records for:

- `workflow_runs`
  - workflow id
  - parent task id
  - status
  - current step id
  - trigger source
  - workflow inputs
- `step_runs`
  - step id
  - run number
  - status
  - executor
  - model policy used
  - resolved inputs
  - produced outputs
  - validation result
  - failure reason
  - escalation target

Whether this lives in SQLite tables, JSON sidecars, or both should be decided early, but SQLite should be the primary source of truth for queryability.

#### 2. Explicit state machine

Introduce step lifecycle states such as:

- `pending`
- `preparing_context`
- `executing`
- `validating`
- `waiting_human`
- `retrying`
- `escalated`
- `blocked`
- `completed`
- `failed`
- `cancelled`

Transitions must be deterministic and emitted as structured events.

#### 3. Checkpoints and resume

At minimum, the runtime should checkpoint after:

- workflow compilation
- input resolution
- step execution completion
- validation completion
- escalation decision
- terminal completion

On restart, the orchestrator should resume from the last durable checkpoint instead of re-deriving everything from task state.

#### 4. Replay primitives

Add replay/debug primitives for:

- show workflow run timeline
- inspect a specific step run
- replay a failed step with the same inputs
- replay a failed step with a different model policy
- diff two step runs

This can start as CLI/API-only. UI can come later.

#### 5. Parent-child workflow execution

Make sub-workflow spawning a runtime primitive, not just a future schema field.

Needed behavior:

- parent step can spawn child workflow
- child workflow has its own run id and checkpoints
- parent waits until child returns or fails
- child outputs map back into parent step outputs

### Code Areas Likely Touched

- workflow engine and orchestrator runtime
- SQLite backend and schema/migrations
- task-to-workflow bootstrap logic in `packages/orchestrator/src/server.ts`
- API routes for workflow inspection
- CLI commands for replay/debug

### Acceptance Criteria

- every executing workflow has a durable run record
- every step attempt has a durable step run record
- orchestrator restart can resume an in-flight workflow without duplicating completed work
- failed steps can be replayed from stored inputs
- parent-child workflow relationships are visible and queryable
- logs and API responses expose workflow run ids and step run ids

### Non-Goals

- polished replay UI
- cross-company distributed execution
- speculative parallel step execution

---

## Phase 3 - Central Model Routing, Escalation Policy, and Cost/Quality Telemetry

### Objective

Make model economics and escalation behavior an explicit platform policy, not a convention hidden inside prompts or agent config.

### Why This Phase Matters

The promised mental model depends on this rule holding true at runtime:

- smart models plan
- cheap models execute
- smart models review only when needed

If that stays informal, costs drift up and behavior becomes inconsistent across workflows.

### Current Gaps

- model choice is distributed across agent config and provider defaults
- escalation is not centralized as a workflow policy engine
- there is no per-step cost, retry, validation, or escalation reporting layer
- we cannot yet measure whether the system is following the intended economics

### Deliverables

#### 1. Model policy registry

Introduce named policies such as:

- `smart-plan`
- `cheap-execute`
- `smart-review`
- `cheap-research`
- `vision-verify`

Each policy should define:

- provider/model
- fallback chain
- token limits
- timeout budget
- allowed step kinds
- cost tier

Policies should be referenced by workflow steps, not hard-coded per caller.

#### 2. Central escalation engine

Build a decision layer that consumes validation failures and selects the next action:

- retry same policy
- revise prompt and retry
- escalate to smarter policy
- request human review
- block workflow
- spawn remediation workflow

This must be deterministic and explainable.

#### 3. Step-level telemetry

Capture and expose per-step metrics:

- tokens in/out
- cost estimate
- execution latency
- validation outcome
- retry count
- escalation count
- final resolution path

Aggregate per workflow, per project, per schedule, and per model policy.

#### 4. Budget and quality controls

Add policy-level controls such as:

- max retries before escalation
- max cost per workflow run
- max cost per schedule period
- minimum validation score before auto-advance
- human approval required above a risk threshold

#### 5. Visibility surfaces

Expose telemetry in at least one operator-friendly surface:

- CLI summary
- API endpoints
- optional dashboard views later

### Code Areas Likely Touched

- AI provider abstraction and routing layer
- workflow runtime policy engine
- SQLite schema for telemetry
- scheduler reporting
- API and CLI inspection commands

### Acceptance Criteria

- all executable workflow steps resolve model choice through a named policy
- all validation failures flow through a central escalation decision layer
- workflow runs expose cost, retries, and escalation paths
- operators can answer: what failed, why it failed, what it cost, and why it escalated
- at least one real workflow demonstrates smart-plan + cheap-execute + smart-review-on-fail behavior end to end

### Non-Goals

- perfect cost estimation across providers
- auto-optimization of policies without human review
- multi-region execution routing

---

## Recommended Build Order Inside the Three Phases

### Milestone A

- add new workflow step schema
- implement compiler from raw YAML -> compiled contract
- keep old workflow examples working

### Milestone B

- persist workflow runs and step runs
- checkpoint and resume a single workflow reliably
- expose basic run inspection API

### Milestone C

- add model policy registry
- wire validation failures into central escalation engine
- record cost and quality telemetry

### Milestone D

- convert 2-3 real workflows to the new contract
- add replay commands
- document operator workflow for debugging failures

---

## Success Criteria for the Whole Roadmap

We can say the mental model is truly implemented when all of the following are true:

- a high-level goal is compiled into a structured workflow
- each step runs with explicit inputs, outputs, and validation
- each failure follows a declared retry/escalation policy
- each step run is durable and replayable
- each workflow exposes cost and quality metrics
- sub-workflows are first-class runtime behavior
- humans inspect workflow timelines instead of reading raw agent transcripts to understand what happened

## Risks and Design Constraints

- avoid turning the schema into an unmaintainable DSL; prefer a small core with extensible validators/actions
- keep compilation separate from execution so authoring format can evolve without infecting runtime logic
- do not encode provider-specific details directly into workflow YAML; use named model policies
- preserve the simple path for small teams; advanced contracts should be optional where possible
- avoid silent fallback behavior; invalid workflow contracts should fail loudly

## Suggested First Implementation Slice

If we want the smallest slice that proves the direction, build this first:

1. Add `validate`, `on_fail`, `max_retries`, and `model_policy` to step spec.
2. Compile raw workflows into normalized step contracts.
3. Persist `workflow_run` + `step_run` records for one execution path.
4. Run one real workflow with cheap execute + escalate on failed validation.
5. Expose a CLI/API command that shows the exact run timeline.

That slice proves the new mental model without requiring the full platform rewrite up front.
