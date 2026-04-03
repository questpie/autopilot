# Multi-Company Dogfood Proving Plan: Landing-Page Delivery

## 1. Proving Objective

Prove Autopilot can take a bounded implementation task, drive it through a multi-step
workflow with validation loops, and produce real code changes — across multiple
company/project scopes that share only the same orchestrator binary.

**Why a landing-page task:** Visual, bounded, clear "done" criteria. Touches real files
(HTML/CSS), produces reviewable diffs, runs end-to-end in under an hour.

**Why `~/questpie/companies`:** Real filesystem topology with separate company roots proves
scope discovery, config resolution, and project isolation work beyond unit tests.

## 2. Execution Model Constraints

These are reality constraints from the current implementation. The proving plan respects
them — it does not require features that don't exist.

### One orchestrator = one company/project scope

`startServer()` discovers and resolves a single scope chain at boot
(`packages/orchestrator/src/server.ts`). Proving multi-company means:

- Same binary, separate boot per company/project root
- NOT multi-tenant orchestrator in one process
- Each boot gets its own `company.db`, resolved config, and workflow engine

### One worker = one repoRoot

`AutopilotWorker` binds to a single `repoRoot` for workspace/worktree isolation
(`packages/worker/src/worker.ts`, `packages/worker/src/workspace.ts`).
Proving multi-project means:

- Worker restart with different `repoRoot`
- Or separate worker process per project repo

### Workflow loops create new runs = new worktrees

Revise/reply loops through workflow advancement create new runs with new IDs.
Each run gets a fresh worktree (`autopilot/run-<newId>`). Same-worktree reuse only
happens on explicit continuation via `resumed_from_run_id`.

### Success = changes on branch + inspectable diff

Auto-commit is NOT a system contract. Truthful success is:

- Changes exist on `autopilot/run-*` branch
- Diff is inspectable (`git diff` on worktree)
- Workflow reached `done` step
- Task status is `done`

## 3. `~/questpie/companies` Topology

```
~/questpie/companies/
├── acme/                              # Company 1 (primary proving target)
│   ├── .autopilot/
│   │   ├── company.yaml
│   │   ├── agents/dev.yaml
│   │   ├── workflows/deliver.yaml
│   │   └── context/brand.md
│   └── acme-web/                      # Project: marketing site
│       ├── .autopilot/project.yaml
│       ├── package.json
│       ├── src/
│       └── .git/
│
├── northstar/                         # Company 2 (scope isolation check)
│   ├── .autopilot/
│   │   ├── company.yaml
│   │   ├── agents/dev.yaml
│   │   ├── workflows/deliver.yaml
│   │   └── context/brand.md
│   └── northstar-landing/
│       ├── .autopilot/project.yaml
│       ├── package.json
│       ├── src/
│       └── .git/
│
└── fermo/                             # Company 3 (minimal — no context dir)
    ├── .autopilot/
    │   ├── company.yaml
    │   ├── agents/dev.yaml
    │   └── workflows/deliver.yaml
    └── fermo-site/
        ├── .autopilot/project.yaml
        ├── package.json
        ├── src/
        └── .git/
```

## 4. Minimum Test-Company Setup

### company.yaml (per company)

```yaml
# acme
name: "Acme Corp"
slug: acme
description: "Industrial solutions company"
timezone: UTC
language: en
owner: { name: Test Operator, email: test@acme.test }
defaults:
  task_assignee: dev
  workflow: deliver
  runtime: claude-code
```

Each company gets distinct name/slug/description.
Northstar uses `Europe/London` timezone. Fermo omits optional fields.

### agents/dev.yaml (same across all)

```yaml
id: dev
name: Developer
role: developer
description: Implements features and writes tests
```

### context/brand.md (Acme + Northstar only)

Short brand guidance (3-5 lines): company name, tagline, primary color, tone.
Fermo omits this — proves the system works without optional context.

### project.yaml (per project)

```yaml
name: acme-web
description: Acme Corp marketing website
defaults:
  runtime: claude-code
```

Each project is a separate `git init` repo with minimal `package.json` and empty `src/`.

## 5. Proving Workflow (`deliver.yaml`)

