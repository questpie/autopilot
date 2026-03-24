import { createFileRoute } from '@tanstack/react-router'

import { AgentCard } from '@/components/landing/AgentCard'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { DashboardMock } from '@/components/landing/DashboardMock'
import { Header } from '@/components/landing/Header'
import { LiveStream } from '@/components/landing/LiveStream'
import { QSymbol } from '@/components/landing/QSymbol'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/')({
	head: () => ({
		meta: [
			{ title: 'QUESTPIE Autopilot — Agents That Act, Not Chat' },
			{
				name: 'description',
				content:
					'Filesystem-native operating system where AI agents run your company through structured primitives, human approval gates, and a self-evolving dashboard. Zero infrastructure. Open source.',
			},
			{ property: 'og:title', content: 'QUESTPIE Autopilot — Agents That Act, Not Chat' },
			{
				property: 'og:description',
				content:
					'Filesystem-native operating system where AI agents run your company through structured primitives, human approval gates, and a self-evolving dashboard. Zero infrastructure. Open source.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:title', content: 'QUESTPIE Autopilot — Agents That Act, Not Chat' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com' }],
	}),
	component: LandingPage,
})

function LandingPage() {
	return (
		<div className="landing-page">
			<Header />
			<div className="max-w-[860px] mx-auto px-4 sm:px-6">
				{/* ========== 1. HERO ========== */}
				<section className="pt-12 pb-12 sm:pt-20 sm:pb-20 border-b border-lp-border">
					<div className="flex justify-center mb-8">
						<QSymbol size={48} />
					</div>
					<h1 className="font-mono text-[40px] sm:text-[64px] font-bold text-white m-0 leading-tight tracking-[-0.03em] text-center">
						Your AI-native
						<br />
						company operating system
					</h1>
					<p className="font-sans text-base sm:text-[20px] text-lp-muted mt-5 font-light leading-relaxed max-w-[640px] mx-auto text-center">
						AI agents that don't chat -- they act. Structured primitives create tasks,
						write code, deploy services, and build dashboards.
						You approve the results.
					</p>
					<div className="mt-8 flex gap-2 flex-wrap justify-center">
						<Tag>OPEN SOURCE</Tag>
						<Tag>CLI-FIRST</Tag>
						<Tag>ZERO INFRA</Tag>
						<Tag>MIT LICENSE</Tag>
					</div>
					<div className="mt-10 flex gap-3 flex-wrap justify-center">
						<a
							href="/docs/getting-started"
							className="font-mono text-xs text-white bg-lp-purple px-6 py-2.5 no-underline hover:bg-lp-purple-light transition-colors"
						>
							Install
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="font-mono text-xs text-lp-purple border border-lp-border px-6 py-2.5 no-underline hover:border-lp-purple transition-colors"
						>
							GitHub
						</a>
					</div>
				</section>

				{/* ========== 2. THE 60-SECOND DEMO ========== */}
				<Section id="quickstart">
					<SectionHeader sub="Install globally, scaffold a company, and give your first intent. One Bun process. One SQLite file. Zero infrastructure.">
						Get Started in 60 Seconds
					</SectionHeader>
					<CodeBlock title="install">
						{`# Install
bun add -g @questpie/autopilot

# Create your AI company
autopilot init my-company
cd my-company

# Configure your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the orchestrator + dashboard
autopilot start

# Open dashboard
open http://localhost:3001

# Send your first task
autopilot ask "Build me a landing page"

# Watch agents work in real-time
autopilot attach max`}
					</CodeBlock>
					<div className="mt-4 bg-lp-card border border-lp-border p-3">
						<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
							<strong className="text-lp-fg">What you need:</strong>{' '}
							Bun runtime + Anthropic API key. That's it.
							No Docker. No Postgres. No Redis. No vector DB. No Kubernetes.
						</div>
					</div>
				</Section>

				{/* ========== 3. WHAT IS AUTOPILOT ========== */}
				<Section id="what">
					<SectionHeader sub="You give a high-level intent. Your AI team decomposes it, plans it, implements it, reviews it, and deploys it. You approve at gates. The agent builds a pricing page and you see it running before it ships.">
						What is Autopilot?
					</SectionHeader>
					<CodeBlock title="terminal -- giving intent">
						{`$ autopilot ask "Build a pricing page for QUESTPIE Studio
  with monthly/annual toggle, 3 tiers, and Stripe integration"

CEO Agent decomposing intent...

Created 4 tasks:

  task-050: Scope pricing page requirements
   -> Assigned to: sam (strategist)
   -> Workflow: development/scope

  task-051: Design pricing page UI
   -> Waiting for: task-050
   -> Will assign to: jordan (designer)

  task-052: Implement pricing page with Stripe
   -> Waiting for: task-050, task-051
   -> Will assign to: max (developer)

  task-053: Write pricing page copy and announce
   -> Waiting for: task-050
   -> Workflow: marketing

Sam is starting on task-050 now.
You'll be notified when approvals are needed.`}
					</CodeBlock>
					<p className="font-sans text-sm text-lp-ghost mt-6 leading-relaxed">
						This isn't a chatbot. It's a company. Sam writes the spec. Alex plans
						the implementation. Max codes it. Riley reviews it. You merge. Ops
						deploys. Morgan announces. Each agent has persistent memory, scoped
						filesystem access, and communicates through structured primitives -- not
						natural language.
					</p>
				</Section>

				{/* ========== 4. PRIMITIVES, NOT CHAT ========== */}
				<Section id="primitives">
					<SectionHeader sub="Agent thinking is private. Only effects are visible. Every agent action is a typed function call with clear targets and effects -- not a text response for you to parse.">
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
  content: "12/12 pods OK | CPU 23% | Memory 41% | Disk 55%",
  type: "success",
  metadata: { expires_at: "+6h" }
})

