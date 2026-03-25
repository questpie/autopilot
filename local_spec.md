# QUESTPIE Autopilot — Local Testing Specification

## System Overview

QUESTPIE Autopilot is an AI-native company operating system where AI agents run operations.
- **CLI** (`@questpie/autopilot`) — init, start, manage company
- **Orchestrator** — Hono REST API (port 7778), webhook server (port 7777), agent spawner, scheduler, watcher
- **Dashboard** — TanStack Start React app (port 3001), real-time via SSE
- **Storage** — SQLite (.data/autopilot.db) for tasks/messages/activity, filesystem for config/knowledge/skills

## Architecture

```
CLI ──→ Orchestrator (API + Agent Spawner + Scheduler + Watcher + Webhooks)
              ↓                    ↓                ↓
         SQLite DB          Agent Sessions     Filesystem
         (tasks,            (Claude SDK,       (company.yaml,
          messages,          Codex SDK)         team/, knowledge/,
          activity)                             skills/, dashboard/)
              ↓
         Dashboard (SSE real-time)
```

---

## Epic 1: CLI — Company Initialization

### Story 1.1: Init new company
```
GIVEN I have autopilot installed globally
WHEN I run `autopilot init "Acme Corp"`
THEN a directory `acme-corp/` is created with:
  - company.yaml (name: "Acme Corp", slug: "acme-corp")
  - team/ (agents.yaml, humans.yaml, roles.yaml, schedules.yaml, webhooks.yaml, workflows/, policies/)
  - knowledge/ (brand/, business/, technical/, onboarding/, integrations/)
  - skills/ (20 SKILL.md files in agentskills.io format)
  - dashboard/ (.artifact.yaml, groups.yaml, widgets/, pages/, overrides/)
  - Runtime dirs with .gitkeep: tasks/{backlog,active,review,blocked,done}, comms/{channels/general,channels/dev,direct}, logs/{activity,sessions,errors}, context/memory, secrets, projects, infra
  - .gitignore (ignores .data/, secrets/.master-key, logs/sessions/*.jsonl)
  - .claude/skills → ../skills symlink
  - Git repo initialized with initial commit
```

### Story 1.2: Init with --force overwrites existing
```
GIVEN directory `acme-corp/` already exists
WHEN I run `autopilot init "Acme Corp" --force`
THEN directory is overwritten with fresh template
```

### Story 1.3: Init without arguments uses default name
```
WHEN I run `autopilot init`
THEN company "My Company" with slug "my-company" is created
```

---

## Epic 2: CLI — Provider Authentication

### Story 2.1: Provider login via subscription (Claude)
```
WHEN I run `autopilot provider login claude`
THEN it spawns `bunx claude login` interactively
AND prints login URL for headless/VPS environments
AND on success, Claude Agent SDK's query() uses cached credentials
```

### Story 2.2: Provider login via subscription (Codex)
```
WHEN I run `autopilot provider login codex`
THEN it spawns `bunx codex login` interactively
AND supports device code flow (URL + code for headless)
```

### Story 2.3: Provider set API key
```
WHEN I run `autopilot provider set claude --api-key sk-ant-xxx`
THEN ANTHROPIC_API_KEY=sk-ant-xxx is written to .env in company root
AND process.env is updated immediately
```

### Story 2.4: Provider status
```
WHEN I run `autopilot provider status`
THEN it shows for each provider (claude, codex):
  - API Key: set/not set (masked)
  - CLI Auth: configured/not configured (checks ~/.claude/ and ~/.codex/auth.json)
  - Source: .env file path or environment variable
```

### Story 2.5: Provider logout
```
WHEN I run `autopilot provider logout claude`
THEN ANTHROPIC_API_KEY is removed from .env
AND `bunx claude logout` is executed
AND credential files (~/.claude/) are removed
```

---

## Epic 3: Orchestrator — Startup & Health

### Story 3.1: Start orchestrator
```
GIVEN I am in a company directory with company.yaml
WHEN I run `autopilot start`
THEN orchestrator starts on port 7778
AND dashboard starts on port 3001
AND webhook server starts on port 7777
AND SQLite database is created at .data/autopilot.db
AND existing in_progress and backlog tasks are scanned
AND scheduler starts cron jobs from team/schedules.yaml
AND file watcher monitors tasks/, comms/, dashboard/, team/
```

### Story 3.2: Health check via API
```
WHEN I GET /api/status
THEN response contains:
  { company: "Acme Corp", agentCount: 8, activeTasks: N, runningSessions: N, pendingApprovals: N }
```

### Story 3.3: Status via CLI
```
WHEN I run `autopilot status`
THEN it displays company name, agent count, active tasks, running sessions
```

---

## Epic 4: Task Management

### Story 4.1: Create task via CLI
```
WHEN I run `autopilot ask "Build me a landing page"`
THEN a task is created in SQLite with:
  - type: "intent"
  - status: "backlog"
  - created_by: "human"
AND the CEO agent is spawned to process the intent
AND CEO decomposes into subtasks with appropriate workflows
```

### Story 4.2: Create task via API
```
WHEN I POST /api/tasks { title: "Fix bug", description: "...", type: "implementation", priority: "high" }
THEN task is created in SQLite
AND returned with generated id, created_at, status: "backlog"
AND if auto_assign is enabled, appropriate agent is assigned
```

