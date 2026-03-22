import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/architecture')({
	head: () => ({
		meta: [{ title: 'Architecture — QUESTPIE Autopilot' }],
	}),
	component: Architecture,
})

function Architecture() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Architecture
			</h1>
			<p className="text-muted text-lg mb-8">
				Four layers. Single process. Filesystem-native. SDK-first.
			</p>

			{/* ── 4-Layer Stack ───────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				4-Layer Stack
			</h2>
			<CodeBlock title="system overview">
				{`┌───────────────────────────────────────────────────────────┐
│  LAYER 1 — HUMAN                                          │
│  CLI · Dashboard · Mobile · WhatsApp · External APIs      │
│  Thin consumers. No business logic.                       │
└──────────────────────────┬────────────────────────────────┘
                           │ calls SDK functions
                           ▼
┌───────────────────────────────────────────────────────────┐
│  LAYER 2 — ORCHESTRATOR                                   │
│  Single Bun process per company                           │
│                                                           │
│  Watcher → detects FS changes (new tasks, status moves)   │
│  Workflow → state machine routing (YAML-defined steps)    │
│  Context → 4-layer prompt assembly (identity+state+mem)   │
│  Spawner → creates Claude Agent SDK sessions              │
│  Scheduler → cron-based recurring agent jobs              │
│  Webhook → HTTP event receiver (port 7777)                │
│  Session → WebSocket streaming (port 7778)                │
│  Notifier → transport dispatcher (email, Slack, etc.)     │
│  Artifact → lazy cold-start preview server                │
│  Skills → reusable knowledge packages                     │
└──────────────────────────┬────────────────────────────────┘
                           │ spawns
                           ▼
┌───────────────────────────────────────────────────────────┐
│  LAYER 3 — AGENTS                                         │
│  Claude Agent SDK sessions with tools + MCP servers       │
│  Role-scoped FS access, sandboxed shell, custom MCP tools │
│  8 default roles: CEO, strategist, planner, developer,    │
│  reviewer, devops, designer, marketing                    │
└──────────────────────────┬────────────────────────────────┘
                           │ reads/writes
                           ▼
┌───────────────────────────────────────────────────────────┐
│  LAYER 4 — STORAGE                                        │
│  Local filesystem: YAML + Markdown + JSON                 │
│  Write queue (file-level async mutex)                     │
│  Git versioning for audit trail                           │
└───────────────────────────────────────────────────────────┘`}
			</CodeBlock>

			{/* ── SDK-First ──────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				SDK-First Architecture
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				All business logic lives in the orchestrator SDK. CLI,
				dashboard, and API are thin consumers that call the same
				functions. No logic is duplicated across consumers.
			</p>
			<CodeBlock title="consumer pattern">
				{`// CLI — thin shell over SDK
import { createTask, listTasks, loadAgents } from '@questpie/autopilot-orchestrator'

// Dashboard — same SDK, different UI
import { createTask, listTasks, loadAgents } from '@questpie/autopilot-orchestrator'

// External API — same SDK, HTTP wrapper
import { createTask, listTasks, loadAgents } from '@questpie/autopilot-orchestrator'`}
			</CodeBlock>
			<CodeBlock title="package dependency graph">
				{`@questpie/autopilot-spec          (published)
│  Zod schemas, types, path conventions
│  Zero runtime deps except zod + yaml
│
├── @questpie/autopilot-agents    (internal)
│   │  System prompt templates per role
│   │  buildSystemPrompt() assembler
│   │
│   └── @questpie/autopilot-orchestrator  (internal)
│       │  ALL business logic lives here
│       │  FS ops, workflow, context, scheduler,
│       │  watcher, webhooks, sessions, notifier
│       │
│       ├── @questpie/autopilot-cli   (published as @questpie/autopilot)
│       │    Commander.js commands → calls orchestrator
│       │
│       └── @questpie/autopilot-dashboard  (future)
│            React UI → calls orchestrator via API`}
			</CodeBlock>

			{/* ── Provider Abstraction ───────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Provider Abstraction
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The agent spawner uses a provider abstraction. The primary
				provider is the Claude Agent SDK. This gives agents built-in
				infrastructure — file I/O, shell access, sub-agents, MCP
				support, and lifecycle hooks — without building any of it.
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Capability
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Agent SDK Provides
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								We Build On Top
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs">File I/O</td>
							<td className="py-2 pr-4 text-xs text-purple font-mono">
								Read, Write, Edit, Glob, Grep
							</td>
							<td className="py-2 text-xs">FS scope enforcement per role</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs">Shell</td>
							<td className="py-2 pr-4 text-xs text-purple font-mono">
								Bash tool
							</td>
							<td className="py-2 text-xs">Command sandboxing</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs">Sandboxing</td>
							<td className="py-2 pr-4 text-xs text-purple font-mono">
								Permission modes
							</td>
							<td className="py-2 text-xs">Role-based scoping</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs">Sub-agents</td>
							<td className="py-2 pr-4 text-xs text-purple font-mono">
								Agent tool
							</td>
							<td className="py-2 text-xs">Team delegation</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs">MCP</td>
							<td className="py-2 pr-4 text-xs text-purple font-mono">
								Built-in MCP support
							</td>
							<td className="py-2 text-xs">Custom primitives as MCP tools</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs">Hooks</td>
							<td className="py-2 pr-4 text-xs text-purple font-mono">
								PreToolUse, PostToolUse, SessionEnd
							</td>
							<td className="py-2 text-xs">Activity logging, memory extraction</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-ghost leading-relaxed mb-4">
				The Agent SDK supports both API key authentication and Claude
				Max subscription. Set{' '}
				<code className="font-mono text-xs text-purple">
					ANTHROPIC_API_KEY
				</code>{' '}
				to either an API key or a Max session token.
			</p>

			{/* ── Module Map ─────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Orchestrator Module Map
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The orchestrator is a single Bun process composed of focused
				modules. Each module is small and independent.
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Module
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Export
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Responsibility
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">fs/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								readYaml, writeYaml, createTask, listTasks, moveTask
							</td>
							<td className="py-2 text-xs">
								YAML CRUD with write queue. File-level async mutex
								prevents concurrent write corruption.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">workflow/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								WorkflowEngine
							</td>
							<td className="py-2 text-xs">
								State machine engine. Reads YAML workflows, checks
								transitions, handles reviews and conditional routing.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">context/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								ContextAssembler
							</td>
							<td className="py-2 text-xs">
								Builds role-scoped system prompts from 4 layers:
								identity, company state, memory, and task context.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">agent/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								AgentSpawner
							</td>
							<td className="py-2 text-xs">
								Creates Claude Agent SDK sessions. Injects context,
								configures tools/MCP, streams output.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">scheduler/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Scheduler
							</td>
							<td className="py-2 text-xs">
								Cron-based recurring agent tasks from schedules.yaml.
								Standups, health checks, weekly metrics.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">watcher/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								FSWatcher
							</td>
							<td className="py-2 text-xs">
								Monitors company filesystem via chokidar. Detects
								new tasks, status changes, messages, config updates.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">webhook/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								WebhookServer
							</td>
							<td className="py-2 text-xs">
								HTTP event receiver on port 7777. Verifies
								HMAC-SHA256 signatures. GitHub, Stripe, etc.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">session/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								SessionManager
							</td>
							<td className="py-2 text-xs">
								WebSocket server on port 7778. Powers{' '}
								<code className="font-mono text-purple">autopilot attach</code>{' '}
								for real-time observation.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">artifact/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								ArtifactRouter
							</td>
							<td className="py-2 text-xs">
								Lazy cold-start server for agent-created previews.
								React components, HTML pages, API docs.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">skills/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								loadSkillCatalog
							</td>
							<td className="py-2 text-xs">
								Reusable knowledge packages. Loaded into context
								assembly Layer 2 (company state).
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">api/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								API routes
							</td>
							<td className="py-2 text-xs">
								HTTP API for dashboard and external consumers.
								Status, activity feed, task management.
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">notifier/</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Notifier
							</td>
							<td className="py-2 text-xs">
								Transport dispatcher. Routes notifications to
								email, Slack, webhooks based on config.
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* ── Data Flow ──────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Data Flow: Intent to Completion
			</h2>
			<CodeBlock title="data flow">
				{`Human: "Build a pricing page"
  │
  ▼
CLI: autopilot ask "Build a pricing page"
  │ Creates task in /tasks/backlog/ (type: intent, assigned: ceo)
  ▼
Watcher: detects new task file
  │
  ▼
Orchestrator: routes to CEO agent
  │ Context assembler builds 4-layer prompt:
  │   Layer 1: Agent identity (role, personality, tools)
  │   Layer 2: Company state (knowledge, team, projects)
  │   Layer 3: Agent memory (facts, decisions, past sessions)
  │   Layer 4: Task context (description, dependencies, history)
  ▼
CEO Agent Session:
  │ Reads company knowledge, evaluates scope
  │ Calls: create_task("Scope requirements") → sam
  │ Calls: create_task("Plan implementation") → alex
  │ Calls: create_task("Implement + Stripe")  → max
  │ Calls: create_task("Review PR")           → riley
  │ Sets dependencies: implement → plan → scope
  ▼
Watcher: detects new tasks
  │
  ▼
Sam (strategist): writes spec
  │ Calls: update_task(status: done)
  ▼
Workflow Engine: scope → plan transition
  │ Activates Alex's task
  ▼
Alex (planner): writes plan
  │ Calls: update_task(status: done)
  ▼
Max (developer): implements
  │ Creates branch, writes code, runs tests
  │ Creates PR, marks task done
  ▼
Riley (reviewer): reviews PR
  │ Approves or requests changes
  ▼
Workflow Engine: human gate
  │ Task moves to review, appears in inbox
  ▼
Human: autopilot tasks approve TASK-003
  │ Task moves to done, workflow continues`}
			</CodeBlock>

			{/* ── Session Lifecycle ──────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Session Lifecycle
			</h2>
			<ol className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">Trigger fires</strong> — task
					assigned, cron schedule fires, webhook received, or agent
					mentioned in a message
				</li>
				<li>
					<strong className="text-fg">Concurrency check</strong> —
					orchestrator enforces{' '}
					<code className="font-mono text-xs text-purple">
						max_concurrent_agents
					</code>{' '}
					limit. Excess tasks queue.
				</li>
				<li>
					<strong className="text-fg">Context assembly</strong> —
					4-layer system prompt built: identity + company state +
					agent memory + task context
				</li>
				<li>
					<strong className="text-fg">Agent spawned</strong> —
					Claude Agent SDK session created with tools, MCP servers,
					permission mode, and lifecycle hooks
				</li>
				<li>
					<strong className="text-fg">Session streams</strong> —
					output written to JSONL activity log + broadcast to
					WebSocket subscribers
				</li>
				<li>
					<strong className="text-fg">Primitives called</strong> —
					each tool call (create_task, send_message, etc.) writes to
					the filesystem through the write queue
				</li>
				<li>
					<strong className="text-fg">Session ends</strong> —
					completes naturally or times out after max turns
				</li>
				<li>
					<strong className="text-fg">Memory extracted</strong> —
					Claude Haiku summarizes session (~$0.004/call), merges
					facts, decisions, and learnings into memory.yaml
				</li>
				<li>
					<strong className="text-fg">Workflow routes</strong> —
					engine checks transitions and spawns the next agent if
					a downstream task is ready
				</li>
			</ol>

			{/* ── Agent Spawning ─────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Agent Spawning Pattern
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Custom primitives (send_message, create_task, pin_to_board)
				are exposed as MCP tools via{' '}
				<code className="font-mono text-xs text-purple">
					createSdkMcpServer
				</code>
				. The agent sees them as native tools alongside Read, Write,
				Edit, Bash, Glob, and Grep.
			</p>
			<CodeBlock title="agent-spawning.ts">
				{`import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'

// Custom primitives exposed as MCP tools
const autopilotTools = createSdkMcpServer({
  name: 'autopilot',
  tools: [
    tool('send_message', 'Send message to agent or channel', {
      to: z.string(), content: z.string()
    }, async (args) => { ... }),
    tool('create_task', 'Create a new task', { ... }, async (args) => { ... }),
    tool('pin_to_board', 'Pin item to dashboard', { ... }, async (args) => { ... }),
  ]
})

// Spawn agent session
async function spawnAgent(agent: Agent, task: Task, context: AssembledContext) {
  for await (const message of query({
    prompt: \`Work on task: \${task.title}\`,
    options: {
      systemPrompt: context.systemPrompt,
      cwd: companyRoot,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      mcpServers: { autopilot: autopilotTools },
      permissionMode: 'acceptEdits',
      maxTurns: 50,
      model: agent.model,
      hooks: {
        PostToolUse: [{ matcher: '.*', hooks: [logToActivityFeed] }],
        SessionEnd: [{ matcher: '.*', hooks: [extractMemoryWithHaiku] }],
      },
    },
  })) {
    streamManager.emit(sessionId, message)
  }
}`}
			</CodeBlock>

			{/* ── Filesystem Convention ──────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Filesystem Convention
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every company is a directory tree. No database required. The
				filesystem IS the database. Git provides versioning and audit
				trail.
			</p>
			<CodeBlock title="/company/ tree structure">
				{`company.yaml               Company config (name, slug, timezone, model defaults)

team/                      Agent definitions and orchestration rules
├── agents.yaml            Agent roster (roles, tools, FS scope, triggers)
├── workflows/             YAML workflow definitions (development, incident, etc.)
├── schedules.yaml         Cron-based recurring agent jobs
└── policies/              Approval gates, information sharing rules

tasks/                     YAML task files organized by status
├── backlog/               Queued work not yet started
├── active/                Currently being worked on by an agent
├── review/                Awaiting human review or approval
├── blocked/               Stuck — needs human input or dependency
└── done/                  Completed tasks (archived)

knowledge/                 Company brain — agents read this for context
├── brand/                 Brand guidelines, voice, tone
├── technical/             Stack, conventions, architecture
├── business/              Pricing, competitors, strategy
├── legal/                 Compliance, terms, privacy
└── integrations/          API docs for connected services

projects/                  Code repos, design assets, marketing materials
comms/                     Agent communication channels and DMs
context/                   Agent memories, embedding indexes, snapshots
secrets/                   Encrypted API keys (per-agent scoped)
artifacts/                 Agent-created previews (React, HTML, docs)
skills/                    Reusable knowledge packages for agents
dashboard/                 Pin files for the dashboard UI
logs/                      Activity feed, session logs, error logs`}
			</CodeBlock>

			{/* ── Write Queue ────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Write Queue
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Multiple agents run concurrently, all reading and writing YAML
				files. The write queue prevents lost updates with file-level
				async mutexes. Two agents can write different task files
				simultaneously, but writes to the same file are serialized.
			</p>
			<CodeBlock title="write-queue.ts">
				{`class WriteQueue {
  private locks = new Map<string, { queue: Array<() => void> }>()

  async withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire(path)
    try {
      return await fn()
    } finally {
      release()
    }
  }
}

// Usage: read-modify-write within lock
async function updateTask(root: string, taskId: string, updates: Partial<Task>) {
  const path = await findTaskPath(root, taskId)
  return writeQueue.withLock(path, async () => {
    const task = await readYaml(path, TaskSchema)
    const updated = { ...task, ...updates }
    await writeYaml(path, updated)
    return updated
  })
}`}
			</CodeBlock>
			<ul className="text-ghost leading-relaxed space-y-1 text-sm">
				<li>
					<strong className="text-fg">File-level granularity</strong> —
					two agents can write different tasks simultaneously
				</li>
				<li>
					<strong className="text-fg">In-process queue</strong> —
					one Bun process per company, no distributed locking
				</li>
				<li>
					<strong className="text-fg">Read-modify-write within lock</strong> —
					prevents lost updates
				</li>
				<li>
					<strong className="text-fg">No deadlocks possible</strong> —
					locks are per-file, no ordering dependencies
				</li>
			</ul>

			{/* ── Integration Pattern ────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Integration Pattern
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				No integration is hard-coded. Every external service follows
				the same 3-part pattern. There is no "Linear module" or
				"GitHub integration." Agents call APIs guided by knowledge
				docs, using secrets managed by the orchestrator.
			</p>
			<CodeBlock title="integration = secret + knowledge doc + primitive">
				{`# 1. Secret — /secrets/linear.yaml
service: linear
type: api_token
value: "lin_api_xxx"
allowed_agents: [ceo, sam, max, riley]

# 2. Knowledge Doc — /knowledge/integrations/linear.md
# Contains: GraphQL endpoint, auth format, workspace ID,
# team IDs, project mappings, common operations

# 3. Primitive — agent calls http_request or MCP tool
http_request({
  method: "POST",
  url: "https://api.linear.app/graphql",
  secret_ref: "linear",                    # orchestrator injects API key
  body: { query: "mutation { issueCreate(...) }" }
})`}
			</CodeBlock>

			{/* ── Artifact Serving ───────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Artifact Serving
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents create previewable artifacts (React components, HTML
				pages, API docs) by writing to{' '}
				<code className="font-mono text-xs text-purple">/artifacts/</code>.
				The artifact router serves them with lazy cold start and
				automatic idle shutdown.
			</p>
			<CodeBlock title="artifact lifecycle">
				{`Agent writes to /artifacts/landing-v2/
  └── package.json, src/App.tsx, .artifact.yaml

Request → /artifacts/landing-v2/
  ├── Process running? → Proxy to port → Reset idle timer
  └── Not running?     → Cold start:
                           1. Read .artifact.yaml
                           2. Run build command (bun install)
                           3. Assign port from pool (4100-4199)
                           4. Run serve command (bun run dev --port 4100)
                           5. Wait for health check
                           6. Proxy request
                           7. Start idle timer (5min default)

Idle timeout → Kill process → Free port
Next request → Cold start again (~2-3s)`}
			</CodeBlock>
			<CodeBlock title=".artifact.yaml">
				{`name: landing-v2
serve: "bun run dev --port {port}"
build: "bun install"
health: "/"
timeout: 5m`}
			</CodeBlock>

			{/* ── Tech Stack ────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Tech Stack
			</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Layer
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Technology
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Why
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Runtime</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">Bun</td>
							<td className="py-2 text-xs">
								Fast, native TS, built-in test runner, Bun.serve
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Language</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								TypeScript (strict)
							</td>
							<td className="py-2 text-xs">Type safety, Zod integration</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">AI</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Claude Agent SDK
							</td>
							<td className="py-2 text-xs">
								File tools, sandboxing, MCP, hooks, sessions
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Schemas</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">Zod</td>
							<td className="py-2 text-xs">Runtime validation + type inference</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">FS Watch</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								chokidar v4
							</td>
							<td className="py-2 text-xs">Mature, cross-platform</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">CLI</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Commander.js
							</td>
							<td className="py-2 text-xs">Production-grade, well-documented</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Git</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								simple-git
							</td>
							<td className="py-2 text-xs">Programmatic git operations</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Cron</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								node-cron
							</td>
							<td className="py-2 text-xs">Simple, reliable</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Memory</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Claude Haiku
							</td>
							<td className="py-2 text-xs">$0.004/session summarization</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">HTTP</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Bun.serve
							</td>
							<td className="py-2 text-xs">Built-in, fast, WebSocket support</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">Formatting</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Biome
							</td>
							<td className="py-2 text-xs">
								Fast, replaces ESLint + Prettier
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* ── Scaling Path ───────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Scaling Path
			</h2>
			<div className="space-y-4 mb-8">
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 1</span>
						Single Process (Current)
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						One Bun process per company on local filesystem. Handles
						~50 agent sessions/day, ~10K tasks. Good for self-hosted
						solo dev shops. One pod = one company in k8s.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 2</span>
						Multi-Tenant Cloud
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Each company in a k8s pod with PVC storage. Shared
						services (PostgreSQL for auth/billing only, Redis for
						routing). One node (4GB RAM) hosts ~30 companies at
						~128MB each.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 3</span>
						Shared FS for Large Companies
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						NFS/EFS/Ceph for companies with 100+ concurrent agents.
						Worker pool with separate watcher, spawner, and API
						server processes. File-based locks via atomic rename.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 4</span>
						Optional SQLite Backend
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						For companies with 100K+ tasks where FS listing is slow.
						Same Zod schemas, same API, different storage backend.
						Configurable in company.yaml:{' '}
						<code className="font-mono text-xs text-purple">
							storage_backend: sqlite
						</code>
					</p>
				</div>
			</div>
		</article>
	)
}
