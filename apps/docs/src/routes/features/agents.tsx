import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'
import { ToolCard } from '@/components/landing/ToolCard'

export const Route = createFileRoute('/features/agents')({
	head: () => ({
		meta: [
			{ title: 'AI Agent System — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Configurable AI agents with persistent identity, memory, and tools. Define your team in YAML. Multi-provider support for Claude, GPT, and Gemini.',
			},
			{
				property: 'og:title',
				content: 'AI Agent System — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Configurable AI agents with persistent identity, memory, and tools. Define your team in YAML. Multi-provider support for Claude, GPT, and Gemini.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/agents',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'AI Agent System — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/agents',
			},
		],
	}),
	component: FeatureAgentsPage,
})

function FeatureAgentsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>AGENTS</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						YAML Agents. 7 Custom Tools
						<br />
						+ Built-In Access.
						<br />
						Persistent Memory.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						A multi-agent system where each agent has its own identity, skills,
						memory, and tools — all defined in YAML. Not a chatbot wrapper — a
						team you configure.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The Solo Dev template ships with 8 agents covering every company
						role from strategy to design — but you define your own. Add agents,
						remove agents, change roles. 3 provider backends let you mix
						Claude, GPT, and Anthropic direct models per agent role. Persistent
						memory survives across sessions — agents learn from past work and
						get better at their job over time.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Every agent action produces structured, auditable effects through 7
						custom tools (task, message, pin, search, http, search_web, browse)
						plus built-in filesystem and terminal access from the SDK. No text
						generation to copy-paste. No hallucinated answers. Real tool calls
						that create tasks, send messages, write files, and hit APIs.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
					</div>
				</section>

				{/* ========== SOLO DEV TEMPLATE AGENTS ========== */}
				<Section id="agents">
					<SectionHeader
						num="01"
						sub="Each agent is configured in YAML with a role prompt, tool access, and model assignment."
					>
						A Full Team, Ready to Customize
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								CEO
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								The orchestrator. When you give an intent like "build a
								pricing page," CEO decomposes it into specific tasks, assigns
								each to the right agent based on their skills, and monitors
								progress until every task is complete. CEO uses all 7 custom
								tools plus built-in SDK tools and sees the full company
								state.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Sam (Strategist)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Analyzes the market and defines priorities. Sam uses
								search_web and browse to research competitors, reads your
								company knowledge for context, and writes strategy documents
								that inform every downstream decision. When your roadmap
								drifts, Sam corrects it.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Alex (Planner)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Converts strategy into task trees. Each task gets
								dependencies, effort estimates, and an assigned agent. Alex
								uses the task and search tools to organize your backlog into
								actionable work. No more vague to-do lists.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Max (Developer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes production code. Max has full filesystem access
								through the Claude Agent SDK — reading files, writing code,
								editing existing modules, and running bash commands. Max
								creates branches, runs tests, and produces PRs ready for
								review.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Riley (Reviewer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Audits every line of code. Riley checks for bugs, security
								vulnerabilities, performance regressions, and convention
								violations. Riley uses the search tool to cross-reference
								your coding standards and the message tool to leave detailed
								review comments. Bad code gets blocked.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Ops (DevOps)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Handles deployments and infrastructure. Ops writes CI/CD
								pipelines, manages staging and production deploys, runs
								health checks after each deployment, and monitors
								infrastructure status. The http tool lets Ops integrate with
								any deployment platform.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Morgan (Marketer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Produces content. Blog posts, social media copy, SEO
								articles, email campaigns — Morgan handles all of it. Morgan
								uses search_web to research topics, browse to analyze
								competitor content, and the message tool to coordinate with
								the team on publishing schedules.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Jordan (Designer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates visual work. UI components, design systems, landing
								pages, and visual assets. Jordan uses the browse tool to
								study reference designs and the task tool to track design
								deliverables.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="agents.yaml">
							{`agents:
  max:
    name: Max
    role: Senior Full-Stack Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]
    skills: [typescript, react, bun, testing]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== 7 CUSTOM TOOLS ========== */}
				<Section id="tools">
					<SectionHeader
						num="02"
						sub="Agents call 7 custom tools that produce real changes, plus built-in filesystem and terminal access from the SDK — not text you have to copy-paste."
					>
						Structured Tools. Auditable Effects.
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						<ToolCard
							name="task"
							description="Manages the full task lifecycle. Create with title, description, and priority. Update status, assign to agents, set dependencies. Approve or reject. Every status transition is enforced."
						/>
						<ToolCard
							name="message"
							description="Communication across the company. Send to any channel type: group, DM, broadcast, task-scoped threads, or project-wide coordination. @mentions trigger intelligent routing."
						/>
						<ToolCard
							name="pin"
							description="Surfaces critical information on the dashboard. Severity levels: info, warning, error, and progress. The agent's way of raising a flag without interrupting your workflow."
						/>
						<ToolCard
							name="search"
							description="Queries the unified index across 7 entity types: tasks, messages, knowledge, agents, channels, files, and artifacts. FTS5 with Porter stemming finds results instantly."
						/>
						<ToolCard
							name="http"
							description="External API calls with built-in protection. SSRF defense, DNS resolution blocks private IPs. Secrets injected at runtime. Every call logged with full request and response."
						/>
						<ToolCard
							name="search_web"
							description="Extends agent research beyond company knowledge. Query Brave Search, Tavily, or SerpAPI from within any workflow. Research competitors, find docs, gather data."
						/>
						<ToolCard
							name="browse"
							description="Reads web pages and extracts structured content. Load URLs, parse HTML, extract text and data, take screenshots for visual analysis."
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
						<ToolCard
							name="filesystem"
							variant="builtin"
							description="Read, Write, Edit files and List directories. Built into the Claude Agent SDK. Available to agents with filesystem access configured."
						/>
						<ToolCard
							name="bash"
							variant="builtin"
							description="Execute terminal commands. Run tests, build projects, manage git. Built into the SDK and scoped by agent configuration."
						/>
					</div>

					<p className="font-sans text-xs text-lp-muted mt-6">
						Every tool call is logged with the agent identity, timestamp, input
						parameters, and output. Full audit trail. No black boxes.
					</p>
				</Section>

				{/* ========== 3 PROVIDERS ========== */}
				<Section id="providers">
					<SectionHeader
						num="03"
						sub="Choose the right model for each agent. Claude for code, GPT for reasoning, swap anytime."
					>
						Mix Models Per Agent Role
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Claude Agent SDK
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Full filesystem tools — Read, Write, Edit, and Bash commands.
								Primary provider for coding agents like Max and Riley.
								Subscription-based login means no API key management. Best
								for agents that need to touch the filesystem.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Codex SDK
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Connects to OpenAI's ecosystem. GPT-4o, o3, and o4-mini
								models. Multi-turn tool results for complex reasoning tasks.
								Best for planning, strategy, and content generation where
								filesystem access is not needed.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Anthropic Direct
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Claude models through your API key without SDK overhead. Good
								for non-coding agents that need Claude's reasoning without
								filesystem tools. Lighter weight, lower latency for simple
								tasks.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — providers">
							{`agents:
  max:
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
  morgan:
    provider: codex-sdk
    model: gpt-4o
  sam:
    provider: anthropic
    model: claude-sonnet-4-20250514`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== 6-LAYER CONTEXT ========== */}
				<Section id="context">
					<SectionHeader
						num="04"
						sub="A 6-layer context system that ensures agents always have the right information, in the right order."
					>
						48K Tokens. Every One Counts.
					</SectionHeader>

					<div className="space-y-4">
						{[
							{
								layer: 'Layer 1 — Identity',
								tokens: '~2K tokens',
								description:
									'The role prompt loaded from a markdown file. Defines who the agent is, how it behaves, what standards it follows, and what it should never do. Always present.',
							},
							{
								layer: 'Layer 2 — MCP Tools',
								tokens: '~2K tokens',
								description:
									'Tool documentation placed early in the context and never truncated. Agents always know what tools are available and how to call them.',
							},
							{
								layer: 'Layer 3 — Company State',
								tokens: '~5K tokens',
								description:
									'Current tasks, recent messages, active pins. The agent sees the world as it is right now — who is working on what, what is blocked, what needs attention.',
							},
							{
								layer: 'Layer 4 — Task Context',
								tokens: '~15K tokens',
								description:
									"The current task details, full discussion thread, and related files. This is the agent's focus — everything it needs to do its specific job.",
							},
							{
								layer: 'Layer 5 — Skills Discovery',
								tokens: '~2K tokens',
								description:
									'Available skills and their descriptions. Agents know what capabilities are available on demand.',
							},
							{
								layer: 'Layer 6 — Agent Memory',
								tokens: '~16K tokens',
								description:
									'Persistent memory from past sessions. Placed last because it is the most expendable. Memory gets trimmed before tools or task context.',
							},
						].map((item) => (
							<div
								key={item.layer}
								className="bg-lp-card border border-lp-border p-6 flex flex-col sm:flex-row sm:items-start gap-4"
							>
								<div className="sm:w-48 flex-shrink-0">
									<h3 className="font-mono text-sm font-bold text-white m-0">
										{item.layer}
									</h3>
									<span className="font-mono text-[11px] text-lp-purple">
										{item.tokens}
									</span>
								</div>
								<p className="font-sans text-xs text-lp-muted leading-relaxed m-0">
									{item.description}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6">
						Tools are never truncated. Memory is trimmed first. An agent that
						forgets a fact is annoying. An agent that forgets how to use its
						tools is broken.
					</p>
				</Section>

				{/* ========== PERSISTENT MEMORY ========== */}
				<Section id="memory">
					<SectionHeader
						num="05"
						sub="Post-session memory extraction ensures agents get better at their job over time."
					>
						Agents That Learn
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Structured Extraction
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								After each session, Claude Haiku extracts structured memory
								at approximately $0.004 per session. Memory is organized
								into categories: bio, facts, decisions (capped at 50),
								mistakes (capped at 20), and patterns (capped at 30).
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Memory Isolation
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								No agent reads another agent's memory. Max does not see
								Riley's review patterns. Morgan does not see Ops' deployment
								procedures. Each agent builds its own understanding of the
								world.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 md:col-span-2">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Measurable Improvement
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								The first time Max deploys your project, he asks for the
								deploy script path, the branch naming convention, and the
								staging URL. By the fifth session, Max remembers all of it.
								He follows your patterns, references your architecture
								decisions, and avoids mistakes he made in earlier sessions.
								Memory is loaded into a 16K token budget per session. If
								memory exceeds the budget, older items are trimmed while
								recent decisions and learned mistakes are preserved.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== SESSION STREAMING ========== */}
				<Section id="sessions">
					<SectionHeader
						num="06"
						sub="Live-attach to any agent session. Replay historical sessions to understand every decision."
					>
						Watch Agents Work. Replay Anything.
					</SectionHeader>

					<div className="max-w-[640px]">
						<CodeBlock title="terminal">
							{`autopilot attach max`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Attach to a live session from your terminal with one command. Tool
						calls, code diffs, messages, and file changes stream in real time
						as the agent works.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The dashboard session view shows the same real-time stream with
						syntax-highlighted code, structured tool call outputs, and inline
						diffs. Watch Max write a function, see Riley flag a security issue,
						observe Ops run a health check — all happening live.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Session replay loads from stored JSONL logs. Select any historical
						session from the session picker by agent, date, or task. Scrub
						through the complete timeline to understand exactly what happened,
						what tools were called, and why specific decisions were made.
					</p>
				</Section>

				{/* ========== CUSTOM AGENTS ========== */}
				<Section id="custom-agents">
					<SectionHeader
						num="07"
						sub="Add agents for any role. YAML config, markdown role prompt, done."
					>
						Define Your Own Agents
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Define new agents in your company YAML configuration. Write role
						prompts in markdown — as detailed or minimal as your use case
						requires. Assign specific tools, skills, and model providers per
						agent. Set filesystem access scopes to control exactly which
						directories each agent can read and write.
					</p>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="company.yaml — custom agent">
							{`agents:
  accountant:
    name: Penny
    role: Financial Controller
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [accounting, invoicing, vat]
    fs_scope:
      read: ["./finances/**", "./contracts/**"]
      write: ["./finances/reports/**"]`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Custom agents appear in the team grid alongside the template
						defaults. They get their own memory, their own session history, and
						their own context assembly. They participate in workflows, receive
						@mentions in chat, and show up in the dashboard with live status
						indicators.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Define your AI team
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						YAML configuration, persistent memory, 7 custom tools. Start in
						under 5 minutes.
					</p>
					<a
						href="/docs/getting-started"
						className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
					>
						Get Started
					</a>
				</section>
			</main>
		</div>
	)
}