### Story 4.3: List tasks via API
```
WHEN I GET /api/tasks?status=in_progress&agent=max
THEN returns filtered tasks from SQLite
AND supports status, agent, project query params
```

### Story 4.4: Approve task
```
GIVEN a task in "review" status
WHEN I POST /api/tasks/:id/approve
THEN task moves to "done" status
AND completed_at is set
AND history entry is appended
AND workflow evaluates next transition
```

### Story 4.5: Reject task
```
GIVEN a task in "review" status
WHEN I POST /api/tasks/:id/reject { reason: "Needs tests" }
THEN task moves to "blocked" status
AND blocker is created with reason
AND assigned agent is notified
```

### Story 4.6: Task lifecycle transitions
```
Lifecycle: draft → backlog → assigned → in_progress → review → done
                                          ↓
                                       blocked → (resolve) → in_progress
                                          ↓
                                       cancelled
```

### Story 4.7: Task with workflow
```
GIVEN a task with workflow: "development"
WHEN task progresses through workflow steps
THEN each step transition is evaluated:
  scope → plan → plan_review → implement → code_review → human_merge → deploy_staging → verify → human_deploy_prod → deploy_prod → announce → complete
AND human_gate steps require manual approval
AND agent steps auto-spawn appropriate agent
```

---

## Epic 5: Agent System

### Story 5.1: Agent spawning
```
GIVEN a task is assigned to agent "max" (developer)
WHEN the orchestrator spawns the agent
THEN context is assembled in 6 layers:
  1. Identity (~2K) — role prompt from @questpie/autopilot-agents
  2. Company State (~5K) — active tasks, messages, pins, team
  3. Agent Memory (~20K) — persistent memory from context/memory/max/memory.yaml
  4. Task Context (~15K) — current task details, blockers, dependencies
  5. Skills Discovery (~1K) — available skills for "developer" role
  6. Tool List — explicit CRITICAL reminder to call update_task, send_message, pin_to_board
AND provider's spawn() is called with assembled prompt + tools
AND session stream is opened for real-time attach
```

### Story 5.2: Agent tools — all 14 must work
```
Tools available to agents:
  1. send_message(from, channel?, to?, content, mentions?) → writes to SQLite messages
  2. ask_agent(from, to, content) → routes message to another agent
  3. create_task(title, description, type, priority?, assigned_to?, project?, workflow?) → SQLite
  4. update_task(id, status?, title?, description?, assigned_to?, priority?, note?) → SQLite
  5. add_blocker(task_id, reason, assigned_to, type?) → adds blocker to task
  6. resolve_blocker(task_id, blocker_index, note?) → resolves specific blocker
  7. pin_to_board(group, title, content, type?, metadata?) → writes YAML to dashboard/pins/
  8. unpin_from_board(id) → deletes pin YAML file
  9. create_artifact(id, files[{path, content}], serve?, build?, name?) → writes files + .artifact.yaml
  10. search_knowledge(query) → searches knowledge/ markdown files
  11. update_knowledge(path, content, title?) → writes/updates markdown in knowledge/
  12. skill_request(skill_id) → loads SKILL.md content with references
  13. search(query, type?, mode?, limit?) → unified FTS5 search across all entities
  14. http_request(url, method?, headers?, body?, secret_ref?) → external HTTP with optional secret injection
```

### Story 5.3: Agent memory extraction
```
GIVEN an agent session has completed
WHEN the orchestrator extracts memory
THEN Claude Haiku analyzes session events
AND extracts structured memory:
  - facts: { category: [items] }
  - decisions: [{ date, decision, reason, task? }]
  - patterns: [strings]
  - mistakes: [{ date, what, fix }]
AND memory is merged (append-only) into context/memory/{agentId}/memory.yaml
AND session summary is written to context/memory/{agentId}/sessions/{sessionId}.yaml
```

### Story 5.4: Agent providers
```
Providers:
  - claude-agent-sdk (default): uses @anthropic-ai/claude-agent-sdk query()
    - Includes built-in tools: Read, Write, Edit, Glob, Grep, Bash
    - Custom autopilot tools injected via MCP server
    - Works with subscription login OR ANTHROPIC_API_KEY
  - codex-sdk: uses @openai/codex-sdk
    - Spawns Codex CLI as child process
    - Custom tools described in system prompt
    - Works with subscription login OR OPENAI_API_KEY
```

### Story 5.5: Concurrent agent limit
```
GIVEN max_concurrent_agents: 5 in company.yaml
WHEN 6 agents try to spawn simultaneously
THEN only 5 run concurrently
AND the 6th waits until a slot is available
```

---

## Epic 6: Communication

### Story 6.1: Send message to channel
```
WHEN agent calls send_message(from: "max", channel: "dev", content: "PR ready for review")
THEN message is stored in SQLite with channel, timestamp, mentions
AND SSE event is broadcast to dashboard
AND relevant agents with triggers on "message_received" are notified
```

### Story 6.2: Direct message between agents
```
WHEN agent calls ask_agent(from: "ceo", to: "sam", content: "Prioritize the security audit")
THEN message is stored in SQLite as direct message
AND Sam agent is spawned to process the request
```

