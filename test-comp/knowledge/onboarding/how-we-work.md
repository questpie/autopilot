# How We Work - MANDATORY Rules

> CRITICAL: Every agent MUST follow these rules. Non-compliance breaks the workflow.

## Your Available Tools

You have access to these tools via the `autopilot` MCP server. Use them - they are the ONLY way to produce visible effects.

### Unified Tools
- `task({ action, ... })` - Create, update, approve, reject, block, and unblock tasks
- `message({ channel, content, references? })` - Send to `general`, `task-{id}`, `project-{name}`, or `dm-{agentId}`
- `pin({ action, ... })` - Create or remove dashboard pins for human visibility
- `search({ query, type?, scope?, limit? })` - Search tasks, messages, knowledge, pins, agents, channels, skills
- `http({ method, url, headers?, body?, secret_ref? })` - Call external APIs
- `search_web({ query, max_results? })` - Search public web sources
- `browse({ url, extract?, screenshot? })` - Browse and extract web page content

### Files (built-in)
- `Read`, `Write`, `Edit`, `Glob`, `Grep` - File operations on the company filesystem
- `Bash` - Run shell commands

## MANDATORY: What You MUST Do After Every Task

When you finish working on a task, you MUST do ALL of these in order:

### Step 1: Update the task status
```
task({ action: "update", task_id: "task-xxx", status: "done", note: "Brief summary of what was done" })
```

### Step 2: Notify the team
```
message({
  channel: "general",
  content: "Completed [task title]. Output: [path to file]. Ready for next step.",
  references: ["task-xxx", "/path/to/output"]
})
```

### Step 3: Pin for human visibility (if the output is important)
```
pin({
  action: "create",
  group: "recent",
  title: "[Task title] - Done",
  content: "Output at /path/to/file",
  type: "success"
})
```

**If you skip these steps, the workflow engine cannot route work to the next agent.**

## Workflow Steps - What Each Role Does

### Scope (strategist)
1. Read the task description and any references
2. Search for relevant context: `search({ query: "...", type: "knowledge" })`
3. Write a spec document to `/projects/{project}/specs/{name}.md`
4. **Update task**: `task({ action: "update", task_id, status: "done", note: "Spec written at /projects/..." })`
5. **Notify**: `message({ channel: "general", content: "Spec ready: /projects/..." })`
6. **Pin**: `pin({ action: "create", group: "recent", title: "Spec: [title]", type: "success" })`

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
3. If approved: `task({ action: "approve", task_id, note: "Approved" })`
4. If rejected: `task({ action: "reject", task_id, reason: "Changes needed: ..." })`
5. **Notify + pin**

### Deploy (devops)
1. Read deployment configs
2. Deploy to staging first
3. Verify health checks
4. **Update task + notify + pin**

## When You're Stuck

If you cannot complete your work:
```
task({
  action: "block",
  task_id: "task-xxx",
  reason: "Cannot access GitHub repo - need admin credentials",
  blocker_assigned_to: "human"
})
```
This creates a blocker and pauses the workflow.

## Storage Model

Most operational state is stored in SQLite (`/.data/autopilot.db`):

- Tasks and workflow state
- Messages and channels
- Activity feed and pins
- Sessions and auth data

Filesystem paths are used mainly for durable documents and config:

```
/company.yaml    - Company configuration
/team/           - Agent definitions and role prompts
/knowledge/      - Searchable markdown knowledge base
/projects/       - Specs/plans/code/artifacts created by work
/secrets/        - API keys and integration secrets
/dashboard/      - Dashboard config/content (if used)
/context/memory/ - Agent memory snapshots (managed by orchestrator)
```

## Rules

1. **Always update task status when done.** The workflow engine depends on this.
2. **Always notify via channel.** Other agents and the human need to know.
3. **Always pin important outputs.** The human checks the board.
4. **Never read another agent's memory directly.** Use `message({ channel: "dm-{agentId}", ... })` when needed.
5. **Reference files and task IDs** in all messages.
6. **Use conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`.
7. **Write QUESTPIE in ALL CAPS.**
