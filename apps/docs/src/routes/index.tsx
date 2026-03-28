import { createFileRoute } from '@tanstack/react-router'

import { AgentCard } from '@/components/landing/AgentCard'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { ComparisonTable } from '@/components/landing/ComparisonTable'
import { DashboardMock } from '@/components/landing/DashboardMock'
import { Header } from '@/components/landing/Header'
import { NumberStat } from '@/components/landing/NumberStat'
import { PainCard } from '@/components/landing/PainCard'
import { QSymbol } from '@/components/landing/QSymbol'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'
import { ToolCard } from '@/components/landing/ToolCard'
import { UseCaseCard } from '@/components/landing/UseCaseCard'

export const Route = createFileRoute('/')({
	head: () => ({
		meta: [
			{ title: 'QuestPie Autopilot — AI-Native Company Operating System' },
			{
				name: 'description',
				content:
					'Run your company with configurable AI agents defined in YAML. Tasks, code review, deployments, marketing — all automated. Open source, self-hosted, zero infrastructure. MIT license.',
			},
			{
				property: 'og:title',
				content: 'QuestPie Autopilot — AI-Native Company Operating System',
			},
			{
				property: 'og:description',
				content:
					'Run your company with configurable AI agents defined in YAML. Tasks, code review, deployments, marketing — all automated. Open source, self-hosted, zero infrastructure. MIT license.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'QuestPie Autopilot — AI-Native Company Operating System',
			},
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
				<section className="px-4 py-24 md:px-8 md:py-32">
					<div className="flex justify-center mb-8">
						<QSymbol size={48} />
					</div>
					<h1 className="font-mono text-[36px] sm:text-[56px] font-bold text-white m-0 leading-tight tracking-[-0.03em] text-center">
						Your AI-Native
						<br />
						Company OS
					</h1>
					<p className="font-sans text-base sm:text-[18px] text-lp-muted mt-5 leading-relaxed max-w-[640px] mx-auto text-center">
						AI agents that don't chat — they act. Define your team in YAML.
						Give them roles, tools, memory, and workflows. They create tasks,
						write code, deploy services, review PRs, and build dashboards.
						You approve the results.
					</p>
					<div className="mt-6 max-w-[480px] mx-auto">
						<CodeBlock title="terminal">
							{`bun add -g @questpie/autopilot
autopilot init
autopilot start`}
						</CodeBlock>
					</div>
					<p className="font-sans text-[13px] text-lp-muted mt-4 text-center">
						Run your entire company from a single CLI command. Your company
						is a directory. Your agents are YAML. Fork it, version it,
						customize it.
					</p>
					<div className="mt-6 flex gap-2 flex-wrap justify-center">
						<Tag>OPEN SOURCE</Tag>
						<Tag>MIT LICENSE</Tag>
						<Tag>SELF-HOSTED</Tag>
						<Tag>ZERO INFRA</Tag>
					</div>
					<div className="mt-8 flex gap-3 flex-wrap justify-center">
						<a
							href="/docs/getting-started"
							className="font-mono text-xs text-white bg-lp-purple px-6 py-2.5 no-underline hover:bg-lp-purple-light transition-colors"
						>
							Get Started
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="font-mono text-xs text-lp-purple border border-lp-border px-6 py-2.5 no-underline hover:border-lp-purple transition-colors"
						>
							View on GitHub
						</a>
					</div>
				</section>

				{/* ========== 2. THE PROBLEM ========== */}
				<Section id="problem">
					<SectionHeader
						num="01"
						sub="One person. 168 hours a week. Six roles to fill. Something always drops."
					>
						You Can't Afford a Team. You Still Need One.
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						<PainCard
							title="Strategy"
							description="You ship features but nobody is steering the roadmap. You are building, but you are not sure you are building the right thing. There is no one to challenge your assumptions or define next quarter."
						/>
						<PainCard
							title="Development"
							description="You write code all day and still have a backlog that grows faster than you can clear it. Every task spawns two more. Evenings bleed into nights and weekends become sprints."
						/>
						<PainCard
							title="Code Review"
							description="Nobody reviews your code. Bugs ship straight to production. You find them when a user emails you at 2AM. The last time someone audited your code for security issues was never."
						/>
						<PainCard
							title="DevOps"
							description="Deployments are manual, scary, and happen at midnight. Your CI/CD pipeline is a bash script you wrote six months ago and forgot. Staging does not exist because you do not have time to set it up."
						/>
						<PainCard
							title="Marketing"
							description="Your product is invisible because marketing is always the thing you will do next week. Your competitors with worse products are outranking you because they actually write blog posts."
						/>
						<PainCard
							title="Design"
							description="Your UI looks like it was built by a backend engineer — because it was. Users judge your product in 3 seconds. You lose most of them."
						/>
					</div>
					<div className="mt-6 bg-lp-card border border-lp-border p-6 text-center">
						<div className="font-mono text-[14px] text-lp-fg">
							One founder. 168 hours. Six roles. Zero code reviews.
						</div>
					</div>
				</Section>

				{/* ========== 3. DEFINE YOUR AI TEAM ========== */}
				<Section id="team">
					<SectionHeader
						num="02"
						sub="Each agent has its own identity, skills, memory, and tools — all configured in YAML. They don't just respond — they own their work. The Solo Dev template ships with agents for strategy, development, review, DevOps, marketing, and design. Customize them or create your own."
					>
						Define Your AI Team
					</SectionHeader>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
						<AgentCard
							name="CEO"
							role="ORCHESTRATOR"
							desc="Decomposes intent, assigns work, monitors progress"
							status="schd"
						/>
						<AgentCard
							name="Sam"
							role="STRATEGIST"
							desc="Analyzes markets, defines roadmap priorities"
							status="idle"
						/>
						<AgentCard
							name="Alex"
							role="PLANNER"
							desc="Breaks strategy into task trees with dependencies"
							status="idle"
						/>
						<AgentCard
							name="Max"
							role="DEVELOPER"
							desc="Writes code, runs tests, creates PRs"
							status="run"
						/>
						<AgentCard
							name="Riley"
							role="REVIEWER"
							desc="Reviews every line for bugs and security"
							status="idle"
						/>
						<AgentCard
							name="Ops"
							role="DEVOPS"
							desc="Manages deployments, CI/CD, health checks"
							status="schd"
						/>
						<AgentCard
							name="Morgan"
							role="MARKETER"
							desc="Blog posts, social content, SEO copy"
							status="idle"
						/>
						<AgentCard
							name="Jordan"
							role="DESIGNER"
							desc="UI components, design systems, landing pages"
							status="idle"
						/>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<CodeBlock title="team/agents.yaml">
							{`agents:
  ceo:
    name: CEO
    role: Company Orchestrator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]

  max:
    name: Max
    role: Senior Full-Stack Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]
    skills: [typescript, react, bun, testing]
    fs_scope:
      read: ["projects/**", "knowledge/**"]
      write: ["projects/**"]

  riley:
    name: Riley
    role: Code Reviewer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search]

  # Add, remove, or customize any agent.
  # This is YOUR team. Not ours.`}
						</CodeBlock>
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									CONFIGURABLE, NOT FIXED
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									The Solo Dev template ships with 8 agents as an
									example. Start with 2-3, add as you need. You choose
									the names, the roles, the tools, and the models.
									Same kernel, different team.
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									3 PROVIDER BACKENDS
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Claude Agent SDK, Codex SDK, and Anthropic direct.
									Mix models per agent role. Each agent gets its own
									persistent identity, memory, and filesystem scope.
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
									<strong className="text-lp-fg">Persistent memory:</strong>{' '}
									Agents learn from past work. Facts, decisions, mistakes,
									and patterns are extracted after every session. Memory
									survives across sessions and gets better over time.
								</div>
							</div>
						</div>
					</div>
					<div className="mt-4 text-center">
						<a
							href="/features/agents"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							See how agents work →
						</a>
					</div>
				</Section>

				{/* ========== 4. HOW IT WORKS ========== */}
				<Section id="how">
					<SectionHeader
						num="03"
						sub="Human at decision points. Automation everywhere else."
					>
						Intent In. Results Out.
					</SectionHeader>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<div className="bg-lp-card border border-lp-border p-6">
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-3">
								STEP 1
							</div>
							<div className="font-mono text-[14px] text-lp-fg font-semibold mb-2">
								Give Intent
							</div>
							<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
								Tell Autopilot what you want in plain language. Use the
								CLI, the dashboard, or chat. No configuration, no task
								decomposition, no assignment. Just say what you need.
							</div>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-3">
								STEP 2
							</div>
							<div className="font-mono text-[14px] text-lp-fg font-semibold mb-2">
								Agents Execute
							</div>
							<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
								CEO decomposes the request. Sam strategizes. Alex plans.
								Max writes code. Riley reviews it. You watch the entire
								process in real time through the dashboard or terminal.
							</div>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-3">
								STEP 3
							</div>
							<div className="font-mono text-[14px] text-lp-fg font-semibold mb-2">
								You Approve
							</div>
							<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
								Critical decisions pause for your review. Approve a merge.
								Reject a deploy. Redirect a strategy. The workflow resumes
								when you say go. Everything else runs autonomously.
							</div>
						</div>
					</div>
					<CodeBlock title="terminal — giving intent">
						{`$ autopilot chat ceo "Build a pricing page with 3 tiers"

CEO Agent decomposing intent...

Created 4 tasks:

  task-050: Scope pricing page requirements
   -> Assigned to: sam (strategist)

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
					<div className="mt-4 bg-lp-card border border-lp-border p-6 text-center">
						<div className="font-sans text-[13px] text-lp-muted">
							Two human decisions. Ten automated steps. One intent.
						</div>
					</div>
					<div className="mt-4 text-center">
						<a
							href="/docs/getting-started"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							Try it now →
						</a>
					</div>
				</Section>

				{/* ========== 5. TOOLS ========== */}
				<Section id="tools">
					<SectionHeader
						num="04"
						sub="7 custom tools that produce auditable effects + built-in filesystem and terminal access from the SDK — not paragraphs of text you have to copy-paste."
					>
						Agents Act. They Don't Chat.
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
						<ToolCard
							name="task"
							description="Create, update, approve, reject, block, and unblock tasks with full lifecycle tracking. Every task state transition is enforced and logged."
						/>
						<ToolCard
							name="message"
							description="Send messages to channels, DMs, and auto-created task threads. Agents coordinate through persistent, searchable communication."
						/>
						<ToolCard
							name="pin"
							description="Surface important information on the dashboard as info, warning, error, or progress indicators. Agents tell you what matters without you asking."
						/>
						<ToolCard
							name="search"
							description="Query all company knowledge across 7 entity types using FTS5 full-text search. Agents find information before every task."
						/>
						<ToolCard
							name="http"
							description="Make HTTP requests to external APIs with SSRF protection and automatic secret injection. Agents integrate with any service without exposing credentials."
						/>
						<ToolCard
							name="search_web"
							description="Research the web via Brave, Tavily, or SerpAPI without leaving the workflow. Agents gather information as part of their work."
						/>
						<ToolCard
							name="browse"
							description="Read web pages, extract structured content, and take screenshots for visual analysis. Agents can read documentation, check competitors, and verify deployed UIs."
						/>
						<ToolCard
							name="filesystem"
							description="Read, write, and edit files. Full filesystem access through the Claude Agent SDK. Agents write production code, not suggestions."
							variant="builtin"
						/>
						<ToolCard
							name="terminal"
							description="Execute bash commands. Run tests, build projects, manage git. Built into the SDK — agents operate like a developer at a terminal."
							variant="builtin"
						/>
					</div>
					<div className="bg-lp-card border border-lp-border p-6">
						<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
							A chatbot generates text you copy-paste into your editor.
							Autopilot agents call tools that create tasks, send messages,
							write files, and hit APIs. Every action is logged, auditable,
							and reversible.
						</div>
					</div>
					<div className="mt-4 text-center">
						<a
							href="/features/agents"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							Explore the tool system →
						</a>
					</div>
				</Section>

				{/* ========== 6. LIVING DASHBOARD ========== */}
				<Section id="dashboard">
					<SectionHeader
						num="05"
						sub="A real-time dashboard that shows what your AI team is doing, thinking, and waiting on."
					>
						26 Pages. Zero Guesswork.
					</SectionHeader>
					<DashboardMock />
					<div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{[
							{
								label: 'AGENT MONITORING',
								desc: 'See who is working, who is idle, and what each agent is doing right now. Live status updates stream through Server-Sent Events — no refresh needed.',
							},
							{
								label: 'KANBAN BOARD',
								desc: 'Drag tasks across backlog, in-progress, review, and done. Approve or reject tasks directly from the board.',
							},
							{
								label: 'AGENT CHAT',
								desc: 'Chat with agents in persistent channels. @mention any agent by name. They respond in context, with memory of past conversations.',
							},
							{
								label: 'FILE BROWSER',
								desc: 'Navigate the filesystem, view markdown and code with syntax highlighting, upload new knowledge. What you upload, agents can find.',
							},
							{
								label: 'SESSION REPLAY',
								desc: 'Scrub through the timeline of tool calls, messages, and file changes. Debug unexpected behavior by tracing the exact sequence of decisions.',
							},
							{
								label: 'CMD+K',
								desc: 'Hit Cmd+K from any page. Navigate anywhere, search everything, or prefix with > to create a new intent and send work to your AI team.',
							},
						].map((item) => (
							<div
								key={item.label}
								className="bg-lp-card border border-lp-border p-6"
							>
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2">
									{item.label}
								</div>
								<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
									{item.desc}
								</div>
							</div>
						))}
					</div>
					<div className="mt-4 text-center">
						<a
							href="/features/dashboard"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							See the full dashboard →
						</a>
					</div>
				</Section>

				{/* ========== 7. WORKFLOWS ========== */}
				<Section id="workflows">
					<SectionHeader
						num="06"
						sub="Define any process as a state machine. Agents execute the steps. Humans approve at critical points."
					>
						YAML Workflows. Human Gates.
					</SectionHeader>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<CodeBlock title="team/workflows/development.yaml">
							{`steps:
  implement:
    agent: max
    auto: true
    transitions:
      - to: code_review
        condition: implementation_complete
  code_review:
    agent: riley
    auto: true
    transitions:
      - to: approve_merge
        condition: review_passed
  approve_merge:
    type: human_gate
    transitions:
      - to: deploy
        condition: approved
      - to: implement
        condition: rejected`}
						</CodeBlock>
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									HUMAN GATES
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Review steps enforce minimum approvals and match
									reviewers by role. Riley reviews code automatically.
									You approve merges manually. Both are required.
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									3 BUILT-IN WORKFLOWS
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Development (12 steps), Marketing (7 steps), and
									Incident Response (8 steps). Customize them or write
									your own from scratch.
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									GRAPH VALIDATION
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Every workflow is validated before execution. The
									engine checks graph connectivity — unreachable steps
									and invalid transitions are caught before a single
									agent starts working.
								</div>
							</div>
						</div>
					</div>
					<div className="mt-4 text-center">
						<a
							href="/features/workflows"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							Build custom workflows →
						</a>
					</div>
				</Section>

				{/* ========== 8. SECURITY ========== */}
				<Section id="security">
					<SectionHeader
						num="07"
						sub="Enterprise-grade security built from day one. Self-hosted. Encrypted. GDPR-native."
					>
						14 Security Layers. Not an Afterthought.
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{[
							{
								label: 'AUTHENTICATION',
								desc: 'Better Auth with email/password and minimum 12-character password policy. 30-day session expiry. Invite-only registration.',
							},
							{
								label: '2FA',
								desc: 'TOTP-based with 10 backup codes and 30-day device trust. Mandatory for owner and admin roles. Cannot be disabled.',
							},
							{
								label: 'RBAC',
								desc: '4 roles — owner, admin, member, viewer — with granular resource.action permissions. Agent API keys (ap_*) with scoped access.',
							},
							{
								label: 'ENCRYPTION',
								desc: 'AES-256-GCM encrypted secrets with master key isolation. Per-agent secret scoping. Secrets injected at runtime, never stored in plain text.',
							},
							{
								label: 'RATE LIMITING',
								desc: '3-layer: auth endpoints (10/5min), IP-based (20/min), actor-based (300/min humans, 600/min agents).',
							},
							{
								label: 'NETWORK',
								desc: 'IP allowlist with IPv4/IPv6 CIDR. SSRF protection with DNS resolution and private IP blocking on every agent HTTP call.',
							},
							{
								label: 'FILESYSTEM SANDBOX',
								desc: 'Per-agent read/write globs. Hardcoded deny patterns for .auth/, .data/, and .git/. Agents cannot touch what they should not see.',
							},
							{
								label: 'AUDIT LOGS',
								desc: 'Append-only with daily rotation, protected from agent access. Every tool call, message, and auth event logged in parseable JSONL.',
							},
						].map((item) => (
							<div
								key={item.label}
								className="bg-lp-card border border-lp-border p-6"
							>
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2">
									{item.label}
								</div>
								<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
									{item.desc}
								</div>
							</div>
						))}
					</div>
					<div className="mt-4 flex gap-2 flex-wrap justify-center">
						<Tag>MIT LICENSE</Tag>
						<Tag>SELF-HOSTED</Tag>
						<Tag>AES-256-GCM</Tag>
						<Tag>GDPR-NATIVE</Tag>
					</div>
					<div className="mt-4 text-center">
						<a
							href="/features/security"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							Review our security model →
						</a>
					</div>
				</Section>

				{/* ========== 9. ZERO INFRASTRUCTURE ========== */}
				<Section id="infra">
					<SectionHeader
						num="08"
						sub="No Postgres. No Redis. No Kafka. No vector database. Just Bun and SQLite."
					>
						One Process. One File. Done.
					</SectionHeader>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									WHAT YOU NEED
								</div>
								<CodeBlock title="install">
									{`bun add -g @questpie/autopilot && autopilot init && autopilot start`}
								</CodeBlock>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Single Bun process, single SQLite file, approximately
									100MB RAM footprint (typical, varies by workload).
									Everything lives in one directory — back up your
									company by copying a folder.
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-2.5">
									API COSTS
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Varies by model choice, task complexity, and number of
									agents. You bring your own API keys — zero markup from
									us.
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-4">
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-accent-red tracking-[0.15em] mb-2.5">
									WHAT THEY REQUIRE
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									Docker + Postgres + Redis + vector DB + Kafka + S3 +
									load balancer
								</div>
							</div>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-mono text-[10px] text-lp-accent-green tracking-[0.15em] mb-2.5">
									WHAT AUTOPILOT NEEDS
								</div>
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed space-y-2">
									<div>
										<strong className="text-lp-fg">Runtime:</strong>{' '}
										Bun
									</div>
									<div>
										<strong className="text-lp-fg">Database:</strong>{' '}
										SQLite (embedded)
									</div>
									<div>
										<strong className="text-lp-fg">Search:</strong>{' '}
										FTS5 + sqlite-vec (embedded)
									</div>
									<div>
										<strong className="text-lp-fg">Process:</strong>{' '}
										1
									</div>
									<div>
										<strong className="text-lp-fg">
											Docker option:
										</strong>{' '}
										Single container, one volume mount
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="mt-4 text-center">
						<a
							href="/docs/getting-started"
							className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
						>
							Install in 60 seconds →
						</a>
					</div>
				</Section>

				{/* ========== 10. USE CASES ========== */}
				<Section id="usecases">
					<SectionHeader
						num="09"
						sub="Same core platform. Different skills, knowledge, and workflows. Configure it for your business."
					>
						Same Engine. Different Company.
					</SectionHeader>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						<UseCaseCard
							number="01"
							title="SOLO DEV SHOP"
							fields={[
								{
									label: 'WHAT',
									value: 'Run a full development company with AI agents.',
								},
								{
									label: 'TEMPLATE',
									value: 'Solo Dev — strategy, development, review, DevOps, and marketing.',
								},
							]}
							outcome="Roles you never had before, working while you sleep"
							codeTitle="terminal — solo dev"
							code={`$ autopilot chat ceo "Build a pricing page with Stripe"

CEO decomposing...
  task-050: Scope requirements    -> sam
  task-051: Design UI             -> jordan
  task-052: Implement + Stripe    -> max
  task-053: Write copy            -> morgan`}
						/>
						<UseCaseCard
							number="02"
							title="MARKETING AGENCY"
							fields={[
								{
									label: 'WHAT',
									value: 'Scale content output without scaling headcount.',
								},
								{
									label: 'HOW',
									value: 'Per-client knowledge bases and brand voice enforcement.',
								},
							]}
							outcome="Content production that scales with YAML, not payroll"
							codeTitle="terminal — agency"
							code={`$ autopilot chat morgan "Write a blog post
  about our Q2 product launch"

Morgan researching topic...
Morgan writing draft...
Morgan posting to review channel...`}
						/>
						<UseCaseCard
							number="03"
							title="STARTUP TEAM"
							fields={[
								{
									label: 'WHAT',
									value: 'Augment your 2-5 person team with AI agents.',
								},
								{
									label: 'HOW',
									value: 'Code review, DevOps, and QA. Human gates at every critical decision.',
								},
							]}
							outcome="Ship faster without hiring"
							codeTitle="terminal — startup"
							code={`$ autopilot chat ceo "Set up staging env
  with automated deploys from develop branch"

CEO decomposing...
  task-060: Define infra requirements -> ops
  task-061: Write CI/CD pipeline      -> ops`}
						/>
						<UseCaseCard
							number="04"
							title="E-COMMERCE OPS"
							fields={[
								{
									label: 'WHAT',
									value: 'Automate product listings, pricing, inventory monitoring.',
								},
								{
									label: 'HOW',
									value: 'Custom agents for catalog management and customer support.',
								},
							]}
							outcome="Operations that run 24/7 without manual intervention"
							codeTitle="terminal — ecommerce"
							code={`$ autopilot chat ceo "Update all product
  descriptions for the spring collection"

CEO decomposing...
  task-070: Audit current listings    -> sam
  task-071: Write new descriptions    -> morgan`}
						/>
						<UseCaseCard
							number="05"
							title="DEVOPS / INFRA"
							fields={[
								{
									label: 'WHAT',
									value: '5-minute incident triage, automated runbook execution.',
								},
								{
									label: 'HOW',
									value: 'Incident response workflow. Post-mortem knowledge capture.',
								},
							]}
							outcome="Agents learn from every incident"
							codeTitle="terminal — incident"
							code={`$ autopilot chat ops "Production API
  latency is above 500ms"

Ops triaging incident...
Ops checking health endpoints...
Ops running diagnostic playbook...`}
						/>
						<UseCaseCard
							number="06"
							title="INTERNAL TOOLS"
							fields={[
								{
									label: 'WHAT',
									value: 'Invoicing, reporting, contracts, HR onboarding.',
								},
								{
									label: 'HOW',
									value: 'All defined as YAML workflows with human approval gates.',
								},
							]}
							outcome="Business processes automated, not just code"
							codeTitle="terminal — internal"
							code={`$ autopilot chat ceo "Generate Q1 invoice
  report for all active clients"

CEO decomposing...
  task-080: Pull billing data     -> ops
  task-081: Generate report       -> max`}
						/>
					</div>
				</Section>

				{/* ========== 11. COMPETITIVE COMPARISON ========== */}
				<Section id="compare">
					<SectionHeader
						num="10"
						sub="An honest look at where we fit in the landscape."
					>
						How Autopilot Compares
					</SectionHeader>
					<ComparisonTable />
					<div className="mt-4 flex gap-3 flex-wrap justify-center">
						{[
							{ label: 'vs CrewAI', href: '/compare/crewai' },
							{ label: 'vs Devin', href: '/compare/devin' },
							{ label: 'vs n8n', href: '/compare/n8n' },
							{ label: 'vs Dust', href: '/compare/dust' },
						].map((link) => (
							<a
								key={link.label}
								href={link.href}
								className="font-mono text-xs text-lp-purple no-underline hover:text-lp-purple-light transition-colors"
							>
								{link.label} →
							</a>
						))}
					</div>
				</Section>

				{/* ========== 12. NUMBERS ========== */}
				<Section id="numbers">
					<SectionHeader
						num="11"
						sub="Production-grade numbers from a system running in production today."
					>
						This Is Not a Prototype.
					</SectionHeader>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
						<NumberStat
							value="80+"
							label="API endpoints across 22 route files"
						/>
						<NumberStat
							value="7"
							label="Custom agent tools + built-in SDK access"
						/>
						<NumberStat
							value="3"
							label="Agent providers — Claude, OpenAI, Anthropic"
						/>
						<NumberStat
							value="26"
							label="Dashboard pages — live, real-time"
						/>
						<NumberStat
							value="60+"
							label="CLI subcommands — full control"
						/>
						<NumberStat
							value="14"
							label="Security layers — enterprise-grade"
						/>
						<NumberStat
							value="3"
							label="Built-in workflows — dev, marketing, incident"
						/>
						<NumberStat
							value="0"
							label="External dependencies — no Postgres, no Redis"
						/>
						<NumberStat
							value="~100MB"
							label="RAM footprint (typical, varies by workload)"
						/>
						<NumberStat
							value="BYOK"
							label="Bring your own keys — zero markup"
						/>
					</div>
				</Section>

				{/* ========== 13. GETTING STARTED ========== */}
				<Section id="start">
					<SectionHeader
						num="12"
						sub="From zero to running AI company in under five minutes."
					>
						Three Commands. Five Minutes.
					</SectionHeader>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="flex flex-col gap-4">
							<CodeBlock title="install & start">
								{`# Install
bun add -g @questpie/autopilot

# Initialize your company
autopilot init

# Start your AI team
autopilot start`}
							</CodeBlock>
							<div className="bg-lp-card border border-lp-border p-6">
								<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
									The init wizard walks you through company setup, agent
									provider configuration, and team template selection.
									Open{' '}
									<code className="font-mono text-[11px] text-lp-purple">
										localhost:3000
									</code>{' '}
									to see your dashboard with live agent activity.
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-4">
							<CodeBlock title="your first intent">
								{`# Give your first intent via CLI
autopilot chat ceo "Create a project roadmap"

# Or open the dashboard, hit Cmd+K, and type:
# >Create a project roadmap`}
							</CodeBlock>
							<div className="flex gap-3 flex-col sm:flex-row">
								<a
									href="/docs/getting-started"
									className="font-mono text-xs text-white bg-lp-purple px-6 py-2.5 no-underline hover:bg-lp-purple-light transition-colors text-center flex-1"
								>
									Read the Docs
								</a>
								<a
									href="https://github.com/questpie/autopilot"
									target="_blank"
									rel="noopener noreferrer"
									className="font-mono text-xs text-lp-purple border border-lp-border px-6 py-2.5 no-underline hover:border-lp-purple transition-colors text-center flex-1"
								>
									Star on GitHub
								</a>
							</div>
						</div>
					</div>
				</Section>

				{/* ========== FOOTER ========== */}
				<section className="border-t border-lp-border px-4 py-16 md:px-8 md:py-24">
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
						<div>
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-4">
								PRODUCT
							</div>
							<div className="flex flex-col gap-2">
								{[
									{ label: 'Features', href: '/features' },
									{ label: 'Dashboard', href: '/features/dashboard' },
									{ label: 'Workflows', href: '/features/workflows' },
									{ label: 'Security', href: '/features/security' },
									{ label: 'Pricing', href: '/pricing' },
								].map((link) => (
									<a
										key={link.label}
										href={link.href}
										className="font-sans text-[13px] text-lp-ghost no-underline hover:text-lp-fg transition-colors"
									>
										{link.label}
									</a>
								))}
							</div>
						</div>
						<div>
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-4">
								USE CASES
							</div>
							<div className="flex flex-col gap-2">
								{[
									{ label: 'Solo Dev', href: '/use-cases/solo-dev' },
									{ label: 'Agency', href: '/use-cases/agency' },
									{ label: 'Startup', href: '/use-cases/startup' },
									{ label: 'E-commerce', href: '/use-cases/ecommerce' },
									{ label: 'DevOps', href: '/use-cases/devops' },
									{
										label: 'Internal Tools',
										href: '/use-cases/internal-tools',
									},
								].map((link) => (
									<a
										key={link.label}
										href={link.href}
										className="font-sans text-[13px] text-lp-ghost no-underline hover:text-lp-fg transition-colors"
									>
										{link.label}
									</a>
								))}
							</div>
						</div>
						<div>
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-4">
								COMPARE
							</div>
							<div className="flex flex-col gap-2">
								{[
									{ label: 'vs CrewAI', href: '/compare/crewai' },
									{ label: 'vs Devin', href: '/compare/devin' },
									{ label: 'vs n8n', href: '/compare/n8n' },
									{ label: 'vs Dust', href: '/compare/dust' },
									{ label: 'vs OpenClaw', href: '/compare/openclaw' },
								].map((link) => (
									<a
										key={link.label}
										href={link.href}
										className="font-sans text-[13px] text-lp-ghost no-underline hover:text-lp-fg transition-colors"
									>
										{link.label}
									</a>
								))}
							</div>
						</div>
						<div>
							<div className="font-mono text-[10px] text-lp-purple tracking-[0.15em] mb-4">
								RESOURCES
							</div>
							<div className="flex flex-col gap-2">
								{[
									{
										label: 'Documentation',
										href: '/docs',
									},
									{
										label: 'Getting Started',
										href: '/docs/getting-started',
									},
									{
										label: 'GitHub',
										href: 'https://github.com/questpie/autopilot',
										external: true,
									},
									{
										label: 'CLI Reference',
										href: '/docs/cli',
									},
								].map((link) => (
									<a
										key={link.label}
										href={link.href}
										{...('external' in link
											? {
													target: '_blank',
													rel: 'noopener noreferrer',
												}
											: {})}
										className="font-sans text-[13px] text-lp-ghost no-underline hover:text-lp-fg transition-colors"
									>
										{link.label}
									</a>
								))}
							</div>
						</div>
					</div>
					<div className="border-t border-lp-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
						<div className="flex items-center gap-3">
							<QSymbol size={20} />
							<span className="font-mono text-[11px] text-lp-dim">
								Built by{' '}
								<a
									href="https://questpie.com"
									target="_blank"
									rel="noopener noreferrer"
									className="text-lp-ghost hover:text-lp-fg transition-colors no-underline"
								>
									QUESTPIE s.r.o.
								</a>
								{' '} · MIT License
							</span>
						</div>
						<a
							href="/docs/getting-started"
							className="font-mono text-xs text-white bg-lp-purple px-6 py-2.5 no-underline hover:bg-lp-purple-light transition-colors"
						>
							Get Started
						</a>
					</div>
				</section>
			</main>
		</div>
	)
}