### Story 6.3: Chat from dashboard
```
WHEN user POST /api/chat { message: "What's the status of the landing page?", channel: "general" }
THEN message is routed to the most relevant agent
AND agent processes the message and responds
```

### Story 6.4: Mention-triggered agent spawn
```
WHEN a message contains @max
THEN Max agent is spawned with the message as context
AND the response is posted to the same channel
```

---

## Epic 7: Dashboard — Real-Time UI

### Story 7.1: Dashboard home
```
WHEN I open http://localhost:3001
THEN I see:
  - Company status card (agent count, active tasks, sessions)
  - Pin groups (alerts, overview, agents, recent) with agent-created pins
  - Activity feed (real-time via SSE)
  - Quick actions (new task, chat)
```

### Story 7.2: Task board (Kanban)
```
WHEN I navigate to /tasks
THEN I see tasks in columns by status: backlog, active, review, blocked, done
AND tasks show title, assignee avatar, priority badge, workflow step
AND I can click a task to see full detail
```

### Story 7.3: Task detail page
```
WHEN I navigate to /tasks/:taskId
THEN I see:
  - Title, description, status, priority, assignee
  - Workflow progress (current step highlighted)
  - Blockers (with resolve actions)
  - History timeline
  - Related tasks
  - Approve/reject buttons for review tasks
```

### Story 7.4: Agent list
```
WHEN I navigate to /agents
THEN I see all 8 agents with:
  - Avatar (generated from name)
  - Name, role, description
  - Current status (idle, running, etc.)
  - Provider (claude-agent-sdk / codex-sdk)
  - Active sessions
```

### Story 7.5: Chat interface
```
WHEN I navigate to /chat
THEN I see:
  - Channel list sidebar (general, dev, + custom)
  - Message thread with agent avatars
  - Input with @mention autocomplete
  - Real-time message updates via SSE
```

### Story 7.6: Inbox
```
WHEN I navigate to /inbox
THEN I see:
  - Tasks in "review" status (need approval)
  - Tasks in "blocked" status (need human input)
  - Action pins from agents
  - One-click approve/reject
```

### Story 7.7: Knowledge base browser
```
WHEN I navigate to /knowledge
THEN I see knowledge/ directory tree
AND can read markdown documents
AND documents are searchable via FTS
```

### Story 7.8: File browser
```
WHEN I navigate to /files
THEN I see company directory tree
AND can navigate directories, read files
AND can create/edit/delete files via API
```

### Story 7.9: Artifact viewer
```
WHEN I navigate to /artifacts
THEN I see list of generated artifacts
AND can start/stop artifact dev-servers
AND artifacts are accessible via proxy (ports 4100-4199)
```

### Story 7.10: Search
```
WHEN I navigate to /search?q=landing page
THEN unified FTS search returns:
  - Matching tasks (title, description)
  - Matching messages (content)
  - Matching knowledge docs (content)
  - Matching pins (title, content)
AND results show entity type, title, snippet, relevance score
```

### Story 7.11: Real-time updates
```
GIVEN dashboard is open
WHEN an agent creates a task, sends a message, or pins to board
THEN the dashboard updates in real-time via SSE (/api/events)
AND no page refresh is needed
AND toast notifications appear for important events
```

### Story 7.12: Settings
```
WHEN I navigate to /settings
THEN I can view/edit:
  - Company configuration
  - Auth settings
  - Agent providers
  - Embedding settings
```

### Story 7.13: Authentication flow
```
GIVEN auth.enabled: true in company.yaml
WHEN I open the dashboard
THEN I am redirected to /auth/login
AND I can login with email/password
AND after login, I have access based on my role
AND sessions can be listed and revoked via /api/sessions
```

---

## Epic 8: Workflows

### Story 8.1: Development workflow (12 steps)
```
GIVEN a task with workflow: "development"
THEN the following steps execute:

  1. scope (agent: planner) → Plan the scope
  2. plan (agent: planner) → Create implementation plan
  3. plan_review (human_gate) → Human approves plan
  4. implement (agent: developer) → Write code
  5. code_review (agent: reviewer) → Review code quality
  6. human_merge (human_gate) → Human approves merge
  7. deploy_staging (agent: devops) → Deploy to staging
  8. verify (agent: reviewer) → Verify staging deployment
  9. human_deploy_prod (human_gate) → Human approves production deploy
  10. deploy_prod (agent: devops) → Deploy to production
  11. announce (agent: marketing) → Write release notes
  12. complete (terminal) → Mark task done

Human gates pause and create blocker until human approves.
Agent steps auto-spawn the assigned role's agent.
```

### Story 8.2: Marketing workflow (7 steps)
```
Steps: brief → content_creation → design_assets → human_review → publish → monitor → complete
```

### Story 8.3: Incident workflow (8 steps)
```
Steps: triage → investigate → hotfix → quick_review → human_merge → deploy_hotfix → verify → complete
```

### Story 8.4: Workflow transitions with conditions
```
GIVEN a workflow step has transitions: { success: "next_step", failure: "fallback_step" }
WHEN the step completes
THEN the workflow engine evaluates transition conditions
AND moves the task to the appropriate next step
AND spawns the agent for the next step
```

---

## Epic 9: Scheduling & Automation