// Riley approves and surfaces to human for merge
pin_to_board({
  group: "alerts",
  title: "PR #47 Approved -- Needs Your Merge",
  type: "warning",
  metadata: {
    actions: [
      { label: "Merge PR", action: "approve:task-040" },
      { label: "Reject",   action: "reject:task-040" }
    ]
  }
})

// Max creates a live preview via artifact system
create_artifact({
  type: "react",
  title: "Pricing Page Preview",
  source_path: "/projects/studio/code/src/pages/pricing",
  pin_to_board: true
})`}
					</CodeBlock>
					<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="bg-lp-card border border-lp-border p-4">
							<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2">
								AUTOPILOT AGENTS
							</div>
							<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
								Call 13 typed primitives: <code className="font-mono text-[11px] text-lp-purple">create_task</code>, <code className="font-mono text-[11px] text-lp-purple">send_message</code>, <code className="font-mono text-[11px] text-lp-purple">pin_to_board</code>, <code className="font-mono text-[11px] text-lp-purple">create_artifact</code>, <code className="font-mono text-[11px] text-lp-purple">git_commit</code>...
								Every call produces a visible, auditable effect in the filesystem.
							</div>
						</div>
						<div className="bg-lp-card border border-lp-border p-4">
							<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2">
								CHATBOT AGENTS
							</div>
							<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
								Generate text for you to read. You copy-paste it somewhere. No audit trail.
								No structured effects. No workflow integration. You are the middleware.
							</div>
						</div>
					</div>
				</Section>

				{/* ========== 5. LIVING DASHBOARD ========== */}
				<Section id="dashboard">
					<SectionHeader sub="Your agents build your internal tools. In real time. No deploy. The dashboard is a React app in the company filesystem that agents edit -- changes appear in seconds via HMR.">
						Living Dashboard
					</SectionHeader>
					<DashboardMock />
					<div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="company/dashboard/widgets/sprint-progress/widget.tsx">
							{`export default function SprintProgress() {
  const { data } = useQuery({
    queryKey: ['tasks'],
    queryFn: () =>
      fetch('/api/tasks').then(r => r.json()),
    refetchInterval: 30000,
  })

  const done = data?.filter(
    t => t.status === 'done'
  ).length ?? 0
  const total = data?.length ?? 0

  return (
    <div className="p-4 border border-border">
      <h3>Sprint Progress</h3>
      <div className="text-3xl font-bold">
        {done}/{total}
      </div>
    </div>
  )
}`}
						</CodeBlock>
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-4">
								<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2.5">
									ARCHITECTURE
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed space-y-2">
									<div>
										<strong className="text-lp-fg">Immutable core</strong> -- npm package. Base
										components, hooks, API client, router. Agents cannot break it.
									</div>
									<div>
										<strong className="text-lp-fg">Company layer</strong> -- in your filesystem.
										Custom widgets, pages, theme overrides, layout config. Agents edit this.
									</div>
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-3">
								<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
									<strong className="text-lp-fg">"Add a revenue chart to the dashboard."</strong>{' '}
									Agent writes <code className="font-mono text-[11px] text-lp-purple">widget.tsx</code>,
									registers it in <code className="font-mono text-[11px] text-lp-purple">layout.yaml</code>,
									and it appears. No Retool. No deployment. No drag-and-drop.
								</div>
							</div>
						</div>
					</div>
				</Section>

				{/* ========== 6. TRUST & SAFETY ========== */}
				<Section id="trust">
					<SectionHeader sub="The #1 objection to autonomous AI agents is trust. Autopilot has answers: explicit approval gates, hardcoded deny patterns, live session observation, and a full git audit trail.">
						Trust & Safety
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="human gates in workflow YAML">
							{`# Agents work autonomously until they hit a gate.
