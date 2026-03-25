---
name: ceo-watchdog
description: |
  Monitor company health — detect stuck tasks, idle agents, stale work.
  Scan every 10 minutes, take corrective action, pin summary to board.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  roles: [meta]
  tags: [monitoring, health, maintenance]
---

# CEO Watchdog — Health Check Procedure

This skill defines the complete health check procedure for the CEO agent. Execute this when triggered by the `ceo-watchdog` schedule (every 10 minutes) or when manually invoked.

---

## 1. What to Check

Scan all task directories: `active/`, `backlog/`, `blocked/`, `review/`.

### 1.1 Stuck Tasks

A task is **stuck** when:
- Status is `assigned` or `in_progress` for more than **30 minutes** without activity
- Last history entry timestamp is older than 30 minutes
- No recent messages from the assigned agent about this task

**Action:**
```
send_message({ to: "agent:{assigned_to}", content: "Task {id} '{title}' needs attention — no activity for 30+ minutes. Please update status or report blockers." })
```

If the agent does not respond within 15 minutes of the nudge, escalate:
```
pin_to_board({ group: "alerts", title: "Stuck task: {title}", type: "warning", content: "Agent {assigned_to} unresponsive on task {id}. May need re-assignment." })
```

### 1.2 Tasks Without Workflow

A task is **missing workflow** when:
- It has no `workflow` field set
- It is in `backlog/` or `active/` (not `done/`)

**Action:**
```
update_task({ task_id: "{id}", workflow: "development", workflow_step: "scope" })
send_message({ to: "channel:dev", content: "Task {id} had no workflow assigned. Set to development/scope." })
```

### 1.3 Tasks in Wrong State

A task is in the **wrong state** when:
- Status is `assigned` but no `assigned_to` field
- Status is `in_progress` but no `workflow_step`
- Status is `done` but task file is in `active/` folder

**Action:**
- Missing `assigned_to` on assigned task: assign to the role from the workflow step, or to CEO if no workflow
- Missing `workflow_step`: set to first step of the workflow
- Wrong folder: move task to correct folder via `update_task`

### 1.4 Idle Agents with Active Tasks

An agent is **idle** when:
- There are tasks in `active/` assigned to them
- No session logs from that agent in the last 15 minutes
- Agent was not recently spawned (check session logs)

**Action:**
```
send_message({ to: "agent:{agent_id}", content: "You have {count} active tasks. Please pick up task {id} or report if blocked." })
```

### 1.5 Orphan Subtasks

A subtask is **orphaned** when:
- Its `parent` field references a task that is `done` or `cancelled`
- The subtask itself is still in `backlog/` or `assigned/`

**Action:**
- If the subtask is still relevant: assign it and start workflow
- If parent is cancelled: cancel the subtask too
```
update_task({ task_id: "{subtask_id}", status: "assigned", assigned_to: "{appropriate_agent}" })
send_message({ to: "channel:dev", content: "Orphan subtask {subtask_id} re-assigned after parent {parent_id} completed." })
```

### 1.6 Unresolved Blockers

A blocker is **stale** when:
- Task status is `blocked`
- The blocker has been unresolved for more than **1 hour**
- No recent messages about the blocker

**Action:**
```
pin_to_board({ group: "alerts", title: "Blocker needs human attention", type: "warning", content: "Task {id} blocked for 1+ hour: {blocker_reason}. Assigned to: {blocker_assigned_to}" })
send_message({ to: "human:{owner}", content: "Task {id} has been blocked for over 1 hour. Blocker: {reason}. Please intervene.", priority: "urgent" })
```

---

## 2. Health Check Summary

After every scan, pin a summary to the board. This replaces the previous health check pin.

```
pin_to_board({
  group: "overview",
  title: "CEO Health Check",
  type: "success",
  content: "{active_count} tasks active, {stuck_count} stuck, {reassigned_count} re-assigned, {blocked_count} blocked, {orphan_count} orphans resolved"
})
```

If any issues were found, use type `"warning"` instead of `"success"`.

---

## 3. Escalation Rules

| Severity | Condition | Action |
|----------|-----------|--------|
| Low | Task idle 15min | Nudge agent |
| Medium | Task stuck 30min | Nudge + pin alert |
| High | Task stuck 1h | Re-assign to another agent with same role |
| Critical | Blocker unresolved 1h | Pin alert + message human with urgent priority |
| Critical | Agent unresponsive after 2 nudges | Alert human, pause agent tasks |

---

## 4. Post-Check Actions

1. Update your memory with findings: patterns of stuck tasks, frequently blocked agents
2. If the same task gets stuck repeatedly (3+ times), create a meta-task to investigate
3. If an agent is consistently slow, note it for the weekly review
4. Clean up resolved alerts from the dashboard