### Story 9.1: Cron-triggered agent spawn
```
GIVEN schedules.yaml has:
  - id: health-check, agent: ceo, cron: "*/5 * * * *"
WHEN the cron fires
THEN the CEO agent is spawned with health-check context
AND optionally creates a task if create_task: true
```

### Story 9.2: Daily standup
```
GIVEN schedule: daily-standup at "0 9 * * *"
WHEN 9 AM arrives
THEN CEO agent runs standup routine
AND reviews yesterday's progress, today's plan
AND posts summary to dashboard
```

### Story 9.3: File watcher triggers
```
GIVEN a watcher on tasks/ directory
WHEN a file changes in tasks/
THEN the orchestrator evaluates if an agent should be spawned
AND debounces rapid changes (default 10s)
```

---

## Epic 10: Webhooks

### Story 10.1: External webhook processing
```
GIVEN webhooks.yaml defines a GitHub webhook on path /github
WHEN POST /webhooks/github arrives with valid HMAC signature
THEN payload is validated against filters
AND specified agent is spawned with webhook context
AND optionally a task is created if create_task_if condition matches
```

### Story 10.2: Telegram webhook
```
GIVEN telegram webhook is configured with secret_ref
WHEN POST /webhooks/telegram arrives
THEN message is extracted from Telegram payload
AND routed to appropriate agent
```

---

## Epic 11: Skills System

### Story 11.1: Skill catalog loading
```
WHEN orchestrator starts
THEN skills are loaded from 3 sources (priority order):
  1. skills/{id}/SKILL.md (agentskills.io format with frontmatter)
  2. knowledge/**/*.md (legacy, with frontmatter)
  3. .claude/skills/**/*.md (Claude native)
AND each skill has: id, name, description, metadata (roles, tags)
```

### Story 11.2: Skill request by agent
```
WHEN agent calls skill_request(skill_id: "code-review")
THEN full SKILL.md content is returned
AND references/ directory listing is included
AND agent follows the skill's guidelines
```

### Story 11.3: Role-based skill filtering
```
WHEN context is assembled for agent with role "developer"
THEN only skills with matching roles in metadata are listed
AND agent can request any listed skill
```

### Story 11.4: Skills API
```
WHEN I GET /api/skills
THEN returns full skill catalog with id, name, description, format, metadata
```

---

## Epic 12: Knowledge Base

### Story 12.1: Search knowledge
```
WHEN agent calls search_knowledge(query: "deployment process")
THEN FTS5 index is searched across knowledge/ markdown files
AND matching documents are returned with snippets
```

### Story 12.2: Update knowledge
```
WHEN agent calls update_knowledge(path: "technical/api-docs.md", content: "# API\n...")
THEN file is written/updated at knowledge/technical/api-docs.md
AND search index is updated
AND git auto-commits the change
```

### Story 12.3: Knowledge indexing on startup
```
WHEN orchestrator starts
THEN all knowledge/ markdown files are reindexed into FTS5
AND unified search_index table is populated
```

---

## Epic 13: Dashboard Pins & Widgets

### Story 13.1: Agent pins to dashboard
```
WHEN agent calls pin_to_board(group: "alerts", title: "Deploy failed", type: "error", content: "...")
THEN YAML file is written to dashboard/pins/{id}.yaml
AND pin appears in dashboard alerts group in real-time
```

### Story 13.2: Pin with actions
```
WHEN agent creates pin with metadata.actions: [{ label: "Retry", action: "retry_deploy" }]
THEN pin shows action buttons in dashboard
AND clicking action triggers appropriate response
```

### Story 13.3: Pin expiration
```
WHEN agent creates pin with expires_at
THEN pin auto-disappears after expiration
```

### Story 13.4: Custom widgets
```
GIVEN dashboard/widgets/task-summary/widget.tsx exists
WHEN dashboard loads
THEN custom React widget is rendered
AND widget fetches data per its refresh interval (10s default)
```

### Story 13.5: Pin groups
```
GIVEN dashboard/groups.yaml defines: alerts (pos 0), overview (1), agents (2), recent (3)
WHEN pins are created with group: "alerts"
THEN they appear in the alerts section of the dashboard
```

---

## Epic 14: Artifacts

### Story 14.1: Agent creates artifact
```
WHEN agent calls create_artifact(id: "landing-page", files: [{path: "index.html", content: "..."}], serve: "npx serve .")
THEN files are written to artifacts/landing-page/
AND .artifact.yaml is created with serve command
AND artifact is registered in ArtifactRouter
```

### Story 14.2: Artifact cold-start
```
WHEN I POST /api/artifacts/landing-page/start
THEN ArtifactRouter allocates port (4100-4199)
AND runs build command (if defined)
AND runs serve command with {port} substituted
AND health-checks until ready
AND returns proxy URL
```

### Story 14.3: Artifact idle timeout
```
GIVEN artifact has been running for 5 minutes without requests
THEN artifact process is killed
AND port is released
AND next request will cold-start again
```

### Story 14.4: List artifacts
```
WHEN I GET /api/artifacts
THEN returns list of artifact configs from artifacts/ directory
AND shows running status for each
```

---

## Epic 15: Authentication & Authorization

