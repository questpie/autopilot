import { createFileRoute } from '@tanstack/react-router'

import { AgentCard } from '@/components/landing/AgentCard'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { DashboardMock } from '@/components/landing/DashboardMock'
import { Header } from '@/components/landing/Header'
import { LiveStream } from '@/components/landing/LiveStream'
import { QSymbol } from '@/components/landing/QSymbol'
import { Section, SectionHeader } from '@/components/landing/Section'
import { ArchitectureDiagram } from '@/components/landing/ArchitectureDiagram'
import { Tag } from '@/components/landing/Tag'
import { UseCaseCard } from '@/components/landing/UseCaseCard'

export const Route = createFileRoute('/')({
	head: () => ({
		meta: [
			{ title: 'QUESTPIE Autopilot — Agents That Act, Not Chat' },
			{
				name: 'description',
				content:
					'Filesystem-native operating system where AI agents run your company through unified tools, human approval gates, and a self-evolving dashboard. Zero infrastructure. Open source.',
			},
			{ property: 'og:title', content: 'QUESTPIE Autopilot — Agents That Act, Not Chat' },
			{
				property: 'og:description',
				content:
					'Filesystem-native operating system where AI agents run your company through unified tools, human approval gates, and a self-evolving dashboard. Zero infrastructure. Open source.',
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
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== 1. HERO ========== */}
				<section className="px-4 py-24 md:px-8">
					<div className="flex justify-center mb-8">
						<QSymbol size={48} />
					</div>
					<h1 className="font-mono text-[40px] sm:text-[64px] font-bold text-white m-0 leading-tight tracking-[-0.03em] text-center">
						Your AI-native
						<br />
						company operating system
					</h1>
					<p className="font-sans text-base sm:text-[20px] text-lp-muted mt-5 font-light leading-relaxed max-w-[640px] mx-auto text-center">
						AI agents that don't chat -- they act. Unified tools create tasks,
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
					<SectionHeader num="01" sub="Install globally, scaffold a company, and give your first intent. One Bun process. One SQLite file. Zero infrastructure.">
						Get Started in 60 Seconds
					</SectionHeader>
					<CodeBlock title="install">
						{`# Docker (recommended for self-hosting)
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash

# Or with Bun
bun add -g @questpie/autopilot
autopilot init my-company
cd my-company

# Set your OpenRouter API key (one key = all models)
autopilot provider set openrouter --api-key sk-or-...

# Start the orchestrator + dashboard
autopilot start

# Open dashboard
open http://localhost:3000

# Send your first task
autopilot chat ceo "Build me a landing page"

# Watch agents work in real-time
autopilot attach max`}
					</CodeBlock>
					<div className="mt-4 bg-lp-card border border-lp-border p-6">
						<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
							<strong className="text-lp-fg">What you need:</strong>{' '}
							Bun runtime + an <code className="font-mono text-[11px] text-lp-purple">OPENROUTER_API_KEY</code>. That's it.
							One key gives you access to 300+ models (Claude, GPT, Gemini, Llama, and more).
							No Docker. No Postgres. No Redis. No vector DB. No Kubernetes.
						</div>
					</div>
					<div className="mt-4 bg-lp-card border border-lp-border p-6">
						<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-3">
							ONE KEY, ALL MODELS
						</div>
						<div className="font-sans text-[13px] text-lp-muted leading-relaxed space-y-1.5">
							<div>
								<strong className="text-lp-fg">OpenRouter:</strong>{' '}
								<code className="font-mono text-[11px] text-lp-purple">OPENROUTER_API_KEY</code> — 300+ models (Claude, GPT, Gemini, Llama, and more)
							</div>
							<div>
								<strong className="text-lp-fg">Per-agent:</strong>{' '}
								Each agent can use a different model (<code className="font-mono text-[11px] text-lp-purple">anthropic/claude-sonnet-4</code>, <code className="font-mono text-[11px] text-lp-purple">openai/gpt-4o</code>)
							</div>
							<div>
								<strong className="text-lp-fg">Embeddings:</strong>{' '}
								Gemini Embedding 2 (multimodal, optional) or local E5
							</div>
						</div>
					</div>
				</Section>

				{/* ========== 3. WHAT IS AUTOPILOT ========== */}
				<Section id="what">
					<SectionHeader num="02" sub="You give a high-level intent. Your AI team decomposes it, plans it, implements it, reviews it, and deploys it. You approve at gates. The agent builds a pricing page and you see it running before it ships.">
						What is Autopilot?
					</SectionHeader>
					<CodeBlock title="terminal -- giving intent">
						{`$ autopilot chat ceo "Build a pricing page for QUESTPIE Studio
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
						filesystem access, and communicates through unified tools -- not
						natural language.
					</p>
				</Section>

				{/* ========== 4. PRIMITIVES, NOT CHAT ========== */}
				<Section id="tools">
					<SectionHeader num="03" sub="Agent thinking is private. Only effects are visible. Every agent action is a typed function call with clear targets and effects -- not a text response for you to parse.">
						Tools, Not Chat
					</SectionHeader>
					<CodeBlock title="what agents actually do">
						{`// Max tells Riley PR is ready
message({
  channel: "dm-riley",
  content: "PR #47 ready for review. Landing page implementation."
})

// Ops pins health status to dashboard
pin({
  action: "create",
  group: "overview",
  title: "Cluster Health",
  content: "12/12 pods OK | CPU 23% | Memory 41% | Disk 55%",
  type: "success"
})

// Riley approves task
task({
  action: "approve",
  task_id: "task-040",
  note: "PR #47 looks good. Ready for merge."
})

// Search across all entity types
search({
  query: "pricing page",
  type: "task",
  scope: "active"
})`}
					</CodeBlock>
					<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="bg-lp-card border border-lp-border p-6">
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2">
								AUTOPILOT AGENTS
							</div>
							<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
								Call 12 unified tools: <code className="font-mono text-[11px] text-lp-purple">task</code>, <code className="font-mono text-[11px] text-lp-purple">message</code>, <code className="font-mono text-[11px] text-lp-purple">pin</code>, <code className="font-mono text-[11px] text-lp-purple">search_index</code>, <code className="font-mono text-[11px] text-lp-purple">fetch</code>, <code className="font-mono text-[11px] text-lp-purple">web_search</code>.
								Every call produces a visible, auditable effect.
							</div>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2">
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
					<SectionHeader num="04" sub="Your agents build your internal tools. In real time. No deploy. The dashboard is a React app in the company filesystem that agents edit -- changes appear in seconds via HMR.">
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
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
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
							<div className="bg-lp-card border border-lp-border p-6">
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
					<SectionHeader num="05" sub="The #1 objection to autonomous AI agents is trust. Autopilot has answers: explicit approval gates, hardcoded deny patterns, live session observation, and a full git audit trail.">
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
									className="bg-lp-card border border-lp-border p-6"
								>
									<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-1">
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
					<SectionHeader num="06" sub="Connect to any running agent and watch them work in real-time. Ctrl+C to detach -- agent keeps working. Replay past sessions for review.">
						Session Attach
					</SectionHeader>
					<LiveStream />
					<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="CLI commands">
							{`autopilot agents              # See who's working
autopilot attach max          # Watch max work live
autopilot replay max          # Review past work
autopilot agents show max     # Agent details & memory
autopilot status              # Company overview`}
						</CodeBlock>
						<CodeBlock title="filter options">
							{`# Only tool calls (skip thinking)
$ autopilot attach max --tools-only

# Compact one-liner mode
$ autopilot attach max --compact

# Replay a past session
$ autopilot replay max`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== 8. USE CASES ========== */}
				<Section id="usecases">
					<SectionHeader num="07" sub="Same Autopilot kernel. Different skills. Different company. Three flagship use cases, validated in production.">
						Use Cases
					</SectionHeader>

					<UseCaseCard
						number="01"
						title="SOLO DEV SHOP"
						fields={[
							{ label: 'INPUT', value: '"Build a pricing page with Stripe"' },
							{ label: 'WHAT HAPPENS', value: 'CEO decomposes, strategist scopes, planner plans, developer implements, reviewer reviews' },
							{ label: 'WHAT YOU SEE', value: 'Task progress on dashboard, PR for merge, live preview via artifact router' },
						]}
						outcome="Feature shipped without micromanaging a single step"
						codeTitle="terminal -- solo dev flow"
						code={`$ autopilot chat ceo "Build a pricing page with Stripe"

CEO Agent decomposing...
  task-050: Scope requirements    -> sam
  task-051: Design UI             -> jordan
  task-052: Implement + Stripe    -> max
  task-053: Write copy            -> morgan

$ autopilot attach max
[max] Reading spec from task-050...
[max] Creating branch: feat/pricing-page
[max] Writing src/pages/pricing.tsx
[max] Adding Stripe checkout...
[max] Running tests... 14/14 passed
[max] PR #47 created -> riley for review`}
					/>

					<UseCaseCard
						number="02"
						title="SELF-BUILDING INTERNAL TOOLS"
						fields={[
							{ label: 'INPUT', value: '"Add a revenue chart to the dashboard"' },
							{ label: 'WHAT HAPPENS', value: 'Developer agent writes widget.tsx, registers it in layout.yaml' },
							{ label: 'WHAT YOU SEE', value: 'New widget appears on dashboard within seconds via HMR' },
						]}
						outcome="Internal tools built without Retool, without deployment, evolved by agents"
						codeTitle="dashboard/widgets/revenue/widget.tsx"
						code={`export default function RevenueChart() {
  const { data } = useQuery({
    queryKey: ['revenue'],
    queryFn: () => sdk.metrics.revenue()
  })

  return (
    <div className="p-4 border border-border">
      <h3>Monthly Revenue</h3>
      <BarChart data={data?.monthly ?? []} />
      <div className="text-sm text-muted">
        MRR: {data?.mrr ?? '...'}
      </div>
    </div>
  )
}`}
					/>

					<UseCaseCard
						number="03"
						title="INFRASTRUCTURE MANAGEMENT"
						fields={[
							{ label: 'INPUT', value: '"Deploy the billing service to billing.company.com"' },
							{ label: 'WHAT HAPPENS', value: 'DevOps agent reads infra skills, builds Docker image, creates k8s manifests, applies them, sets up DNS' },
							{ label: 'WHAT YOU SEE', value: 'Service deployed and verified, URL pinned to dashboard' },
						]}
						outcome="Infrastructure managed by an agent who knows your stack via skills"
						codeTitle="terminal -- ops deploying"
						code={`$ autopilot attach ops
[ops] Reading skill: deploy-k8s
[ops] Building Docker image...
[ops] Image: registry/billing:v2.1.0
[ops] Generating k8s manifests...
[ops] Applying to cluster...
[ops] Waiting for rollout...
[ops] 3/3 pods ready
[ops] Setting DNS: billing.company.com
[ops] Health check: 200 OK

pin({
  action: "create",
  group: "overview",
  title: "billing.company.com LIVE",
  type: "success"
})`}
					/>
				</Section>

{/* ========== 9. DEFINE YOUR TEAM ========== */}
				<Section id="team">
					<SectionHeader num="08" sub="Define agents in YAML. Give them names, roles, tools, and filesystem scope. Start from a template or build your own team.">
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
					<div className="bg-lp-card border border-lp-border p-6">
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
					<SectionHeader num="09" sub="Single Bun process. One SQLite file. No Docker, no Postgres, no Redis. The entire company runs as files you can ls, grep, back up with cp, and fork with git clone.">
						Architecture
					</SectionHeader>
					<ArchitectureDiagram />
					<div className="mt-6 bg-lp-card border border-lp-border p-6">
						<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2">
							ZERO INFRASTRUCTURE
						</div>
						<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
							No Docker, no Postgres, no Redis, no vector DB. Just Bun + an <code className="font-mono text-[11px] text-lp-purple">OPENROUTER_API_KEY</code>.
						</div>
					</div>
				</Section>

				{/* ========== 11. FILESYSTEM + SEARCH ========== */}
				<Section id="fs">
					<SectionHeader num="10" sub="YAML for config and knowledge. SQLite for tasks, messages, sessions, and search. FTS5 + libSQL native vectors for unified search. Everything git-tracked except the database.">
						Filesystem + SQLite Hybrid
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<CodeBlock title="/company/">
							{`company.yaml                 # Company config
team/
  agents.yaml                # Agent definitions
  humans.yaml                # Human team members
  roles.yaml                 # Permission roles
  schedules.yaml             # Cron triggers
  webhooks.yaml              # HTTP event handlers
  workflows/                 # YAML state machines
    development.yaml
    incident.yaml
    marketing.yaml
  policies/
    approval-gates.yaml
knowledge/                   # RAG knowledge base
  brand/
  business/
  technical/
  onboarding/
  integrations/
skills/                      # 20 SKILL.md templates
  git-workflow/
  code-review/
  deployment/
  ...
context/memory/              # Per-agent memories
projects/                    # Code, docs, assets
secrets/                     # Encrypted API keys
dashboard/                   # Living dashboard
  groups.yaml
  widgets/
  pages/
  pins/
.data/autopilot.db           # SQLite database
# DB tables: tasks, messages, activity,
# agent_sessions, search_index
# FTS5 + libSQL native vectors for unified search`}
						</CodeBlock>
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									HYBRID STORAGE
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed mb-3">
									YAML for config and knowledge. SQLite for tasks,
									messages, activity, sessions, and search.
								</div>
								{[
									{
										label: 'YAML',
										desc: 'Config, knowledge, memory, skills',
									},
									{
										label: 'SQLite',
										desc: 'Tasks, messages, activity, sessions, search',
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
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									UNIFIED SEARCH
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
										label: 'libSQL native vectors',
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
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2">
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
					<SectionHeader num="11" sub="Each agent has persistent memory scoped to their role. Facts, decisions, mistakes, learnings. Extracted after every session. Private -- no agent reads another's memory.">
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
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
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
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-sans text-[13px] text-lp-fg leading-relaxed">
									<strong className="text-white">Isolation rule:</strong> No
									agent reads another agent's memory. Cross-agent info sharing
									only through channels and task history. If you need info
									outside your scope, use{' '}
									<code className="font-mono text-[11px] text-lp-purple">
										message
									</code>{' '}
									-- the owning agent decides to share or escalate.
								</div>
							</div>
						</div>
					</div>
				</Section>

				{/* ========== 13. WORKFLOWS ========== */}
				<Section id="workflows">
					<SectionHeader num="12" sub="YAML files in the filesystem. CEO agent owns them. Anyone can propose changes. They evolve based on metrics.">
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
				<section className="border-t border-lp-border px-4 py-24 text-center md:px-8 md:py-32">
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
						<a
							href="/playground"
							className="font-mono text-xs text-lp-muted border border-lp-border px-6 py-2.5 no-underline hover:border-lp-purple hover:text-lp-purple transition-colors"
						>
							Construct Generator
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
			</main>
		</div>
	)
}