```yaml
id: deliver
name: "Deliver"
description: "Plan -> validate -> prompt -> implement -> validate -> review -> done"
steps:
  - id: plan
    type: agent
    agent_id: dev
    instructions: >
      Research and create an implementation plan for the task.
      Consider the project structure and constraints.
      Produce a clear step-by-step plan. Do NOT implement yet.

  - id: validate-plan
    type: agent
    agent_id: dev
    instructions: >
      Validate the implementation plan from the previous step.
      Check completeness, feasibility, and scope.
    output:
      outcome:
        description: "Whether the plan is ready"
        values:
          approved: "Plan is complete and ready"
          revise: "Plan needs changes"
      summary:
        description: "Brief validation result"
    transitions:
      - when: { outcome: approved }
        goto: generate-impl-prompt
      - when: { outcome: revise }
        goto: plan

  - id: generate-impl-prompt
    type: agent
    agent_id: dev
    instructions: >
      Based on the approved plan, generate a detailed implementation prompt.
      Include exact file paths, change descriptions, and scope boundaries.
    output:
      summary:
        description: "Brief status"
      artifacts:
        - kind: implementation_prompt
          title: "Implementation Prompt"
          description: "Full implementation instructions"

  - id: implement
    type: agent
    agent_id: dev
    instructions: >
      Implement the task following the implementation prompt.
      Write clean code. Stay within scope.
    input:
      artifacts:
        - implementation_prompt

  - id: validate-impl
    type: agent
    agent_id: dev
    instructions: >
      Validate the implementation. Check conventions, verify scope.
    output:
      outcome:
        description: "Whether the implementation is correct"
        values:
          approved: "Implementation is correct"
          revise: "Implementation needs fixes"
      summary:
        description: "Brief validation result"
      feedback:
        description: "Specific issues if revising"
    transitions:
      - when: { outcome: approved }
        goto: review
      - when: { outcome: revise }
        goto: implement

  - id: review
    type: human_approval
    on_approve: done
    on_reply: implement
    on_reject: done

  - id: done
    type: done
```

### Step behavior summary

| Step | Structured output | Loops | Artifacts |
|------|-------------------|-------|-----------|
| plan | No | Target of revise loop | — |
| validate-plan | outcome + summary | Revises back to plan | — |
| generate-impl-prompt | summary + artifact | No | Produces `implementation_prompt` |
| implement | No | Target of revise + reply loops | Consumes `implementation_prompt` |
| validate-impl | outcome + summary + feedback | Revises back to implement | — |
| review | Human decision | Reply sends back to implement | — |
| done | Terminal | — | — |

## 6. Landing-Page Proving Task

### Task

```
Title: Implement landing page
Description: >
  Create a simple, responsive landing page with:
  - Hero section with company name, tagline, and CTA button
  - Features/value section with 3 cards
  - Footer with copyright
  - Responsive layout (mobile + desktop)
  - Copy matching company brand context if available

  Use vanilla HTML + CSS. Output should be src/index.html (+ optional styles.css).
```

### Done criteria

- `src/index.html` exists on an `autopilot/run-*` branch in the project repo
- Page has hero, features, footer sections
- Layout is responsive (media queries or flexbox/grid)
- Copy references the company name if brand context was provided
- Workflow reached `done` step
- Diff is inspectable on the worktree branch

### Out of scope

- Build tooling, JS interactivity, deployment, image assets
- Performance optimization, testing, accessibility audit
- Auto-commit (not a system guarantee)

### Size

20-40 minutes per company end-to-end. Repeatable 3x in a half-day.

## 7. Technical Behaviors Checklist

### Scope resolution
- [ ] `discoverScopes()` from project dir finds both project.yaml and company.yaml
- [ ] Company brand context (`brand.md`) appears in resolved config
- [ ] Fermo (no context dir) resolves cleanly without errors
- [ ] Project defaults override company defaults when set

### Resolved context distribution
- [ ] Worker claim response includes `agent_name`, `agent_role` from config
- [ ] Instructions in claimed run are fully baked (no FS dependence at worker)
- [ ] Brand context text appears in run instructions when available

### Workflow control flow
- [ ] Plan step creates a pending run with correct agent assignment
- [ ] `validate-plan` with `{ outcome: revise }` routes back to `plan`
- [ ] `validate-plan` with `{ outcome: approved }` routes to `generate-impl-prompt`
- [ ] `validate-impl` loops back to `implement` on `{ outcome: revise }`
- [ ] Human `reply` at `review` routes back to `implement` with feedback in instructions
- [ ] Human `approve` at `review` routes to `done`
- [ ] Task status: `active` -> `blocked` (review) -> `active` (reply) -> `done`

### Artifact forwarding
- [ ] `generate-impl-prompt` produces `implementation_prompt` artifact in DB
- [ ] `implement` run instructions contain artifact content under `## Input:`
- [ ] After a revise loop, `implement` still receives the original artifact

### Git/worktree behavior
- [ ] Each run gets its own worktree under `.worktrees/run-<id>`
- [ ] Changes exist on `autopilot/run-<id>` branch
- [ ] Revise/reply loop runs get new worktrees (not reusing previous)
- [ ] Continuation runs (resumed_from_run_id) reuse worktree
- [ ] Different company/project repos have independent worktrees