### Story 15.1: First-time setup
```
GIVEN auth.enabled: true and no users exist
WHEN I run `autopilot auth setup`
THEN owner account is created with email/password
AND bearer token is returned and saved to ~/.autopilot/credentials.json
```

### Story 15.2: Login
```
WHEN I POST /api/auth/sign-in/email { email, password }
THEN bearer token is returned
AND session is created
```

### Story 15.3: RBAC enforcement
```
GIVEN user has role "member"
WHEN user tries to modify company settings
THEN 403 Forbidden (requires "company.configure" permission)
```

### Story 15.4: 2FA
```
WHEN I enable 2FA via `autopilot auth 2fa enable`
THEN TOTP URI is generated
AND backup codes are provided
AND subsequent logins require TOTP verification
```

### Story 15.5: Session management
```
WHEN I GET /api/sessions
THEN returns list of active sessions with id, createdAt, userAgent, ipAddress
WHEN I DELETE /api/sessions/:token
THEN specific session is revoked
```

### Story 15.6: Rate limiting
```
GIVEN rate limit: 20 req/min per IP
WHEN client exceeds 20 requests in 1 minute
THEN 429 Too Many Requests is returned
```

### Story 15.7: IP allowlist
```
GIVEN ip_allowlist: ["10.0.0.0/8"] in company.yaml
WHEN request comes from 192.168.1.1
THEN 403 Forbidden
```

---

## Epic 16: Git Integration

### Story 16.1: Auto-commit
```
WHEN an agent modifies files (knowledge, dashboard, artifacts)
THEN GitManager auto-commits with descriptive message
AND commit includes agent name and task context
```

### Story 16.2: Auto-push (optional)
```
GIVEN auto_push is configured
WHEN auto-commit happens
THEN changes are pushed to remote
```

---

## Epic 17: Docker Deployment

### Story 17.1: Docker run
```
WHEN I run `docker run -v ./my-company:/app/company -p 7778:7778 -p 3001:3001 questpie/autopilot:latest`
THEN orchestrator starts with company volume mounted
AND dashboard is accessible on port 3001
AND API is accessible on port 7778
AND SQLite DB is created inside the volume at .data/
```

### Story 17.2: Docker compose
```
WHEN I use docker-compose.yml with the orchestrator service
THEN image: questpie/autopilot:latest is pulled
AND volumes, ports, environment are configured
AND health check verifies /api/status
```

### Story 17.3: Install script
```
WHEN I run `curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash`
THEN Bun is installed (if missing)
AND @questpie/autopilot is installed globally
AND user is guided through init + provider login
```

---

## Epic 18: Real-Time Events (SSE)

### Story 18.1: Event stream
```
WHEN I GET /api/events (Accept: text/event-stream)
THEN SSE connection is established
AND events are received for:
  - task:created, task:updated, task:moved
  - message:sent
  - session:started, session:ended
  - pin:created, pin:removed
  - activity entries
AND heartbeat is sent every 30 seconds
```

### Story 18.2: Session attach
```
WHEN agent session is running
THEN real-time stream chunks are available:
  - type: "thinking" — agent's reasoning
  - type: "text" — agent's output
  - type: "tool_call" — tool invocations
  - type: "tool_result" — tool results
  - type: "status" — session status changes
AND CLI `autopilot attach <sessionId>` shows live output
AND dashboard shows live agent activity
```

---

## Epic 19: Search

### Story 19.1: Unified FTS search
```
WHEN I GET /api/search?q=landing+page&mode=fts
THEN FTS5 searches across:
  - Tasks (title, description)
  - Messages (content)
  - Knowledge documents (content)
  - Pins (title, content)
AND returns ranked results with snippets
```

### Story 19.2: Hybrid search
```
WHEN I GET /api/search?q=deploy+process&mode=hybrid
THEN combines FTS5 with semantic similarity (if embeddings configured)
AND returns deduplicated, re-ranked results
```

### Story 19.3: Type-filtered search
```
WHEN I GET /api/search?q=bug&type=task
THEN only tasks are searched
```

---

## Epic 20: Secrets Management

### Story 20.1: Add secret via CLI
```
WHEN I run `autopilot secrets add github-token`
THEN I am prompted for the value
AND secret is written to secrets/github-token.yaml
AND allowed_agents can be specified
```

### Story 20.2: Agent uses secret in HTTP request
```
WHEN agent calls http_request(url: "https://api.github.com/...", secret_ref: "github-token")
THEN secret is loaded from secrets/github-token.yaml
AND allowed_agents is checked (agent must be in list)
AND api_key is injected as Authorization header
```

---

## Test Execution with /qprobe

Use the QUESTPIE Probe CLI (`/qprobe` skill) for all testing. Config: `qprobe.config.ts`.

`autopilot start` now spawns both orchestrator (7778) AND dashboard (3001) as a single command.

### Prerequisites
```bash
rm -rf my-company
bunx autopilot init "Test Company"
```

### Phase 1: Unit Tests
```bash
bun test
```

### Phase 2: Start + Health Check
```bash
qprobe compose up
qprobe check http://localhost:7778/api/status
qprobe check http://localhost:3001
qprobe logs autopilot --level error
```

