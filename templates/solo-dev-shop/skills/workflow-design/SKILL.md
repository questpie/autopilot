---
name: workflow-design
description: |
  Design, modify, and maintain workflow YAML files. Understand step types,
  transitions, review gates, and versioning conventions.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  roles: [meta]
  tags: [workflow, design, orchestration]
---

# Workflow Design

This skill covers the complete workflow YAML format, how to create, modify, and maintain workflows for the QUESTPIE Autopilot system.

---

## 1. Workflow YAML Format

Every workflow lives in `/team/workflows/{id}.yaml` and has this structure:

```yaml
id: my-workflow
name: "Human-readable Name"
version: 1
description: "What this workflow does"

steps:
  - id: step-id
    name: "Step Name"
    type: agent | human_gate | terminal | sub_workflow
    # type-specific fields...
    transitions:
      done: next-step-id
```

### Required Fields
- `id` — unique workflow identifier (kebab-case)
- `name` — display name
- `version` — integer, bump on every change
- `description` — what the workflow accomplishes
- `steps` — ordered array of step definitions

---

## 2. Step Types

### 2.1 Agent Step (`type: agent`)

An automated step executed by an AI agent.

```yaml
- id: implement
  name: "Implement"
  type: agent
  assigned_role: developer       # role-based assignment
  assigned_to: max               # OR specific agent ID
  auto_execute: true             # spawn immediately (default: true)
  description: "Write the code"
  expected_duration: "4h"
  timeout: "8h"
  timeout_action: alert_human    # alert_human | reassign | cancel
  inputs:
    - from_step: plan
      type: document
  outputs:
    - type: branch
      name_template: "feat/{{task_id}}"
  transitions:
    done: code_review
```

### 2.2 Human Gate (`type: human_gate`)

Pauses workflow until a human approves or rejects.

```yaml
- id: human_merge
  name: "Human Merge Approval"
  type: human_gate
  gate: merge                    # gate identifier for the UI
  description: "Human reviews and approves the merge"
  transitions:
    approved: deploy_staging
    rejected: implement          # go back on rejection
```

### 2.3 Terminal Step (`type: terminal`)

Marks the end of the workflow. Every workflow must have at least one.

```yaml
- id: complete
  name: "Complete"
  type: terminal
  terminal: true
  description: "Workflow complete"
  actions:
    - move_task_to: done
  transitions: {}
```

### 2.4 Sub-Workflow (`type: sub_workflow`)

Delegates to another workflow definition.

```yaml
- id: run-tests
  name: "Run Test Suite"
  type: sub_workflow
  workflow_ref: testing          # references testing.yaml
  transitions:
    done: deploy
    failed: implement
```

---

## 3. Transitions

Transitions map outcome keys to the next step ID.

```yaml
transitions:
  done: next_step        # simple string reference
  approved: deploy       # for gates
  rejected: implement    # go back
  failed: error_handler  # error path
```

### Conditional Transitions

For priority-based routing:

```yaml
transitions:
  done:
    step: review
  done_if_priority_critical:
    step: fast_track_review
```

### Common Patterns
- `done → next` — linear progression
- `approved/rejected` — gate outcomes
- `failed → previous` — retry loop
- `done → terminal` — workflow completion

---

## 4. Review Gates

Add review requirements to any agent step:

```yaml
- id: code_review
  type: agent
  assigned_role: reviewer
  review:
    reviewers_roles: ["reviewer", "senior_developer"]
    min_approvals: 1
    on_reject: revise              # revise | reassign | cancel
    on_reject_max_rounds: 3        # max rejection cycles
  transitions:
    approved: deploy
    rejected: implement
```

- `min_approvals` — how many approvals needed to proceed
- `on_reject` — what happens when review is rejected
- `on_reject_max_rounds` — after N rejections, escalate to human
- `reviewers_roles` — which roles count as valid reviewers

---

## 5. Versioning and Changelog

### Bumping Version

Every time you modify a workflow:
1. Increment the `version` field
2. Add a changelog entry to your memory or to the workflow file

### Changelog Format

```yaml
changelog:
  - version: 2
    date: "2026-03-23"
    by: ceo
    change: "Added security review step between code_review and deploy"
    proposed_by: reviewer
  - version: 1
    date: "2026-03-20"
    by: ceo
    change: "Initial workflow creation"
```

