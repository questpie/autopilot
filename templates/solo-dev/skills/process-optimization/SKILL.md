---
name: process-optimization
description: |
  Analyze workflow performance, detect bottlenecks, and propose
  evidence-based improvements to workflows and processes.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  roles: [meta]
  tags: [optimization, metrics, workflow]
---

# Process Optimization

This skill defines how to analyze workflow performance, detect bottlenecks, and propose evidence-based improvements.

---

## 1. Key Metrics

Track these metrics across all workflows:

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Avg time per step | `completed_at - started_at` for each step | Varies by step type |
| Rejection rate per step | `rejected / (approved + rejected)` at review gates | < 40% |
| Blocker count per week | Tasks moved to `blocked/` | < 3 |
| Timeout rate | Tasks that hit timeout | < 10% |
| Cycle time | Time from first step to terminal | Decreasing trend |
| Re-assignment rate | Tasks re-assigned mid-workflow | < 15% |

---

## 2. Bottleneck Detection

### Identifying Bottlenecks

A step is a **bottleneck** when:
- It is the **longest step** in the workflow by average duration
- More than **3 tasks** are queued at this step simultaneously
- It accounts for more than **50%** of total workflow cycle time

### Analysis Process

1. List all completed tasks for a workflow in the past week
2. For each task, calculate time spent at each step
3. Aggregate: average, median, p95 per step
4. Identify the step with highest average time
5. Check if the bottleneck is due to:
   - Agent capacity (too many tasks, not enough agents)
   - Task complexity (step does too much)
   - Review loops (high rejection rate causing rework)
   - Dependency waits (blocked on external input)

### Common Fixes

| Cause | Fix |
|-------|-----|
| Agent capacity | Add another agent with the same role |
| Task complexity | Split the step into 2 smaller steps |
| Review loops | Improve instructions for the producing step |
| Dependency waits | Reorder steps to parallelize where possible |

---

## 3. Evidence-Based Improvements

Every optimization proposal MUST reference specific evidence:

- **Task IDs** that demonstrate the problem
- **Time measurements** showing the impact
- **Frequency** of the issue (one-off vs. recurring)
- **Comparison** with expected/target performance

Never propose changes based on hunches. Always cite data.

---

## 4. WORKFLOW_CHANGE_PROPOSAL Format

When proposing a workflow change, use this structure:

```yaml
workflow: development
step: code_review
proposed_change: "Add automated lint check before code_review to reduce trivial rejections"
reason: "60% of code_review rejections are for linting issues (12 out of 20 rejections this week)"
impact: "Reduces code_review cycle by ~20min avg, frees reviewer for substantive issues"
evidence:
  - task-abc123: "rejected for missing semicolons"
  - task-def456: "rejected for unused imports"
  - task-ghi789: "rejected for formatting issues"
type: structural
```

### Change Types

#### Minor Changes (CEO applies directly)
- Timeout adjustments (increase or decrease)
- Description or instruction updates
- Reviewer role changes
- Priority threshold changes

#### Structural Changes (require human approval)
- Adding or removing steps
- Changing gate requirements (min_approvals, reviewers)
- Changing flow direction (reordering steps)
- Adding or removing review gates
- Changing assigned roles for steps

---

## 5. Optimization Cycle

### Weekly Review
1. Collect metrics for all active workflows
2. Identify top 3 bottlenecks
3. For each bottleneck, propose a fix with evidence
4. Apply minor fixes immediately
5. Create WORKFLOW_CHANGE_PROPOSAL for structural fixes
6. Pin optimization report to board

### Monthly Review
1. Compare current metrics with previous month
2. Evaluate impact of changes applied
3. Identify systemic patterns (same step always slow?)
4. Propose process-level changes if needed
5. Review agent performance patterns

---

## 6. Anti-Patterns to Watch For

- **Over-optimization**: changing workflows too frequently disrupts agents
- **Premature optimization**: changing based on < 5 data points
- **Metric gaming**: agents marking tasks done without real completion
- **Review fatigue**: too many review gates slow everything down
- **Scope creep**: steps gradually accumulate more responsibilities

---

## 7. Reporting

Pin optimization findings to the dashboard:

```
pin_to_board({
  group: "overview",
  title: "Workflow Optimization Report",
  type: "info",
  content: "Development workflow: avg cycle 4.2h (target: 4h)\nBottleneck: code_review (avg 45min)\nProposal: add lint step before review\n3 minor fixes applied this week"
})
```