### Phase 3: API Smoke Tests
```bash
qprobe http GET /api/status --status 200
qprobe http GET /api/agents --status 200
qprobe http GET /api/tasks --status 200
qprobe http GET /api/skills --status 200
qprobe http GET /api/pins --status 200
qprobe http GET /api/groups --status 200
qprobe http GET /api/inbox --status 200
qprobe http GET /api/activity --status 200
qprobe http GET /api/artifacts --status 200
qprobe http GET /api/sessions --status 200
qprobe http GET /api/search?q=test --status 200
qprobe http GET /api/dashboard/widgets --status 200
qprobe http GET /api/dashboard/pages --status 200
qprobe http GET /api/events --status 200
qprobe http GET /fs/ --status 200
```

### Phase 4: Task CRUD
```bash
qprobe http POST /api/tasks -d '{"title":"Test task","type":"implementation","priority":"medium","description":"Test"}' --status 200
qprobe http GET /api/tasks?status=backlog --status 200
# Use returned task ID:
qprobe http GET /api/tasks/<id> --status 200
qprobe http POST /api/tasks/<id>/approve --status 200
qprobe http GET /api/tasks?status=done --status 200
```

### Phase 5: Chat + File Operations
```bash
qprobe http POST /api/chat -d '{"message":"Hello"}' --status 200
qprobe http POST /api/files/knowledge/test.md -d '{"content":"# Test"}' --status 200
qprobe http GET /fs/knowledge/test.md --status 200
qprobe http DELETE /api/files/knowledge/test.md --status 200
```

### Phase 6: Dashboard UI Tests
```bash
# Home
qprobe record start "dashboard-home"
qprobe browser open http://localhost:3001
qprobe browser snapshot -i -c
qprobe assert no-errors
qprobe assert no-network-errors
qprobe record stop

# Tasks
qprobe record start "tasks-page"
qprobe browser open http://localhost:3001/tasks
qprobe browser snapshot -i
qprobe assert no-errors
qprobe record stop

# Agents
qprobe record start "agents-page"
qprobe browser open http://localhost:3001/agents
qprobe browser snapshot -i
qprobe assert no-errors
qprobe assert text "CEO"
qprobe record stop

# Chat
qprobe record start "chat-page"
qprobe browser open http://localhost:3001/chat
qprobe browser snapshot -i
qprobe assert no-errors
qprobe record stop

# Search
qprobe record start "search-flow"
qprobe browser open http://localhost:3001/search
qprobe browser snapshot -i
qprobe assert no-errors
qprobe record stop

# Inbox, Knowledge, Files, Artifacts, Settings
for page in inbox knowledge files artifacts settings; do
  qprobe record start "${page}-page"
  qprobe browser open "http://localhost:3001/${page}"
  qprobe browser snapshot -i
  qprobe assert no-errors
  qprobe record stop
done
```

### Phase 7: Regression Replay
```bash
qprobe replay --all
```

### Phase 8: Cleanup
```bash
qprobe compose down
rm -rf my-company
```

---

## AI Testing Prompt (with /qprobe)

Copy this prompt into a new Claude Code session to run the full test suite.
Use the `/qprobe` skill — it handles dev servers, logs, HTTP, browser, recording, and assertions.

---

```
You are a senior QA engineer doing a FULL end-to-end verification of QUESTPIE Autopilot.
Your job is to verify that everything we claim in docs and landing page ACTUALLY WORKS.

## Tools
Use /qprobe for ALL testing. Key principles:
- Logs before browser — check logs/HTTP first, browser only for visual verification
- Record → replay — record every flow, replay for regression
- Assertions — every test must have explicit pass/fail assertions

## Architecture
Read local_spec.md for full specification (20 epics, 60+ stories).
- `autopilot start` spawns BOTH orchestrator (:7778) AND dashboard (:3001)
- Config: qprobe.config.ts
- Storage: SQLite for tasks/messages/activity, filesystem for config/knowledge/skills

## Execution Strategy
Use MULTIPLE AGENTS in parallel where possible. Split work into independent groups.

---

### AGENT 1: Unit Tests + Setup
```bash
# Unit tests — ALL 724 must pass
bun test

# Create test company
rm -rf my-company
bunx autopilot init "Test Company"

# Verify init created correct structure
ls my-company/
ls my-company/team/
ls my-company/skills/
ls my-company/knowledge/
cat my-company/company.yaml
# ASSERT: company name is "Test Company", slug is "test-company"
# ASSERT: team/agents.yaml has 8 agents
# ASSERT: skills/ has 20 directories
# ASSERT: runtime dirs exist (tasks/backlog, comms/channels/general, etc.)
# ASSERT: .gitignore exists with .data/ ignored
# ASSERT: .claude/skills is a symlink to ../skills
# ASSERT: git repo initialized with initial commit

# Start services
qprobe compose up
qprobe check http://localhost:7778/api/status
qprobe check http://localhost:3001
qprobe logs autopilot --level error
# ASSERT: no errors in logs
```

### AGENT 2: API — Complete Endpoint Verification
After services are up, test EVERY API endpoint with real data assertions:

```bash
# --- Status ---
qprobe http GET /api/status --status 200
# ASSERT response has: company, agentCount (=8), activeTasks, runningSessions