### Operator review flow
- [ ] Task reaches `blocked` at review step
- [ ] Tasks, runs, artifacts queryable via API
- [ ] `approve` completes the task
- [ ] `reply` creates a new implement run with feedback
- [ ] `reject` marks task as done

## 8. Success Criteria and Failure Modes

### Pass criteria

1. Landing page changes exist on a worktree branch in the project repo
2. Workflow reached `done` through the full step sequence
3. At least 1 revision loop exercised (force manually if needed)
4. Artifact flow verified (implementation_prompt in DB and in implement instructions)
5. No manual patching outside the intended operator flow
6. History inspectable via API (tasks, runs, events, artifacts)

### Failure modes

| Failure | Indicates |
|---------|-----------|
| Wrong company context in instructions | Scope resolution broken |
| Implementation prompt missing in implement instructions | Artifact forwarding broken |
| Worker needs `.autopilot/` at runtime | Context distribution incomplete |
| Revise loop skips or deadlocks | Transition matching broken |
| Human reply doesn't create new run | Reply routing broken |
| Changes in wrong project repo | Worktree pointing at wrong root |
| No worktree branch after run | Workspace manager failed |
| Fermo errors on missing context dir | Scope resolver not tolerant |
| Task stuck in `active` after review | Status transition broken |
| Northstar run has Acme brand context | Scope isolation failed (separate boots) |

## 9. Phased Proving Plan

### Phase A: Scaffold (1-2 hours)

1. Create `~/questpie/companies/{acme,northstar,fermo}` structure
2. Write all config files (company.yaml, project.yaml, agents, workflows, context)
3. `git init` each project repo with minimal package.json + empty src/
4. Verify: boot orchestrator from each project dir, check scope resolution logs

**Gate:** Orchestrator boots cleanly from all 3 project dirs.

### Phase B: Single-company proving — Acme (2-3 hours)

1. Boot orchestrator: `startServer({ companyRoot: '~/questpie/companies/acme/acme-web' })`
2. Boot worker: `AutopilotWorker({ repoRoot: '~/questpie/companies/acme/acme-web', ... })`
3. Create task via API: "Implement landing page"
4. Let workflow run through to review step
5. Force at least 1 revision (manually advance with `{ outcome: 'revise' }` if agent auto-approves)
6. At review: reply with feedback, then approve after re-implementation
7. Inspect: task status, run history, artifacts, worktree branch, diff

**Gate:** All Phase B checklist items pass. Landing page exists on branch. Flow was truthful.

### Phase C: Multi-company proving — Northstar + Fermo (2-3 hours)

1. Stop Acme orchestrator + worker
2. Boot against Northstar: same process, different root
3. Run same task — verify Northstar brand context (not Acme)
4. Stop, boot against Fermo — verify no errors from missing context
5. Compare: 3 landing pages, 3 repos, 3 separate histories

**Gate:** Scope isolation confirmed. No cross-company contamination.

### Phase D: Document findings (1 hour)

1. Fill findings template per company
2. Document gaps, workarounds, surprises
3. Produce "ready / not ready for Worker App Phase A" verdict

## 10. Recommended Output Artifacts

| Document | Location | Purpose |
|----------|----------|---------|
| Proving plan | `local_specs/dogfood-proving-plan.md` | This document |
| Runbook | `local_specs/dogfood-runbook.md` | Step-by-step operator checklist |
| Scaffold script | `scripts/scaffold-test-companies.sh` | Automate Phase A |
| Findings template | `local_specs/dogfood-findings-template.md` | Per-run pass/fail + notes |
| Test companies | `~/questpie/companies/` (outside repo) | Actual test data |

## 11. Timing Relative to Worker App Phase A

**Run Phase A + B now, before any Worker App code.**

Phase A is 1-2 hours of scaffolding with zero code dependencies.
Phase B validates the entire backend pipeline end-to-end. A scope resolution bug
or artifact forwarding bug discovered after 3 weeks of Tauri UI work would be expensive.

**Phase C in parallel with early Worker App Phase A work.**

By the time the app shell renders a task list, you should have 3 proven companies.
The app's first real demo should show a real completed dogfood flow.

**Phase D is the gate.** If proving says "not ready", Worker App pauses until gaps are fixed.

### Practical starting order

1. Scaffold acme only (30 min)
2. Run one Acme landing-page flow end-to-end
3. If truthy, expand to Northstar + Fermo
4. If not truthy, fix gaps before anything else
