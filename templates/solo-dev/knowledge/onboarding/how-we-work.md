# How We Work — MANDATORY Rules

> CRITICAL: Every agent MUST follow these rules. Non-compliance breaks the workflow.

## Your Available Tools

You have access to these tools via the `autopilot` MCP server. Use them — they are the ONLY way to produce visible effects.

### Communication
- `send_message({ to, content })` — Send to `channel:dev`, `channel:general`, `agent:{id}`, or `human:{id}`
- `ask_agent({ to, question, reason })` — Ask another agent for info they have

### Tasks
- `create_task({ title, type, assigned_to, workflow })` — Create a new task
- `update_task({ task_id, status, note })` — Update task status (MUST do when done)
- `add_blocker({ task_id, reason, assigned_to })` — Escalate to human when stuck
- `resolve_blocker({ task_id, note })` — Mark a blocker as resolved

### Dashboard
- `pin_to_board({ group, title, type, content })` — Pin for human visibility (MUST do for important outputs)
- `unpin_from_board({ pin_id })` — Remove a pin

### Knowledge
- `search_knowledge({ query })` — Search company knowledge base
- `update_knowledge({ path, content, reason })` — Add/update knowledge docs
- `skill_request({ skill_id })` — Load a skill for guidance

### External
- `http_request({ method, url, secret_ref })` — Call external APIs
- `create_artifact({ name, type, files })` — Create a previewable artifact

### Files (built-in)
- `Read`, `Write`, `Edit`, `Glob`, `Grep` — File operations on the company filesystem
- `Bash` — Run shell commands

## MANDATORY: What You MUST Do After Every Task

When you finish working on a task, you MUST do ALL of these in order:

### Step 1: Update the task status
```
update_task({ task_id: "task-xxx", status: "done", note: "Brief summary of what was done" })
```

### Step 2: Notify the team
```
send_message({
  to: "channel:dev",
  content: "Completed [task title]. Output: [path to file]. Ready for next step.",
  references: ["task-xxx", "/path/to/output"]
})
```

### Step 3: Pin for human visibility (if the output is important)
```
pin_to_board({
  group: "recent",
  title: "[Task title] — Done",
  content: "Output at /path/to/file",
  type: "success"
})
```

**If you skip these steps, the workflow engine cannot route work to the next agent.**

## Workflow Steps — What Each Role Does

### Scope (strategist)
1. Read the task description and any references
2. Search knowledge base for relevant context: `search_knowledge({ query: "..." })`
3. Write a spec document to `/projects/{project}/specs/{name}.md`
4. **Update task**: `update_task({ task_id, status: "done", note: "Spec written at /projects/..." })`
5. **Notify**: `send_message({ to: "channel:dev", content: "Spec ready: /projects/..." })`
6. **Pin**: `pin_to_board({ group: "recent", title: "Spec: [title]", type: "success" })`

### Plan (planner)
1. Read the spec document referenced in the task
2. Create an implementation plan at `/projects/{project}/plans/{name}.md`
3. Include: file changes needed, dependencies, test strategy, estimated complexity
4. **Update task + notify + pin** (same 3-step pattern)

### Implement (developer)
1. Read the spec and plan
2. Write code, create files, run tests
3. Create a git branch if working in a code repo
4. **Update task + notify + pin**

### Review (reviewer)
1. Read the code changes and the spec
2. Check: correctness, security, performance, readability, tests
3. If approved: `update_task({ task_id, status: "done", note: "Approved" })`
4. If rejected: `update_task({ task_id, status: "blocked", note: "Changes needed: ..." })`
5. **Notify + pin**

### Deploy (devops)
1. Read deployment configs
2. Deploy to staging first
3. Verify health checks
4. **Update task + notify + pin**

## When You're Stuck

If you cannot complete your work:
```
add_blocker({
  task_id: "task-xxx",
  reason: "Cannot access GitHub repo — need admin credentials",
  assigned_to: "human"
})
```
This pins a blocker for the human and pauses the workflow.

## Filesystem Structure

```
/tasks/          — Your assigned tasks (YAML files)
/comms/          — Team communication channels
/knowledge/      — Company knowledge base (searchable)
/projects/       — Project specs, plans, code, design, marketing
/context/memory/ — Your private persistent memory (auto-managed)
/secrets/        — API keys (managed by human)
/dashboard/pins/ — Board items visible to human
/logs/           — Activity feed
```

## Rules

1. **Always update task status when done.** The workflow engine depends on this.
2. **Always notify via channel.** Other agents and the human need to know.
3. **Always pin important outputs.** The human checks the board.
4. **Never read another agent's memory.** Use `ask_agent` if you need their info.
5. **Reference files and task IDs** in all messages.
6. **Use conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`.
7. **Write QUESTPIE in ALL CAPS.**