# You approve. They continue.

steps:
  - id: code_review
    assigned_role: reviewer
    transitions:
      approved: human_merge
      rejected: implement

  - id: human_merge
    type: human_gate        # YOU approve here
    gate: merge
    transitions:
      approved: deploy

  - id: human_deploy_prod
    type: human_gate        # YOU approve here
    gate: deploy
    transitions:
      approved: deploy_prod

# Gates: merge, deploy, spend, publish
# Everything else: agents handle it.`}
						</CodeBlock>
						<div className="flex flex-col gap-3">
							{[
								{
									label: 'HUMAN GATES',
									desc: 'Explicit approval points for merge, deploy, spend, and publish. Defined in workflow YAML, not bolted-on permissions.',
								},
								{
									label: 'DENY PATTERNS',
									desc: 'Agents cannot touch .auth/, .master-key, .data/, or .git/. Hardcoded. Per-agent filesystem scoping on top.',
								},
								{
									label: 'SESSION ATTACH',
									desc: 'Watch any agent work in real-time. autopilot attach max streams the live session. Like kubectl logs -f for AI agents.',
								},
								{
									label: 'GIT AUDIT TRAIL',
									desc: 'Every agent action is a git commit (5s batch). Your company has version control. git diff to see what changed. git revert to undo.',
								},
							].map((item) => (
								<div
									key={item.label}
									className="bg-lp-card border border-lp-border p-3"
								>
									<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-1">
										{item.label}
									</div>
									<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
										{item.desc}
									</div>
								</div>
							))}
						</div>
					</div>
				</Section>

				{/* ========== 7. SESSION ATTACH ========== */}
				<Section id="attach">
					<SectionHeader sub="Connect to any running agent and watch them work in real-time. Ctrl+C to detach -- agent keeps working. Replay past sessions for review.">
						Session Attach
					</SectionHeader>
					<LiveStream />
					<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="CLI commands">
							{`autopilot agents              # See who's working
autopilot attach max          # Watch max work live
autopilot replay <session>    # Review past work
autopilot agent show max      # Agent details & stats
autopilot agents --stats      # Team performance overview`}
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

				{/* ========== 8. USE CASES ========== */}
				<Section id="usecases">
					<SectionHeader sub="Same Autopilot kernel. Different skills. Different company. Three flagship use cases, validated in production.">
						Use Cases
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						{[
							{
								label: 'SOLO DEV SHOP',
								input: '"Build a pricing page with Stripe"',
								what: 'CEO decomposes, strategist scopes, planner plans, developer implements, reviewer reviews',
								see: 'Task progress on dashboard, PR for merge, live preview via artifact router',
								outcome: 'Feature shipped without micromanaging a single step',
							},
							{
								label: 'SELF-BUILDING INTERNAL TOOLS',
								input: '"Add a revenue chart to the dashboard"',
								what: 'Developer agent writes widget.tsx, registers it in layout.yaml',
								see: 'New widget appears on dashboard within seconds via HMR',
								outcome: 'Internal tools built without Retool, without deployment, evolved by agents',
							},
							{
								label: 'INFRASTRUCTURE MANAGEMENT',
								input: '"Deploy the billing service to billing.company.com"',
								what: 'DevOps agent reads infra skills, builds Docker image, creates k8s manifests, applies them, sets up DNS',
								see: 'Service deployed and verified, URL pinned to dashboard',
								outcome: 'Infrastructure managed by an agent who knows your stack via skills',
							},
						].map((uc) => (
							<div
								key={uc.label}
								className="bg-lp-card border border-lp-border p-4 flex flex-col"
							>
								<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2">
									{uc.label}
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed space-y-1.5">
									<div>
										<strong className="text-lp-fg">Input:</strong> {uc.input}
									</div>
									<div>
										<strong className="text-lp-fg">What happens:</strong> {uc.what}
									</div>
									<div>
										<strong className="text-lp-fg">What you see:</strong> {uc.see}
									</div>
									<div>
										<strong className="text-lp-fg">Outcome:</strong> {uc.outcome}
									</div>
								</div>
							</div>
						))}
					</div>
				</Section>

				{/* ========== 9. DEFINE YOUR TEAM ========== */}
				<Section id="team">
					<SectionHeader sub="Define agents in YAML. Give them names, roles, tools, and filesystem scope. Start from a template or build your own team.">
						Define Your Team
					</SectionHeader>
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
					<div className="bg-lp-card border border-lp-border p-3">
						<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
							<strong className="text-lp-fg">Example above:</strong>{' '}
							The <strong className="text-lp-fg">Solo Dev Shop</strong> template.
							Start with 2-3 agents, add as you need. You choose the names, the roles, and
							the tools. Same kernel, different distribution.
						</div>
					</div>
				</Section>

				{/* ========== 10. ARCHITECTURE ========== */}
				<Section id="arch">
					<SectionHeader sub="Single Bun process. One SQLite file. No Docker, no Postgres, no Redis. The entire company runs as files you can ls, grep, back up with cp, and fork with git clone.">
						Architecture
					</SectionHeader>
					<div className="flex flex-col gap-1.5">
						{[
							{
								label: 'HUMAN',
								desc: 'CLI \u00B7 Dashboard \u00B7 Telegram \u00B7 Slack (soon) \u00B7 Email (soon)',
							},
							{
								label: 'ORCHESTRATOR',
								desc: 'Watcher \u00B7 Workflows \u00B7 Spawner \u00B7 Context \u00B7 Memory \u00B7 Cron \u00B7 Webhooks \u00B7 SSE Stream',
							},
							{
								label: 'AGENTS',
								desc: 'Claude Agent SDK \u00B7 Codex SDK \u00B7 Role templates \u00B7 13 primitives \u00B7 MCPs \u00B7 Sandboxed FS \u00B7 Memory',
							},
							{
								label: 'STORAGE',
								desc: 'SQLite + Drizzle \u00B7 YAML/Markdown/JSON \u00B7 FTS5 + sqlite-vec \u00B7 Git auto-commit \u00B7 Better Auth',
							},
						].map((l, i) => (
							<div key={l.label}>
								<div
									className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 bg-lp-card border border-lp-border"
								>
									<span
										className="font-mono text-[11px] text-lp-fg tracking-[0.15em] sm:min-w-[120px]"
									>
										{l.label}
									</span>
									<span className="font-sans text-[11px] sm:text-xs text-lp-muted">{l.desc}</span>
								</div>
								{i < 3 && (
									<div className="text-center font-mono text-xs text-lp-dim py-0.5">
										{'\u25BC'}
									</div>
								)}
							</div>
						))}
					</div>
					<div className="mt-6 bg-lp-card border border-lp-border p-4">
						<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2">
							ZERO INFRASTRUCTURE
						</div>
						<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
							No Docker, no Postgres, no Redis, no vector DB. Just Bun + an API key.
						</div>
					</div>
				</Section>

				{/* ========== 11. FILESYSTEM + SEARCH ========== */}
				<Section id="fs">
					<SectionHeader sub="YAML for config. Markdown for knowledge. SQLite for speed. FTS5 + vector embeddings for unified search. Everything is files you can read, grep, and version with Git.">
						Filesystem-Native State
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="/company/">
							{`\u251C\u2500\u2500 company.yaml             # Settings, budget
\u251C\u2500\u2500 team/
\u2502   \u251C\u2500\u2500 agents.yaml          # Agent definitions
\u2502   \u251C\u2500\u2500 roles.yaml           # Role templates
\u2502   \u251C\u2500\u2500 humans.yaml          # Human team members
\u2502   \u251C\u2500\u2500 workflows/           # Process definitions
\u2502   \u251C\u2500\u2500 schedules.yaml       # Cron jobs
\u2502   \u251C\u2500\u2500 webhooks.yaml        # External triggers
\u2502   \u2514\u2500\u2500 policies/            # Approval gates
\u251C\u2500\u2500 tasks/
\u2502   \u251C\u2500\u2500 backlog/             # Queued
\u2502   \u251C\u2500\u2500 active/              # In progress
\u2502   \u251C\u2500\u2500 review/              # Awaiting approval
\u2502   \u251C\u2500\u2500 blocked/             # Needs human
\u2502   \u2514\u2500\u2500 done/                # Completed
\u251C\u2500\u2500 comms/channels/          # Agent communication
\u251C\u2500\u2500 knowledge/               # Company brain
\u251C\u2500\u2500 context/memory/          # Per-agent memories
\u251C\u2500\u2500 skills/                  # Agent Skills (SKILL.md)
\u251C\u2500\u2500 projects/                # Code, docs, assets
\u251C\u2500\u2500 secrets/                 # Encrypted API keys
\u251C\u2500\u2500 infra/                   # Infrastructure config
\u251C\u2500\u2500 logs/                    # Activity, sessions, errors
\u251C\u2500\u2500 dashboard/               # Living dashboard
\u2502   \u251C\u2500\u2500 widgets/             # Custom widgets
\u2502   \u251C\u2500\u2500 pages/               # Custom pages
\u2502   \u251C\u2500\u2500 pins/                # Dashboard pins
\u2502   \u2514\u2500\u2500 overrides/           # Theme, layout
\u2514\u2500\u2500 .data/autopilot.db       # SQLite (FTS5 + vec)`}
						</CodeBlock>
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-4">
								<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2.5">
									HYBRID SEARCH
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed mb-3">
									Two search engines run in parallel. Results merged via
									Reciprocal Rank Fusion.
								</div>
								{[
									{
										label: 'FTS5',
										desc: 'Exact keywords, task IDs, file paths',
									},
									{
										label: 'sqlite-vec',
										desc: 'Semantic similarity, natural language',
									},
								].map((s) => (
									<div
										key={s.label}
										className="flex items-center gap-2 py-1.5"
									>
										<span className="font-mono text-[11px] text-lp-fg min-w-[70px]">
											{s.label}
										</span>
										<span className="font-sans text-[11px] text-lp-ghost">
											{s.desc}
										</span>
									</div>
								))}
							</div>
							<div className="bg-lp-card border border-lp-border p-4">
								<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2">
									GIT-VERSIONED COMPANY
								</div>
								<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
									Every agent action is a git commit. <code className="font-mono text-[11px] text-lp-purple">git diff</code> to see what changed. <code className="font-mono text-[11px] text-lp-purple">git revert</code> to undo.
									Fork a company with <code className="font-mono text-[11px] text-lp-purple">git clone</code>. Back it up with <code className="font-mono text-[11px] text-lp-purple">cp</code>.
								</div>
							</div>
						</div>
					</div>
				</Section>

				{/* ========== 12. CONTEXT & MEMORY ========== */}
				<Section id="memory">
					<SectionHeader sub="Each agent has persistent memory scoped to their role. Facts, decisions, mistakes, learnings. Extracted after every session. Private -- no agent reads another's memory.">
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
							<div className="bg-lp-card border border-lp-border p-4">
								<div className="font-mono text-[10px] text-lp-ghost tracking-[0.15em] mb-2.5">
									CONTEXT ASSEMBLY
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed mb-3">
									Before every session, 4 layers are assembled into the
									agent&apos;s context window:
								</div>
								{[
									{
										label: 'Identity',
										desc: 'Role, rules, team',
										tokens: '~2K',
									},
									{
										label: 'Company State',
										desc: 'Role-scoped snapshot',
										tokens: '~5K',
									},
									{
										label: 'Memory',
										desc: 'Facts, decisions, learnings',
										tokens: '~20K',
									},
									{
										label: 'Task Context',
										desc: 'Spec, plan, code, history',
										tokens: '~15K',
									},
								].map((l, i) => (
									<div
										key={l.label}
										className={`flex justify-between items-center py-1.5 ${i < 3 ? 'border-b border-lp-border' : ''}`}
									>
										<div className="flex items-center gap-2">
											<span className="font-sans text-xs text-lp-fg font-semibold">
												{l.label}
											</span>
											<span className="font-sans text-[11px] text-lp-ghost">
												-- {l.desc}
											</span>
										</div>
										<span className="font-mono text-[10px] text-lp-muted">
											{l.tokens}
										</span>
									</div>
								))}
							</div>
							<div className="bg-lp-card border border-lp-border p-4">
								<div className="font-sans text-[13px] text-lp-fg leading-relaxed">
									<strong className="text-white">Isolation rule:</strong> No
									agent reads another agent's memory. Cross-agent info sharing
									only through channels and task history. If you need info
									outside your scope, use{' '}
									<code className="font-mono text-[11px] text-lp-purple">
										ask_agent
									</code>{' '}
									-- the owning agent decides to share or escalate.
								</div>
							</div>
						</div>
					</div>
				</Section>

				{/* ========== 13. WORKFLOWS ========== */}
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

  - id: human_deploy_prod
    type: human_gate              # YOU approve here
    gate: deploy
    transitions: { approved: deploy_prod }

  - id: complete
    type: terminal`}
					</CodeBlock>
				</Section>

				{/* ========== FOOTER ========== */}
				<section className="py-12 sm:py-20 pb-12 text-center">
					<div className="flex justify-center">
						<QSymbol size={36} />
					</div>
					<h2 className="font-mono text-2xl sm:text-[32px] font-bold text-white mt-6 tracking-[-0.03em]">
						Your AI-native company OS.
					</h2>
					<p className="font-sans text-[15px] text-lp-muted mt-2">
						Open Source. CLI-first. Zero infra. MIT License.
					</p>
					<div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
						<a
							href="https://github.com/questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="font-mono text-xs text-white bg-lp-purple px-6 py-2.5 no-underline hover:bg-lp-purple-light transition-colors"
						>
							github.com/questpie/autopilot
						</a>
						<a
							href="/docs"
							className="font-mono text-xs text-lp-purple border border-lp-border px-6 py-2.5 no-underline hover:border-lp-purple transition-colors"
						>
							Documentation
						</a>
					</div>
					<div className="font-mono text-[11px] text-lp-dim mt-12">
						Built by{' '}
						<a
							href="https://questpie.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-lp-ghost hover:text-lp-fg transition-colors"
						>
							QUESTPIE s.r.o.
						</a>
					</div>
				</section>
			</div>
		</div>
	)
}
