import { createFileRoute } from '@tanstack/react-router'
import { AgentCard } from '@/components/AgentCard'
import { CodeBlock } from '@/components/CodeBlock'
import { DashboardMock } from '@/components/DashboardMock'
import { Header } from '@/components/Header'
import { LiveStream } from '@/components/LiveStream'
import { QSymbol } from '@/components/QSymbol'
import { Section, SectionHeader } from '@/components/Section'
import { Tag } from '@/components/Tag'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/')({
	head: () => ({
		...seoHead({
			title: 'QUESTPIE Autopilot',
			description:
				'AI-native company operating system. Define your company as a filesystem, staff it with AI agents backed by Claude, and give high-level intents. Open source, CLI-first.',
			path: '/',
		}),
	}),
	component: LandingPage,
})

function LandingPage() {
	return (
		<>
			<Header />
			<div className="max-w-[860px] mx-auto px-4 sm:px-6">
				{/* HERO */}
				<section className="pt-12 pb-12 sm:pt-20 sm:pb-20 border-b border-border">
					<h1 className="font-sans text-[40px] sm:text-[64px] font-black text-white m-0 leading-none tracking-tight">
						Autopilot
					</h1>
					<p className="font-sans text-base sm:text-[22px] text-muted mt-4 font-light leading-relaxed">
						AI-native company operating system.
						<br />
						Define agents. Give intent. They handle the rest.
					</p>
					<div className="w-[60px] h-[3px] bg-purple mt-8" />
					<div className="mt-8 flex gap-2 flex-wrap">
						<Tag>OPEN SOURCE</Tag>
						<Tag color="cyan">CLAUDE AGENT SDK</Tag>
						<Tag color="green">FS-NATIVE</Tag>
						<Tag color="orange">CLI-FIRST</Tag>
					</div>
					<div className="mt-10 flex gap-3 flex-wrap">
						<a
							href="/docs/getting-started"
							className="font-mono text-xs text-white bg-purple px-6 py-2.5 no-underline hover:bg-purple-light transition-colors"
						>
							Install
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="font-mono text-xs text-purple border border-border px-6 py-2.5 no-underline hover:border-purple transition-colors"
						>
							GitHub
						</a>
					</div>
				</section>

				{/* QUICK START */}
				<Section id="quickstart">
					<SectionHeader sub="Install globally, scaffold a company, and start giving intents in under a minute.">
						Get Started in 60 Seconds
					</SectionHeader>
					<CodeBlock title="terminal">
						{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ cd my-company
$ autopilot start
$ autopilot ask "Build a pricing page with Stripe"
$ autopilot attach sam`}
					</CodeBlock>
				</Section>

				{/* WHAT IS THIS */}
				<Section id="what">
					<SectionHeader sub='You give a high-level intent. Your AI team decomposes it, plans it, implements it, reviews it, deploys it, and announces it. You approve at gates.'>
						What is Autopilot?
					</SectionHeader>
					<CodeBlock title="terminal — giving intent">
						{`$ autopilot ask "Build a pricing page for QUESTPIE Studio
  with monthly/annual toggle, 3 tiers, and Stripe integration"

\u{1F9E0} CEO Agent decomposing intent...

Created 4 tasks:

\u{1F4CB} task-050: Scope pricing page requirements
   \u2192 Assigned to: sam (strategist)
   \u2192 Workflow: development/scope

\u{1F4CB} task-051: Design pricing page UI
   \u2192 Waiting for: task-050
   \u2192 Will assign to: jordan (designer)

\u{1F4CB} task-052: Implement pricing page with Stripe
   \u2192 Waiting for: task-050, task-051
   \u2192 Will assign to: max (developer)

\u{1F4CB} task-053: Write pricing page copy and announce
   \u2192 Waiting for: task-050
   \u2192 Workflow: marketing

Sam is starting on task-050 now.
You'll be notified when approvals are needed.`}
					</CodeBlock>
					<p className="font-sans text-sm text-ghost mt-6 leading-relaxed">
						This isn't a chatbot. It's a company. Sam writes the spec. Alex plans
						the implementation. Max codes it. Riley reviews it. You merge. Ops
						deploys. Morgan announces. Each agent has persistent memory, scoped
						filesystem access, and communicates through structured primitives.
					</p>
				</Section>

				{/* DEFINE YOUR TEAM */}
				<Section id="team">
					<SectionHeader sub="Define agents in YAML. Give them names, roles, tools, and filesystem scope. Start from a template or build your own team.">
						Define Your Team
					</SectionHeader>
					<p className="font-sans text-[13px] text-ghost mb-4 leading-relaxed">
						Every agent is defined in{' '}
						<code className="font-mono text-xs text-purple">agents.yaml</code>.
						Pick from built-in role templates or create your own. Add or remove
						agents anytime via CLI or the CEO agent.
					</p>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
						<AgentCard
							name="Sam"
							role="STRATEGIST"
							desc="Scopes features, writes specs"
							color="purple"
							status="idle"
						/>
						<AgentCard
							name="Alex"
							role="PLANNER"
							desc="Implementation plans"
							color="cyan"
							status="idle"
						/>
						<AgentCard
							name="Max"
							role="DEVELOPER"
							desc="Writes code, creates PRs"
							color="green"
							status="run"
						/>
						<AgentCard
							name="Riley"
							role="REVIEWER"
							desc="Reviews code quality"
							color="green"
							status="idle"
						/>
						<AgentCard
							name="Ops"
							role="DEVOPS"
							desc="Deploys, monitors infra"
							color="orange"
							status="schd"
						/>
						<AgentCard
							name="Jordan"
							role="DESIGN"
							desc="UI/UX, design system"
							color="purple-light"
							status="idle"
						/>
						<AgentCard
							name="Morgan"
							role="MARKETING"
							desc="Copy, social, campaigns"
							color="red"
							status="idle"
						/>
						<AgentCard
							name="CEO"
							role="META"
							desc="Decomposes intent, manages"
							color="white"
							status="schd"
						/>
					</div>
					<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-3">
						<div className="font-sans text-[12px] text-muted leading-relaxed">
							<strong className="text-fg">Example above:</strong>{' '}
							The <strong className="text-purple">Solo Dev Shop</strong> template.
							You choose the names, the roles, and how many agents you need.
							Multiple agents can share the same role.
						</div>
					</div>
				</Section>

				{/* FS = DATABASE */}
				<Section id="fs">
					<SectionHeader sub="No SQL. No vector store. No proprietary format. YAML, Markdown, JSON. Git for versioning. Your company is a folder.">
						Filesystem is the Database
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="/company/">
							{`\u251C\u2500\u2500 company.yaml             # Settings, budget
\u251C\u2500\u2500 team/
\u2502   \u251C\u2500\u2500 agents.yaml          # Agent definitions
\u2502   \u251C\u2500\u2500 workflows/           # Process definitions
\u2502   \u251C\u2500\u2500 schedules.yaml       # Cron jobs
\u2502   \u251C\u2500\u2500 webhooks.yaml        # External triggers
\u2502   \u2514\u2500\u2500 policies/            # Approval gates
\u251C\u2500\u2500 tasks/
\u2502   \u251C\u2500\u2500 active/              # In progress
\u2502   \u251C\u2500\u2500 review/              # Awaiting approval
\u2502   \u2514\u2500\u2500 blocked/             # Needs human
\u251C\u2500\u2500 comms/channels/          # Agent communication
\u251C\u2500\u2500 knowledge/               # Company brain
\u251C\u2500\u2500 context/memory/          # Per-agent memories
\u251C\u2500\u2500 projects/                # Code, docs, assets
\u251C\u2500\u2500 secrets/                 # Encrypted API keys
\u251C\u2500\u2500 dashboard/pins/          # Board items
\u2514\u2500\u2500 logs/sessions/           # Session streams`}
						</CodeBlock>
						<CodeBlock title="tasks/active/task-040.yaml">
							{`id: "task-040"
title: "QUESTPIE Studio landing page"
status: in_progress
priority: high
assigned_to: max
reviewers: [riley]
workflow: development
workflow_step: implement

context:
  spec: "/projects/studio/docs/landing-spec.md"
  plan: "/projects/studio/docs/landing-plan.md"
  branch: "feat/studio-landing"

history:
  - at: "2026-03-22T10:00:00Z"
    by: ceo
    action: created
    note: "Decomposed from intent"

  - at: "2026-03-22T10:30:00Z"
    by: sam
    action: completed_step
    step: scope
    note: "Spec written"

  - at: "2026-03-22T14:30:00Z"
    by: max
    action: status_change
    to: in_progress
    note: "Started implementation"`}
						</CodeBlock>
					</div>
				</Section>

				{/* PRIMITIVES */}
				<Section id="primitives">
					<SectionHeader sub='Agents don&apos;t "chat." They call structured primitives. Thinking is private. Only tool calls produce visible effects.'>
						Primitives, Not Chat
					</SectionHeader>
					<CodeBlock title="what agents actually do">
						{`// Max tells Riley PR is ready
send_message({
  to: "agent:riley",
  content: "PR #47 ready for review. Landing page implementation.",
  references: ["/projects/studio/docs/landing-spec.md", "task-040"]
})

// Ops pins health status to dashboard
pin_to_board({
  group: "overview",
  title: "Cluster Health",
  content: "12/12 pods \u2713 | CPU 23% | Memory 41% | Disk 55%",
  type: "success",
  metadata: { expires_at: "+6h" }
})

// Riley approves and surfaces to human for merge
pin_to_board({
  group: "alerts",
  title: "PR #47 Approved \u2014 Needs Your Merge",
  type: "warning",
  metadata: {
    actions: [
      { label: "Merge PR", action: "approve:task-040" },
      { label: "Reject",   action: "reject:task-040" }
    ]
  }
})

// Max can't create GitHub repo \u2014 blocks and pings human
add_blocker({
  task_id: "task-042",
  reason: "Need admin access to create org repo",
  assigned_to: "dominik",
  blocking: ["task-040"]
})`}
					</CodeBlock>
				</Section>

				{/* SESSION ATTACH */}
				<Section id="attach">
					<SectionHeader sub="Like kubectl logs -f pod/max. Connect to any running agent and watch them work in real-time. Ctrl+C to detach — agent keeps working.">
						Session Attach
					</SectionHeader>
					<LiveStream />
					<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="kubectl analogy">
							{`kubectl get pods        \u2192  autopilot agents
kubectl logs -f pod/web \u2192  autopilot attach max
kubectl logs pod/web    \u2192  autopilot replay <session>
kubectl describe pod    \u2192  autopilot agent show max
kubectl top pods        \u2192  autopilot agents --stats`}
						</CodeBlock>
						<CodeBlock title="filter options">
							{`# Only tool calls (skip thinking)
$ autopilot attach max --tools-only

# Compact one-liner mode
$ autopilot attach max --compact

# Replay a past session
$ autopilot replay session-20260322-100000

# Search across all sessions
$ autopilot sessions search "PricingTable"`}
						</CodeBlock>
					</div>
				</Section>

				{/* CONTEXT & MEMORY */}
				<Section id="memory">
					<SectionHeader sub="Each agent has persistent memory scoped to their role. Facts, decisions, mistakes, learnings. Extracted after every session. Private — no agent reads another's memory.">
						Per-Agent Memory
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="context/memory/max/memory.yaml">
							{`facts:
  codebase:
    - "QUESTPIE v3 uses file-convention codegen"
    - "Auth: Better Auth library, not custom"
    - "ORM: Drizzle with bun-sql driver"
    - "Block system: JSONB _tree/_values cols"

  conventions:
    - "Always write QUESTPIE in all caps"
    - "Biome for formatting, not ESLint"
    - "Conventional commits: feat: fix: docs:"

decisions:
  - date: "2026-03-21"
    decision: "Webhook-based Stripe integration"
    reason: "Better UX, Dominik approved"
    task: task-039

mistakes:
  - date: "2026-03-15"
    what: "Used ESLint config instead of Biome"
    fix: "Always use Biome. Config at repo root"

patterns:
  - "Riley requests extracting shared logic
     in first review round"
  - "Break PRs into <200 lines for faster
     reviews"`}
						</CodeBlock>
						<div className="flex flex-col gap-4">
							<div className="bg-card border border-border p-4">
								<div className="font-mono text-[10px] text-purple tracking-[2px] mb-2.5">
									CONTEXT ASSEMBLY
								</div>
								<div className="font-sans text-[13px] text-muted leading-relaxed mb-3">
									Before every session, 4 layers are assembled into the
									agent&apos;s context window:
								</div>
								{[
									{
										label: 'Identity',
										desc: 'Role, rules, team',
										tokens: '~2K',
										color: 'bg-purple',
										textColor: 'text-purple',
									},
									{
										label: 'Company State',
										desc: 'Role-scoped snapshot',
										tokens: '~5K',
										color: 'bg-accent-cyan',
										textColor: 'text-accent-cyan',
									},
									{
										label: 'Memory',
										desc: 'Facts, decisions, learnings',
										tokens: '~20K',
										color: 'bg-accent-green',
										textColor: 'text-accent-green',
									},
									{
										label: 'Task Context',
										desc: 'Spec, plan, code, history',
										tokens: '~15K',
										color: 'bg-accent-orange',
										textColor: 'text-accent-orange',
									},
								].map((l, i) => (
									<div
										key={l.label}
										className={`flex justify-between items-center py-1.5 ${i < 3 ? 'border-b border-border' : ''}`}
									>
										<div className="flex items-center gap-2">
											<div className={`w-[3px] h-4 ${l.color}`} />
											<span className="font-sans text-xs text-fg font-semibold">
												{l.label}
											</span>
											<span className="font-sans text-[11px] text-ghost">
												— {l.desc}
											</span>
										</div>
										<span className={`font-mono text-[10px] ${l.textColor}`}>
											{l.tokens}
										</span>
									</div>
								))}
							</div>
							<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-4">
								<div className="font-sans text-[13px] text-fg leading-relaxed">
									<strong className="text-white">Isolation rule:</strong> No
									agent reads another agent's memory. Cross-agent info sharing
									only through channels and task history. If you need info
									outside your scope, use{' '}
									<code className="font-mono text-[11px] text-purple">
										ask_agent
									</code>{' '}
									— the owning agent decides to share or escalate.
								</div>
							</div>
						</div>
					</div>
				</Section>

				{/* TRIGGERS */}
				<Section id="triggers">
					<SectionHeader sub="Agents don't just work on tasks. They react to cron schedules, webhooks, file changes, and metric thresholds.">
						Triggers & Events
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="team/schedules.yaml">
							{`schedules:
  - id: health-check
    agent: ops
    cron: "*/5 * * * *"     # Every 5 min
    description: "Check cluster health"
    timeout: "2m"
    on_failure: alert_human

  - id: daily-standup
    agent: ceo
    cron: "0 9 * * 1-5"     # Weekdays 9AM
    description: "Morning summary"

  - id: social-check
    agent: morgan
    cron: "0 9,13,17 * * 1-5"
    description: "Check engagement"`}
						</CodeBlock>
						<CodeBlock title="team/webhooks.yaml">
							{`webhooks:
  - id: uptime-alert
    path: "/uptime"
    agent: ops
    auth: hmac_sha256
    create_task_if:
      condition: "payload.status == 0"
      task_template:
        title: "{monitor.name} is DOWN"
        priority: critical
        workflow: incident

  - id: sentry-error
    path: "/sentry"
    agent: max
    filter:
      payload:
        action: "created"
    create_task_if:
      condition: "issue.level == 'fatal'"
      task_template:
        workflow: incident`}
						</CodeBlock>
					</div>
				</Section>

				{/* WORKFLOWS */}
				<Section id="workflows">
					<SectionHeader sub="YAML files in the filesystem. CEO agent owns them. Anyone can propose changes. They evolve based on metrics.">
						Workflows as Files
					</SectionHeader>
					<CodeBlock title="team/workflows/development.yaml (abbreviated)">
						{`id: development
version: 3

steps:
  - id: scope
    assigned_role: strategist
    transitions: { done: plan }

  - id: plan
    assigned_role: planner
    review: { reviewers_roles: [developer, reviewer], min_approvals: 2 }
    transitions: { approved: implement, rejected: plan }

  - id: implement
    assigned_role: developer
    outputs: [{ type: git_branch }, { type: git_pr }]
    transitions: { done: code_review }

  - id: code_review
    assigned_role: reviewer
    review: { min_approvals: 1 }
    transitions: { approved: human_merge, rejected: implement }

  - id: human_merge
    type: human_gate              # YOU approve here
    gate: merge
    transitions: { approved: deploy, rejected: implement }

  - id: deploy
    assigned_role: devops
    auto_execute: true
    transitions: { success: verify, failure: rollback }

  - id: verify
    assigned_role: devops
    transitions: { staging_ok: human_deploy_prod }

  - id: human_deploy_prod
    type: human_gate              # YOU approve here
    gate: deploy
    transitions: { approved: deploy_prod }

  - id: complete
    type: terminal

changelog:
  - version: 3
    change: "Added verify step \u2014 Ops noticed skipped health checks"
    proposed_by: ops`}
					</CodeBlock>
				</Section>

				{/* DASHBOARD */}
				<Section id="dashboard">
					<SectionHeader sub="Thin read/write view over the filesystem. Agents pin things. You see them. Click to approve, reject, or resolve.">
						Dashboard
					</SectionHeader>
					<DashboardMock />
					<p className="font-sans text-[13px] text-ghost mt-4 leading-relaxed">
						The dashboard is NOT an app — it's a view over{' '}
						<code className="font-mono text-xs text-purple">
							/company/dashboard/pins/
						</code>
						. Agents write YAML pin files. The UI renders them. When you click
						"Merge PR", it writes to the task file. The orchestrator picks up the
						change and routes to the next workflow step.
					</p>
				</Section>

				{/* TRANSPORTS */}
				<Section id="transport">
					<SectionHeader sub="Email, WhatsApp, Slack, Telegram, push. Per-priority routing. Quiet hours. Or message agents directly from WhatsApp.">
						Transports
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="notification routing">
							{`# /company/team/humans.yaml

notification_routing:
  urgent:
    transports: [whatsapp, push, email]
    throttle: null           # Always deliver

  high:
    transports: [push, email]
    throttle: "5m"           # Max 1 per 5 min

  normal:
    transports: [email]
    throttle: "15m"          # Batch

  low:
    transports: [email]
    throttle: "1h"           # Hourly digest

quiet_hours:
  start: "22:00"
  end: "07:00"
  except: [urgent]`}
						</CodeBlock>
						<CodeBlock title="WhatsApp \u2192 Agent">
							{`# You text your Autopilot WhatsApp number:

You: @max how's the landing page going?

Max: FeatureGrid and Testimonials done.
  Working on footer CTA now. Estimate 2h
  to PR-ready. Will ping Riley for review
  when done.

# Under the hood:
# 1. Twilio receives message
# 2. Orchestrator parses @max mention
# 3. Spawns max with message context
# 4. Max reads his task state, responds
# 5. Response sent back via WhatsApp`}
						</CodeBlock>
					</div>
				</Section>

				{/* ARCHITECTURE */}
				<Section id="arch">
					<SectionHeader sub="Single Bun process (~1500 LOC). Docker container per company. Claude Agent SDK. Minimal dependencies.">
						Architecture
					</SectionHeader>
					<div className="flex flex-col gap-1.5">
						{[
							{
								label: 'HUMAN',
								desc: 'CLI \u00B7 Dashboard \u00B7 WhatsApp \u00B7 Slack \u00B7 Email',
								color: 'border-l-accent-green',
								textColor: 'text-accent-green',
							},
							{
								label: 'ORCHESTRATOR',
								desc: 'Watcher \u00B7 Workflows \u00B7 Spawner \u00B7 Context \u00B7 Memory \u00B7 Cron \u00B7 Webhooks \u00B7 Stream',
								color: 'border-l-purple',
								textColor: 'text-purple',
							},
							{
								label: 'AGENTS',
								desc: 'Claude Agent SDK \u00B7 Role templates \u00B7 Tools \u00B7 MCPs \u00B7 Sandboxed FS \u00B7 Per-agent memory',
								color: 'border-l-accent-cyan',
								textColor: 'text-accent-cyan',
							},
							{
								label: 'CONTAINER',
								desc: 'Docker \u00B7 Filesystem \u00B7 YAML/Markdown/JSON \u00B7 Git \u00B7 Secrets \u00B7 Indexes',
								color: 'border-l-accent-orange',
								textColor: 'text-accent-orange',
							},
						].map((l, i) => (
							<div key={l.label}>
								<div
									className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 bg-card border border-border border-l-[3px] ${l.color}`}
								>
									<span
										className={`font-mono text-[11px] ${l.textColor} tracking-[3px] sm:min-w-[120px]`}
									>
										{l.label}
									</span>
									<span className="font-sans text-[11px] sm:text-xs text-muted">{l.desc}</span>
								</div>
								{i < 3 && (
									<div className="text-center font-mono text-xs text-dim py-0.5">
										{'\u25BC'}
									</div>
								)}
							</div>
						))}
					</div>
					<div className="mt-6">
						<CodeBlock title="package.json — that's it">
							{`{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "chokidar": "^4.0.0",
    "yaml": "^2.0.0",
    "zod": "^3.0.0",
    "commander": "^12.0.0",
    "node-cron": "^3.0.0",
    "simple-git": "^3.0.0"
  }
}`}
						</CodeBlock>
					</div>
				</Section>

				{/* FOOTER */}
				<section className="py-12 sm:py-20 pb-12 text-center">
					<QSymbol size={36} />
					<h2 className="font-sans text-2xl sm:text-[32px] font-black text-white mt-6 tracking-tight">
						Your company, on autopilot.
					</h2>
					<p className="font-sans text-[15px] text-muted mt-2">
						Open Source. CLI-first. MIT License.
					</p>
					<div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
						<a
							href="https://github.com/questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="font-mono text-xs text-white bg-purple px-6 py-2.5 no-underline hover:bg-purple-light transition-colors"
						>
							github.com/questpie/autopilot
						</a>
						<a
							href="/docs"
							className="font-mono text-xs text-purple border border-border px-6 py-2.5 no-underline hover:border-purple transition-colors"
						>
							Documentation
						</a>
					</div>
					<div className="font-mono text-[11px] text-dim mt-12">
						Built by{' '}
						<a
							href="https://questpie.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-ghost hover:text-fg transition-colors"
						>
							QUESTPIE s.r.o.
						</a>
					</div>
				</section>
			</div>
		</>
	)
}