# --- Agents ---
qprobe http GET /api/agents --status 200
# ASSERT: array of 8 agents
# ASSERT: each has id, name, role, provider, model, fs_scope, tools

# --- Tasks CRUD ---
# Create
qprobe http POST /api/tasks \
  -d '{"title":"Build landing page","type":"implementation","priority":"high","description":"Create a responsive landing page with hero section"}' \
  --status 200
# ASSERT: response has id, status="backlog", created_at, type="implementation"

# List
qprobe http GET /api/tasks --status 200
# ASSERT: array contains the created task

# Filter by status
qprobe http GET /api/tasks?status=backlog --status 200
# ASSERT: returns only backlog tasks

# Get single task
qprobe http GET /api/tasks/<id> --status 200
# ASSERT: full task object with all fields

# Approve → moves to done
qprobe http POST /api/tasks/<id>/approve --status 200
qprobe http GET /api/tasks/<id> --status 200
# ASSERT: status is now "done", completed_at is set

# Create another task for reject test
qprobe http POST /api/tasks \
  -d '{"title":"Fix CSS bug","type":"implementation","priority":"medium","description":"Button alignment issue"}' \
  --status 200
qprobe http POST /api/tasks/<id>/reject -d '{"reason":"Needs unit tests"}' --status 200
qprobe http GET /api/tasks/<id> --status 200
# ASSERT: status is "blocked", blockers array has entry with reason

# --- Search ---
qprobe http GET "/api/search?q=landing+page" --status 200
# ASSERT: results array is not empty, contains our task

qprobe http GET "/api/search?q=landing+page&type=task" --status 200
# ASSERT: results filtered to tasks only

qprobe http GET "/api/search?q=deployment+process" --status 200
# ASSERT: returns knowledge docs about deployment

# --- Skills ---
qprobe http GET /api/skills --status 200
# ASSERT: array of 20+ skills
# ASSERT: each has id, name, description, format

# --- Dashboard Data ---
qprobe http GET /api/pins --status 200
qprobe http GET /api/groups --status 200
# ASSERT: 4 groups (alerts, overview, agents, recent)

qprobe http GET /api/dashboard/widgets --status 200
# ASSERT: has task-summary widget

qprobe http GET /api/dashboard/pages --status 200

# --- Activity ---
qprobe http GET /api/activity --status 200
# ASSERT: array (may be empty initially)

qprobe http GET /api/activity?limit=5 --status 200

# --- Inbox ---
qprobe http GET /api/inbox --status 200
# ASSERT: has tasks array (blocked ones should appear)

# --- Artifacts ---
qprobe http GET /api/artifacts --status 200

# --- Sessions ---
qprobe http GET /api/sessions --status 200

# --- Events (SSE) ---
qprobe http GET /api/events --status 200

# --- File System ---
qprobe http GET /fs/ --status 200
# ASSERT: lists company directory

qprobe http GET /fs/company.yaml --status 200
# ASSERT: contains "Test Company"

qprobe http GET /fs/team/agents.yaml --status 200
# ASSERT: contains 8 agent definitions

# --- File Operations ---
qprobe http POST /api/files/knowledge/test-doc.md \
  -d '{"content":"# Test Document\n\nThis is a test knowledge document for QA."}' \
  --status 200

qprobe http GET /fs/knowledge/test-doc.md --status 200
# ASSERT: file content matches

qprobe http DELETE /api/files/knowledge/test-doc.md --status 200

# --- Check logs after all API tests ---
qprobe logs autopilot --level error
# ASSERT: no errors
```

### AGENT 3: Dashboard — Full UI Verification
Test every dashboard page with browser. Record each flow for regression.

```bash
# --- HOME PAGE ---
qprobe record start "flow-dashboard-home"
qprobe browser open http://localhost:3001
qprobe browser snapshot -i -c
qprobe assert no-errors
qprobe assert no-network-errors
# ASSERT: page shows company status, pin groups, activity
qprobe browser screenshot
qprobe record stop

# --- TASKS PAGE (Kanban) ---
qprobe record start "flow-tasks-kanban"
qprobe browser open http://localhost:3001/tasks
qprobe browser snapshot -i
qprobe assert no-errors
qprobe assert no-network-errors
# ASSERT: shows task columns (backlog, active, review, done)
# ASSERT: our created tasks appear
qprobe browser screenshot
qprobe record stop

# --- TASK DETAIL ---
qprobe record start "flow-task-detail"
# Click on a task card to open detail
qprobe browser snapshot -i
# Find and click a task card element
qprobe browser click @e<task-card-ref>
qprobe browser snapshot --diff
qprobe assert no-errors
# ASSERT: shows title, description, status, priority, history
qprobe browser screenshot
qprobe record stop

# --- AGENTS PAGE ---
qprobe record start "flow-agents-list"
qprobe browser open http://localhost:3001/agents
qprobe browser snapshot -i
qprobe assert no-errors
qprobe assert text "CEO"
qprobe assert text "Max"
qprobe assert text "Sam"
qprobe assert text "Riley"
# ASSERT: 8 agent cards with name, role, provider
qprobe browser screenshot
qprobe record stop

