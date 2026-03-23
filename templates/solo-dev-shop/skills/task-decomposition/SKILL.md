---
name: task-decomposition
description: |
  Decompose high-level intents into atomic, actionable subtasks with
  proper dependencies, assignments, and workflow configuration.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  roles: [meta]
  tags: [planning, decomposition, delegation]
---

# Task Decomposition

This skill defines how to break down human intents and high-level tasks into atomic, actionable subtasks that can be executed by individual agents.

---

## 1. Principles

- **Atomic**: each task has ONE clear deliverable
- **Measurable**: completion criteria are objective, not subjective
- **Assigned**: every task has an `assigned_to` and a `workflow`
- **Ordered**: dependencies are explicit via `depends_on`
- **Traceable**: every subtask links back to the parent intent

---

## 2. Required Fields for Every Task

Every task created during decomposition MUST have:

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Clear, action-oriented title | "Implement Stripe checkout flow" |
| `type` | Task category | `planning`, `implementation`, `review`, `deployment` |
| `assigned_to` | Agent ID or role | `max` or role-matched |
| `workflow` | Workflow to follow | `development` |
| `depends_on` | Array of prerequisite task IDs | `[task-abc123]` |
| `priority` | Urgency level | `medium`, `high`, `critical` |

---

## 3. Decomposition Pattern: "Build X"

When a human says "Build X", decompose into this standard chain:

### Step 1: Scope
```
create_task({
  title: "Scope X requirements",
  type: "planning",
  assigned_to: "{strategist_id}",
  workflow: "development",
  priority: "high",
  description: "Analyze requirements for X. Define acceptance criteria, edge cases, and constraints."
})
```

### Step 2: Plan
```
create_task({
  title: "Plan X implementation",
  type: "planning",
  assigned_to: "{planner_id}",
  workflow: "development",
  depends_on: ["{scope_task_id}"],
  description: "Create detailed implementation plan based on the scope document."
})
```

### Step 3: Implement
```
create_task({
  title: "Implement X",
  type: "implementation",
  assigned_to: "{developer_id}",
  workflow: "development",
  depends_on: ["{plan_task_id}"],
  description: "Write code according to the implementation plan."
})
```

### Step 4: Review
```
create_task({
  title: "Review X implementation",
  type: "review",
  assigned_to: "{reviewer_id}",
  workflow: "development",
  depends_on: ["{impl_task_id}"],
  description: "Review code quality, architecture, and test coverage."
})
```

### Step 5: Deploy
```
create_task({
  title: "Deploy X",
  type: "deployment",
  assigned_to: "{devops_id}",
  workflow: "development",
  depends_on: ["{review_task_id}"],
  description: "Deploy to staging, verify, then deploy to production."
})
```

---

## 4. Decomposition Patterns by Type

### Feature Request
Full chain: scope -> plan -> implement -> review -> deploy -> announce
- 5-6 subtasks
- Always starts with strategist scoping

### Bug Fix
Shortened chain: investigate -> fix -> review -> deploy
- 3-4 subtasks
- Skip scoping, go straight to investigation by developer
- Higher default priority

```
create_task({ title: "Investigate bug: {description}", type: "implementation", assigned_to: "{developer_id}", workflow: "development", priority: "high" })
create_task({ title: "Fix bug: {description}", type: "implementation", assigned_to: "{developer_id}", depends_on: ["{investigate_id}"] })
create_task({ title: "Review fix: {description}", type: "review", assigned_to: "{reviewer_id}", depends_on: ["{fix_id}"] })
create_task({ title: "Deploy fix: {description}", type: "deployment", assigned_to: "{devops_id}", depends_on: ["{review_id}"] })
```

### Content / Marketing
Chain: brief -> draft -> design -> review -> publish
- Marketing workflow instead of development

```
create_task({ title: "Write brief for {topic}", type: "planning", assigned_to: "{strategist_id}", workflow: "marketing" })
create_task({ title: "Draft content: {topic}", type: "marketing", assigned_to: "{marketing_id}", depends_on: ["{brief_id}"], workflow: "marketing" })
create_task({ title: "Design assets: {topic}", type: "marketing", assigned_to: "{design_id}", depends_on: ["{draft_id}"], workflow: "marketing" })
```

### Design Task
Chain: research -> wireframe -> design -> review
- Design-focused, involves design agent early

### Infrastructure
Chain: plan -> implement -> verify -> document
- DevOps-focused, always requires human gate before production changes
- Always set priority to `high` for infra changes

---

## 5. After Decomposition

Once all subtasks are created:

1. **Update the original intent task:**
```
update_task({ task_id: "{intent_task_id}", status: "done", note: "Decomposed into {count} subtasks: {task_ids}" })
```

2. **Notify the team:**
```
send_message({ to: "channel:dev", content: "Intent '{intent_title}' decomposed into {count} tasks. First task assigned to {first_agent}." })
```

3. **Pin summary to board:**
```
pin_to_board({
  group: "recent",
  title: "Intent decomposed: {intent_title}",
  type: "info",
  content: "Created {count} subtasks:\n- {task_1_title} ({task_1_assigned})\n- {task_2_title} ({task_2_assigned})\n..."
})
```

---

## 6. Anti-Patterns

- **Too granular**: "Write line 42 of file X" — tasks should be meaningful units of work
- **Too vague**: "Make it better" — tasks need specific, measurable deliverables
- **Missing dependencies**: parallel tasks that actually need sequential execution
- **Wrong agent**: assigning code review to marketing agent
- **No workflow**: every task needs a workflow or it will be orphaned
- **Circular dependencies**: task A depends on B, B depends on A
