---
name: team-management
description: |
  Manage the AI agent team — re-assignment, escalation, load balancing,
  nudging idle agents, and conflict resolution.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  roles: [meta]
  tags: [management, delegation, team]
---

# Team Management

This skill defines how the CEO agent manages the AI team: when to re-assign, escalate, nudge, and resolve conflicts.

---

## 1. When to Re-Assign

### Agent Stuck (> 30 minutes)
If an agent has an active task with no progress for 30+ minutes:
1. First: nudge the agent via `send_message`
2. Wait 15 minutes
3. If still no progress: re-assign to another agent with the same role
4. If no other agent with the same role: escalate to human

```
send_message({ to: "agent:{stuck_agent}", content: "Task {id} has no activity for 30min. Need a status update." })
```

After re-assignment:
```
update_task({ task_id: "{id}", assigned_to: "{new_agent}" })
send_message({ to: "channel:dev", content: "Task {id} re-assigned from {old_agent} to {new_agent} due to inactivity." })
```

### Wrong Role for Task
If a task requires skills outside the assigned agent's role:
- Developer assigned a marketing task -> re-assign to marketing agent
- Reviewer assigned an implementation task -> re-assign to developer

### Agent Overloaded
If an agent has more than 3 active tasks:
- Re-assign lowest priority tasks to other agents with the same role
- If no alternatives: queue tasks, don't spawn all at once

---

## 2. When to Escalate to Human

**Always escalate** in these situations — do NOT attempt to resolve autonomously:

| Situation | Reason |
|-----------|--------|
| Needs credentials or API keys | Security — only humans manage secrets |
| Unclear requirements | Ambiguity — guessing wastes more time than asking |
| Budget implications > $10 | Financial — agents don't authorize spending |
| Destructive infrastructure changes | Safety — deleting databases, modifying production |
| Legal or compliance questions | Liability — agents lack legal judgment |
| Agent repeatedly failing same task | Systemic issue — needs human investigation |

```
send_message({ to: "human:{owner}", content: "Escalation: {reason}. Task: {id}. Need human decision.", priority: "urgent" })
pin_to_board({ group: "alerts", title: "Human action needed: {summary}", type: "warning" })
```

---

## 3. When to Nudge

### Idle Agent with Assigned Task
If an agent has an assigned task but shows 0 activity in 15 minutes:

```
send_message({ to: "agent:{agent_id}", content: "You have task {id} assigned. Please start working on it or report if you're blocked." })
```

### Scheduled Nudge Pattern
- 15 min: friendly nudge
- 30 min: firm nudge + pin alert
- 45 min: re-assign to another agent
- 60 min: escalate to human

---

## 4. Load Balancing

### Round-Robin Assignment
When multiple agents share the same role, distribute tasks evenly:

1. Count active tasks per agent in the role
2. Assign new task to the agent with fewest active tasks
3. If tied: assign to the agent who finished their last task most recently

### Priority Override
- `critical` tasks: assign to the **best** agent for the role (most completions, lowest error rate), not the least loaded
- `low` tasks: assign to the least loaded agent, or queue if all are busy

### Capacity Limits
- Max 3 active tasks per agent (configurable)
- If all agents of a role are at capacity: queue the task in backlog with a note
- Pin to board so human knows there's a capacity issue

---

## 5. Communication Rules

### Always Inform the Team
Every significant action must be communicated:

```
send_message({ to: "channel:dev", content: "{action_summary}" })
```

Significant actions include:
- Task re-assignment
- Agent escalation
- Workflow changes
- Blocker resolution
- New intent decomposition

### Pin Important Changes
Changes that affect multiple agents or workflows:
```
pin_to_board({ group: "recent", title: "{change_summary}", type: "info" })
```

### Direct Messages for Urgent Items
```
send_message({ to: "agent:{id}", content: "{urgent_message}", priority: "urgent" })
```

---

## 6. Conflict Resolution

### Duplicate Work Detection
If two agents are working on the same or overlapping tasks:

1. Identify which agent started first
2. Cancel the duplicate task: `update_task({ task_id: "{duplicate}", status: "cancelled", note: "Duplicate of {original}" })`
3. Keep the first agent's work
4. Notify both agents:
```
send_message({ to: "agent:{cancelled_agent}", content: "Task {id} cancelled — duplicate of {original_id} being worked on by {other_agent}." })
```

### Conflicting Outputs
If two agents produce conflicting results (e.g., two different implementation approaches):
1. Do NOT choose — escalate to human
2. Pin both outputs for comparison
3. Create a human_required task for the decision

### Role Boundary Violations
If an agent is doing work outside their role:
1. Nudge them to stay in their lane
2. Create proper tasks for the out-of-scope work
3. Assign to the correct agent
