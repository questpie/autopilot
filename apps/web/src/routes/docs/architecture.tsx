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

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				System Overview
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				QUESTPIE Autopilot uses an SDK-first architecture: CLI, dashboard,
				and API are all thin consumers of the same SDK layer. No business
				logic lives in the consumers.
			</p>
			<CodeBlock title="architecture">
				{`┌───────────────────────────────────────────────────────────┐
│                     CONSUMERS                              │
│  CLI · Dashboard · Mobile · WhatsApp · External APIs       │
└──────────────────────────┬────────────────────────────────┘
                           │ calls SDK functions
                           ▼
┌───────────────────────────────────────────────────────────┐
│                     SDK LAYER                              │
│                                                            │
│  @questpie/autopilot-spec          Types, schemas, paths   │
│  @questpie/autopilot-agents        Prompt templates        │
│  @questpie/autopilot-orchestrator  Core runtime            │
│    ├── fs/          YAML CRUD + write queue                │
│    ├── workflow/    State machine engine                    │
│    ├── context/     4-layer context assembler               │
│    ├── agent/       Agent spawner (Claude Agent SDK)        │
│    ├── scheduler/   Cron job runner                         │
│    ├── watcher/     FS change detection                    │
│    ├── webhook/     HTTP event receiver                    │
│    ├── session/     Agent session streaming                 │
│    ├── notifier/    Transport dispatcher                   │
│    └── server.ts    Composes everything                    │
└──────────────────────────┬────────────────────────────────┘
                           │ reads/writes
                           ▼
┌───────────────────────────────────────────────────────────┐
│                  STORAGE LAYER                             │
│                                                            │
│  Phase 1: Local filesystem (YAML/Markdown/JSON)            │
│  Phase 2: Shared filesystem (NFS/EFS) for multi-node       │
│  Phase 3: Optional SQLite backend (same schemas, faster)   │
│                                                            │
│  Write Queue (file-level semaphores)                       │
│  Git versioning (audit trail)                              │
└───────────────────────────────────────────────────────────┘`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				The Orchestrator
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				A single Bun process that coordinates everything. Each module
				is small and focused — the entire orchestrator is ~1500 lines of
				code total.
			</p>
			<ul className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">FS Watcher</strong> — monitors the company
					filesystem for changes using chokidar. Detects new tasks, status
					changes, messages, and configuration updates.
				</li>
				<li>
					<strong className="text-fg">Workflow Engine</strong> — state machine
					(~300 LOC) that routes tasks through workflow steps. Reads YAML
					workflows, checks transitions, handles reviews, timeouts, and
					conditional routing.
				</li>
				<li>
					<strong className="text-fg">Agent Spawner</strong> — creates Claude
					sessions via the Claude Agent SDK. Injects assembled context,
					configures tools and permissions, streams output.
				</li>
				<li>
					<strong className="text-fg">Context Assembler</strong> — builds
					role-scoped system prompts from 4 layers: identity, company state,
					memory, and task context. Manages token budgets.
				</li>
				<li>
					<strong className="text-fg">Memory Extractor</strong> — uses Claude
					Haiku (~$0.004/session) to extract facts, decisions, and learnings
					from completed sessions. Merges into persistent memory.
				</li>
				<li>
					<strong className="text-fg">Cron Scheduler</strong> — runs recurring
					agent tasks from schedules.yaml. Daily standups, health checks,
					weekly metrics.
				</li>
				<li>
					<strong className="text-fg">Webhook Server</strong> — receives
					external events (GitHub push, Stripe events) on port 7777.
					Verifies HMAC-SHA256 signatures.
				</li>
				<li>
					<strong className="text-fg">Session Stream</strong> — WebSocket
					server on port 7778. Powers{' '}
					<code className="font-mono text-xs text-purple">
						autopilot attach
					</code>{' '}
					for real-time agent observation.
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Provider Abstraction
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The agent spawner uses a provider abstraction layer. The
				primary (and currently only) provider is the Claude Agent SDK.
				This means agents get built-in infrastructure for free:
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
							<td className="py-2 text-xs">FS scope enforcement</td>
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
						<tr className="border-b border-border/50">
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
				Custom primitives (send_message, create_task, pin_to_board) are
				exposed as MCP tools via{' '}
				<code className="font-mono text-xs text-purple">
					createSdkMcpServer
				</code>
				. The agent thinks they are just more tools in its toolbox.
			</p>
			<CodeBlock title="agent-spawning-pattern.ts">
				{`import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'

// Custom primitives exposed as MCP tools
const autopilotTools = createSdkMcpServer({
  name: 'autopilot',
  tools: [
    tool('send_message', 'Send message to agent or channel', {
      to: z.string(), content: z.string(), priority: z.string().optional()
    }, async (args) => {
      await sendChannelMessage(companyRoot, args.to, { ... })
      return { content: [{ type: 'text', text: 'Message sent' }] }
    }),
    tool('create_task', 'Create a new task', { ... }, async (args) => { ... }),
    tool('pin_to_board', 'Pin item to dashboard', { ... }, async (args) => { ... }),
  ]
})

// Spawn agent using Claude Agent SDK
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

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Write Queue (Concurrent Safety)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				With 4-8 agents running concurrently, all reading and writing
				YAML files, concurrent writes can cause lost updates. The write
				queue solves this with file-level async mutexes.
			</p>
			<CodeBlock title="write-queue.ts">
				{`// In-memory async mutex per file path
class WriteQueue {
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
			<p className="text-ghost leading-relaxed mb-4">
				Key design decisions:
			</p>
			<ul className="text-ghost leading-relaxed space-y-1 text-sm">
				<li>
					<strong className="text-fg">File-level granularity</strong> — two
					agents can write different tasks simultaneously
				</li>
				<li>
					<strong className="text-fg">In-process queue</strong> — one Bun
					process per company, no distributed locking needed
				</li>
				<li>
					<strong className="text-fg">Read-modify-write within lock</strong> —
					prevents lost updates
				</li>
				<li>
					<strong className="text-fg">No deadlocks possible</strong> — locks
					are on individual files, no ordering dependencies
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Artifact Serving (Lazy Cold Start)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents can create previewable artifacts — React components, HTML
				pages, API docs — by writing files to{' '}
				<code className="font-mono text-xs text-purple">/artifacts/</code>.
				The artifact router serves them with zero idle cost, similar to
				serverless functions.
			</p>
			<CodeBlock title="artifact-flow">
				{`Agent writes files to /artifacts/landing-v2/
  └── package.json, src/App.tsx, .artifact.yaml

Request arrives → /artifacts/landing-v2/
  ├── Process running? → Proxy to port → Reset idle timer
  └── Not running?     → Cold start:
                           1. Read .artifact.yaml
                           2. Run build command (bun install)
                           3. Assign port from pool (4100-4199)
                           4. Run serve command (bun run dev --port 4100)
                           5. Wait for health check
                           6. Proxy request
                           7. Start idle timer (5min default)

Idle timeout (5min, no requests) → Kill process → Free port
Next request → Cold start again (~2-3s for Vite/Bun)`}
			</CodeBlock>
			<CodeBlock title=".artifact.yaml">
				{`name: landing-v2
serve: "bun run dev --port {port}"    # {port} replaced by router
build: "bun install"                   # Run once before first serve
health: "/"                            # Health check path
timeout: 5m                            # Idle timeout before shutdown`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Skills System
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Skills are reusable knowledge packages that teach agents domain
				expertise. They are markdown files loaded into the context
				assembly layer. Think of them like Claude Code skills but for
				company agents.
			</p>
			<CodeBlock title="/skills/ directory">
				{`/skills/
├── catalog.yaml                     # Index of all skills
├── builtin/                         # Ships with Autopilot
│   ├── document-creation.md         # Spec, ADR, plan templates
│   ├── code-review-checklist.md     # Review best practices
│   ├── release-notes.md             # Release note templates
│   ├── api-design.md                # API design patterns
│   └── testing-strategy.md          # Testing approaches
├── project/                         # Company-specific skills
│   ├── our-stack.md                 # Your tech stack conventions
│   └── deployment-guide.md          # Your deploy process
└── marketplace/                     # Installed from marketplace
    └── stripe-integration/
        ├── skill.yaml
        └── content.md`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				Skills are loaded into Layer 2 (Company State) of the context
				assembly. The assembler lists available skills as metadata, and
				agents can request full skill content when needed — keeping the
				context window efficient.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Integration Pattern
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				No integration is hard-coded. All external service integrations
				follow the same 3-part pattern. There is no "Linear sync module"
				or "GitHub integration module." It is just agents calling APIs,
				guided by knowledge docs.
			</p>
			<CodeBlock title="integration = secret + knowledge doc + primitive">
				{`# 1. Secret — /company/secrets/linear.yaml
service: linear
type: api_token
value: "lin_api_xxx"
allowed_agents: [ceo, sam, max, riley]

# 2. Knowledge Doc — /company/knowledge/integrations/linear.md
# Contains: GraphQL endpoint, auth format, workspace ID,
# team IDs, project mappings, common operations

# 3. Primitive — agent calls http_request or MCP tool
http_request({
  method: "POST",
  url: "https://api.linear.app/graphql",
  secret_ref: "linear",                    # orchestrator auto-injects API key
  body: { query: "mutation { issueCreate(...) }" }
})`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				See the{' '}
				<a href="/docs/integrations" className="text-purple">
					Integrations
				</a>{' '}
				page for the full guide.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				FS Serving
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The entire company filesystem is browsable via HTTP. The
				orchestrator's built-in Bun.serve handles static file serving
				with content-type awareness:
			</p>
			<CodeBlock title="fs-serving">
				{`# Knowledge docs are linkable and shareable
http://localhost:7778/fs/knowledge/technical/conventions.md  → rendered HTML
http://localhost:7778/fs/tasks/active/task-040.yaml          → formatted YAML
http://localhost:7778/fs/projects/studio/docs/spec.md        → rendered markdown
http://localhost:7778/fs/artifacts/landing-v2/               → iframe to :4100`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				Agents can reference URLs in messages. The dashboard renders
				knowledge as a documentation site. No separate docs tool needed —
				the filesystem IS the docs.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Filesystem Convention
			</h2>
			<CodeBlock title="/company/ structure">
				{`team/          → Agent definitions, workflows, schedules, policies
tasks/         → YAML task files organized by status (backlog/, active/, review/, blocked/, done/)
comms/         → Agent communication channels and direct messages
knowledge/     → Company brain — brand, technical, business, legal, integrations
projects/      → Code repos, design assets, marketing materials
infra/         → k8s manifests, monitoring configs, runbooks
context/       → Agent memories, embedding indexes, snapshots
secrets/       → Encrypted API keys and credentials (per-agent scoped)
artifacts/     → Agent-created previews (React, HTML, docs)
skills/        → Reusable knowledge packages for agents
dashboard/     → Pin files for the dashboard UI
logs/          → Activity feed, session streams, error logs, webhook logs`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Data Flow: Intent to Completion
			</h2>
			<CodeBlock title="data-flow">
				{`Human: "Build a pricing page"
  │
  ▼
CLI: autopilot ask "Build a pricing page"
  │ Creates task in /tasks/backlog/ assigned to CEO
  ▼
Watcher: detects new task file
  │
  ▼
Orchestrator: routes to CEO agent
  │ Context assembler builds 4-layer prompt
  ▼
CEO Agent Session:
  │ Calls: create_task(scope), create_task(plan), create_task(implement)
  │ Sets dependencies: implement depends_on plan depends_on scope
  │ Assigns scope → sam (strategist)
  ▼
Watcher: detects new task assigned to sam
  │
  ▼
Sam: writes spec → /projects/web-app/docs/pricing-spec.md
  │ Calls: update_task(TASK-001, status: done)
  ▼
Workflow Engine: scope → plan transition
  │ Assigns to alex (planner)
  ▼
Alex: writes plan → /projects/web-app/docs/pricing-plan.md
  ▼
... (continues through implement → review → merge → deploy)`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Session Lifecycle
			</h2>
			<ol className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">Trigger fires</strong> — task assigned,
					schedule fires, webhook received, agent mentioned
				</li>
				<li>
					<strong className="text-fg">Concurrency check</strong> —
					orchestrator enforces max_concurrent_agents limit
				</li>
				<li>
					<strong className="text-fg">Context assembly</strong> — 4-layer
					prompt built (identity + company state + memory + task context)
				</li>
				<li>
					<strong className="text-fg">Agent spawned</strong> — Claude Agent
					SDK session created with tools, MCP servers, and hooks
				</li>
				<li>
					<strong className="text-fg">Session streams</strong> — output sent
					to JSONL log + WebSocket subscribers
				</li>
				<li>
					<strong className="text-fg">Primitives called</strong> — each tool
					call writes to FS through the write queue
				</li>
				<li>
					<strong className="text-fg">Session ends</strong> — completes
					naturally or times out
				</li>
				<li>
					<strong className="text-fg">Memory extracted</strong> — Haiku
					summarizes session, merges facts/decisions into memory.yaml
				</li>
				<li>
					<strong className="text-fg">Workflow routes</strong> — engine checks
					transitions, spawns next agent if needed
				</li>
			</ol>

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
						One Bun process per company on local filesystem. Handles ~50
						agent sessions/day, ~10K tasks. Good for self-hosted solo dev
						shops. One pod = one company in k8s.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 2</span>
						Multi-Tenant Cloud
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Each company in a k8s pod with PVC storage. Shared services
						(PostgreSQL for auth/billing only, Redis for routing). One
						node (4GB RAM) hosts ~30 companies at ~128MB each. Horizontal
						scaling by adding pods.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 3</span>
						Shared FS for Large Companies
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						NFS/EFS/Ceph for companies with 100+ concurrent agents. Worker
						pool with separate watcher, spawner, and API server processes.
						FS-based or Redis queue for job distribution. File-based locks
						via atomic rename for cross-process safety.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">Phase 4</span>
						Optional SQLite Backend
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						For companies with 100K+ tasks where FS listing is slow. Same
						Zod schemas, same API, different storage backend. Configurable
						in company.yaml:{' '}
						<code className="font-mono text-xs text-purple">
							storage_backend: sqlite
						</code>
					</p>
				</div>
			</div>

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
							<td className="py-2 pr-4 text-xs text-fg">Memory Extract</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Claude Haiku
							</td>
							<td className="py-2 text-xs">$0.004/session summarization</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">HTTP Server</td>
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

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Package Architecture
			</h2>
			<CodeBlock title="packages">
				{`@questpie/autopilot-spec (published, external)
  │  Zod schemas, types, path conventions
  │  Zero runtime deps except zod + yaml
  │  For plugin/integration authors
  │
@questpie/autopilot-agents (internal)
  │  8 system prompt templates
  │  buildSystemPrompt() assembler
  │  Depends on: spec
  │
@questpie/autopilot-orchestrator (internal)
  │  Core runtime — ALL business logic lives here
  │  FS operations, workflow engine, context assembly,
  │  scheduler, watcher, webhooks, sessions, notifier
  │  Depends on: spec, agents
  │
@questpie/autopilot-cli (published as @questpie/autopilot)
  │  Thin CLI shell — calls orchestrator functions
  │  Commander.js commands
  │  Depends on: orchestrator
  │
@questpie/autopilot-dashboard (future)
     React web UI — calls orchestrator via API
     Thin read/write layer over FS
     Depends on: spec (types only)`}
			</CodeBlock>
		</article>
	)
}