---

## 6. When to Change a Workflow

Monitor these signals:
- **Bottleneck**: more than 3 tasks stuck at the same step
- **High rejection rate**: step rejection rate exceeds 40%
- **Agent feedback**: agents repeatedly report issues with a step
- **Timeout frequency**: step regularly hits timeout
- **Skip rate**: step is routinely marked done without real work

---

## 7. How to Propose Changes

### WORKFLOW_CHANGE_PROPOSAL Format

```yaml
workflow: development
step: code_review
proposed_change: "Split code_review into security_review + code_review"
reason: "Security issues caught too late, 4 incidents in 2 weeks"
impact: "Adds ~30min to workflow, reduces security incidents"
evidence:
  - task-abc123 (security bug found in production)
  - task-def456 (vulnerability missed in review)
type: structural    # minor | structural
```

- **Minor changes** (CEO can apply directly): timeout change, description update, reviewer role change
- **Structural changes** (need human approval): add/remove step, change gates, change flow direction

---

## 8. Example Workflows

### 8.1 Development Workflow (12 steps)

```yaml
id: development
steps:
  - { id: scope, type: agent, assigned_role: strategist, transitions: { done: plan } }
  - { id: plan, type: agent, assigned_role: planner, transitions: { done: plan_review } }
  - { id: plan_review, type: agent, assigned_role: reviewer, review: { min_approvals: 1 }, transitions: { approved: implement, rejected: plan } }
  - { id: implement, type: agent, assigned_role: developer, transitions: { done: code_review } }
  - { id: code_review, type: agent, assigned_role: reviewer, review: { min_approvals: 1 }, transitions: { approved: human_merge, rejected: implement } }
  - { id: human_merge, type: human_gate, gate: merge, transitions: { approved: deploy_staging, rejected: implement } }
  - { id: deploy_staging, type: agent, assigned_role: devops, transitions: { done: verify } }
  - { id: verify, type: agent, assigned_role: devops, transitions: { done: human_deploy_prod, failed: deploy_staging } }
  - { id: human_deploy_prod, type: human_gate, gate: deploy, transitions: { approved: deploy_prod, rejected: verify } }
  - { id: deploy_prod, type: agent, assigned_role: devops, transitions: { done: announce } }
  - { id: announce, type: agent, assigned_role: marketing, transitions: { done: complete } }
  - { id: complete, type: terminal, terminal: true, transitions: {} }
```

### 8.2 Marketing Workflow (7 steps)

```yaml
id: marketing
steps:
  - { id: brief, type: agent, assigned_role: strategist, transitions: { done: draft } }
  - { id: draft, type: agent, assigned_role: marketing, transitions: { done: design } }
  - { id: design, type: agent, assigned_role: design, transitions: { done: review } }
  - { id: review, type: agent, assigned_role: reviewer, review: { min_approvals: 1 }, transitions: { approved: human_approve, rejected: draft } }
  - { id: human_approve, type: human_gate, gate: publish, transitions: { approved: publish, rejected: draft } }
  - { id: publish, type: agent, assigned_role: marketing, transitions: { done: complete } }
  - { id: complete, type: terminal, terminal: true, transitions: {} }
```

### 8.3 Incident Response Workflow (9 steps)

```yaml
id: incident
steps:
  - { id: triage, type: agent, assigned_role: devops, transitions: { done: investigate } }
  - { id: investigate, type: agent, assigned_role: developer, transitions: { done: fix } }
  - { id: fix, type: agent, assigned_role: developer, transitions: { done: review_fix } }
  - { id: review_fix, type: agent, assigned_role: reviewer, review: { min_approvals: 1 }, transitions: { approved: deploy_fix, rejected: fix } }
  - { id: deploy_fix, type: agent, assigned_role: devops, transitions: { done: verify_fix } }
  - { id: verify_fix, type: agent, assigned_role: devops, transitions: { done: human_confirm, failed: fix } }
  - { id: human_confirm, type: human_gate, gate: incident_resolved, transitions: { approved: postmortem, rejected: investigate } }
  - { id: postmortem, type: agent, assigned_role: strategist, transitions: { done: complete } }
  - { id: complete, type: terminal, terminal: true, transitions: {} }
```