# --- CHAT PAGE ---
qprobe record start "flow-chat"
qprobe browser open http://localhost:3001/chat
qprobe browser snapshot -i
qprobe assert no-errors
# ASSERT: channel list (general, dev), message input
# Try sending a message (if chat works without agent provider)
qprobe browser screenshot
qprobe record stop

# --- SEARCH PAGE ---
qprobe record start "flow-search"
qprobe browser open http://localhost:3001/search
qprobe browser snapshot -i
qprobe assert no-errors
# Find search input and type
qprobe browser fill "input" "landing page"
qprobe browser press Enter
qprobe browser snapshot --diff
# ASSERT: search results appear
qprobe browser screenshot
qprobe record stop

# --- INBOX PAGE ---
qprobe record start "flow-inbox"
qprobe browser open http://localhost:3001/inbox
qprobe browser snapshot -i
qprobe assert no-errors
# ASSERT: shows blocked/review tasks
qprobe browser screenshot
qprobe record stop

# --- KNOWLEDGE PAGE ---
qprobe record start "flow-knowledge"
qprobe browser open http://localhost:3001/knowledge
qprobe browser snapshot -i
qprobe assert no-errors
# ASSERT: shows knowledge directory tree (brand, business, technical, onboarding)
qprobe browser screenshot
qprobe record stop

# --- FILES PAGE ---
qprobe record start "flow-files"
qprobe browser open http://localhost:3001/files
qprobe browser snapshot -i
qprobe assert no-errors
# ASSERT: shows company directory tree (company.yaml, team/, knowledge/, etc.)
qprobe browser screenshot
qprobe record stop

# --- ARTIFACTS PAGE ---
qprobe record start "flow-artifacts"
qprobe browser open http://localhost:3001/artifacts
qprobe browser snapshot -i
qprobe assert no-errors
qprobe browser screenshot
qprobe record stop

# --- SETTINGS PAGE ---
qprobe record start "flow-settings"
qprobe browser open http://localhost:3001/settings
qprobe browser snapshot -i
qprobe assert no-errors
# ASSERT: shows company configuration
qprobe browser screenshot
qprobe record stop
```

### AGENT 4: User Journey — "New User Onboarding"
Simulate the ACTUAL user journey from landing page claims:

```bash
# What we claim: "Get started in 60 seconds"

# Step 1: Init (should be instant)
rm -rf qa-company
time bunx autopilot init "QA Corp"
# ASSERT: completes in < 10 seconds
# ASSERT: directory created with all expected files

# Step 2: Check structure matches what docs say
ls qa-company/
cat qa-company/company.yaml
cat qa-company/team/agents.yaml | head -20
ls qa-company/skills/
# ASSERT: matches the structure shown in docs

# Step 3: Start (should show endpoints quickly)
cd qa-company
time bunx autopilot start &
sleep 5
qprobe health http://localhost:7778/api/status
# ASSERT: API responds within 5 seconds

# Step 4: Verify status
qprobe http GET /api/status --status 200
# ASSERT: company="QA Corp", agentCount=8

# Step 5: Check dashboard loads
qprobe health http://localhost:3001
qprobe browser open http://localhost:3001
qprobe browser snapshot -i
qprobe assert no-errors
qprobe assert text "QA Corp"

# Cleanup
kill %1
rm -rf qa-company
```

### AGENT 5: Real-Time & Integration Tests

```bash
# --- SSE Real-Time Events ---
# Open SSE connection in background, then create a task
# Verify event is received

# Start listening for events (background)
qprobe http GET /api/events &

# Create task — should trigger event
qprobe http POST /api/tasks \
  -d '{"title":"SSE test","type":"implementation","priority":"low","description":"Test SSE events"}' \
  --status 200

# Check activity was logged
qprobe http GET /api/activity?limit=1 --status 200
# ASSERT: latest activity entry exists

# --- Knowledge Search Integration ---
# Verify knowledge from template is indexed
qprobe http GET "/api/search?q=deployment+conventions" --status 200
# ASSERT: returns knowledge docs from technical/conventions.md

qprobe http GET "/api/search?q=brand+guidelines" --status 200
# ASSERT: returns knowledge docs from brand/guidelines.md

# --- File Browser serves real content ---
qprobe http GET /fs/team/agents.yaml --status 200
# ASSERT: contains "ceo", "sam", "alex", "max", "riley", "ops", "morgan", "jordan"

qprobe http GET /fs/knowledge/onboarding/how-we-work.md --status 200
# ASSERT: contains onboarding content

qprobe http GET /fs/dashboard/groups.yaml --status 200
# ASSERT: contains 4 groups
```

---

## Regression Replay (after all flows recorded)

```bash
qprobe replay --all
```
ALL replays MUST pass. Any failure = regression = bug.

## Final Report Format

```
# QUESTPIE Autopilot — QA Report

## Unit Tests: 724/724 PASS ✓

## API Endpoints: X/25 PASS
- GET /api/status ✓
- GET /api/agents ✓
- POST /api/tasks ✓
...

## Dashboard Pages: X/10 PASS
- / (home) ✓
- /tasks ✓
- /agents ✓
...

## User Journeys: X/5 PASS
- New user onboarding ✓
- Task lifecycle ✓
- Search ✓
...

## Regression Replays: X/X PASS

## Issues Found:
1. [SEVERITY] Description — steps to reproduce — expected vs actual
```
```
