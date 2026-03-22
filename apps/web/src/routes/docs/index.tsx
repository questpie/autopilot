import { createFileRoute, Link } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/')({
	head: () => ({
		meta: [{ title: 'Documentation — QUESTPIE Autopilot' }],
	}),
	component: DocsOverview,
})

function DocsOverview() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				QUESTPIE Autopilot
			</h1>
			<p className="text-muted text-lg mb-8">
				AI-native company operating system. Your company is a container. Your
				employees are agents. You give intent, they execute.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What is Autopilot?
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				QUESTPIE Autopilot is an AI-native company operating system where every
				company runs as an isolated Docker container with a filesystem-based
				database. AI agents serve as employees — each with distinct roles, tools,
				persistent memory, and scoped filesystem access.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				A single founder should be able to operate like a 20-person company.
				Instead of hiring, you define roles. Instead of managing, you give
				intent. Instead of micromanaging, you approve at gates.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				You give high-level intents like{' '}
				<code className="font-mono text-xs text-purple">
					"Build a pricing page with Stripe integration."
				</code>{' '}
				A team of 8 AI agents decomposes, plans, implements, reviews, deploys,
				and announces it. You approve at human gates.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Core Concepts
			</h2>

			<div className="space-y-6 mb-8">
				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">01</span>
						Filesystem as Database
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						No database, no proprietary formats. YAML for structured data,
						Markdown for documents, JSON for configs. Git for versioning. The
						entire company can be{' '}
						<code className="font-mono text-xs text-purple">ls</code>'d,{' '}
						<code className="font-mono text-xs text-purple">cat</code>'d,{' '}
						<code className="font-mono text-xs text-purple">grep</code>'d,
						backed up, forked. Tasks move between folders by status. Agent
						memory is YAML files. Communication lives in Markdown channels.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">02</span>
						Agents as Employees
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						8 specialized AI agents, each with a role (strategist, developer,
						reviewer, planner, devops, marketing, design, meta/CEO), scoped
						filesystem access, persistent memory, and communication abilities.
						Agents don't know they're AI. They see company structure, their
						tasks, their colleagues. Each agent is a Claude session via the
						Anthropic Agent SDK with a 4-layer context assembly.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">03</span>
						Primitives, Not Chat
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Agents don't generate text output. They call structured primitives
						— tool calls with clear targets and effects.{' '}
						<code className="font-mono text-xs text-purple">
							send_message()
						</code>
						,{' '}
						<code className="font-mono text-xs text-purple">
							create_task()
						</code>
						,{' '}
						<code className="font-mono text-xs text-purple">
							git_commit()
						</code>
						,{' '}
						<code className="font-mono text-xs text-purple">
							pin_to_board()
						</code>
						. Agent thinking is private and messy. Only primitive calls produce
						visible effects.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">04</span>
						Workflows as Files
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Workflows define how work moves through the company — from intent
						to deployed feature. They are YAML files owned by the CEO agent.
						Standard workflows include Development (12 steps), Marketing (7
						steps), and Incident response (9 steps). Any agent can propose
						changes with evidence.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">05</span>
						Orchestrator
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						A single Bun process (~1500 LOC) that watches the filesystem for
						changes, matches changes against workflow rules, spawns agent
						sessions, routes tasks, runs cron schedules, handles webhooks,
						dispatches notifications, and captures session streams for
						observability.
					</p>
				</div>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Project Status
			</h2>
			<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-4 mb-8">
				<div className="font-sans text-sm text-fg">
					<strong className="text-white">Early Development</strong> — QUESTPIE
					Autopilot is currently in active development. The spec is complete,
					the landing page is live, and core packages are being built.
				</div>
			</div>
			<ul className="text-ghost leading-relaxed space-y-1 text-sm">
				<li>
					<span className="text-accent-green font-mono mr-1">[done]</span>{' '}
					Complete product specification
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">[done]</span>{' '}
					Landing page and documentation
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">[done]</span>{' '}
					Package structure and schemas (
					<code className="font-mono text-xs text-purple">@questpie/spec</code>
					)
				</li>
				<li>
					<span className="text-accent-yellow font-mono mr-1">[wip]</span>{' '}
					Orchestrator core (
					<code className="font-mono text-xs text-purple">
						@questpie/orchestrator
					</code>
					)
				</li>
				<li>
					<span className="text-accent-yellow font-mono mr-1">[wip]</span>{' '}
					Agent system (
					<code className="font-mono text-xs text-purple">
						@questpie/agents
					</code>
					)
				</li>
				<li>
					<span className="text-muted font-mono mr-1">[todo]</span> CLI (
					<code className="font-mono text-xs text-purple">
						@questpie/autopilot
					</code>
					)
				</li>
				<li>
					<span className="text-muted font-mono mr-1">[todo]</span> Dashboard
					web UI
				</li>
				<li>
					<span className="text-muted font-mono mr-1">[todo]</span> Transport
					integrations (WhatsApp, Slack, Email)
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Package Structure
			</h2>
			<div className="overflow-x-auto mb-8">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Package
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								npm
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Description
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								packages/spec
							</td>
							<td className="py-2 pr-4 font-mono text-xs">@questpie/spec</td>
							<td className="py-2 text-xs">
								Zod schemas, constants, path helpers, validators for all
								filesystem formats
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								packages/orchestrator
							</td>
							<td className="py-2 pr-4 font-mono text-xs">
								@questpie/orchestrator
							</td>
							<td className="py-2 text-xs">
								FS watcher, workflow engine, agent spawner, context assembler,
								scheduler, webhook server
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								packages/agents
							</td>
							<td className="py-2 pr-4 font-mono text-xs">
								@questpie/agents
							</td>
							<td className="py-2 text-xs">
								Agent definitions, system prompts, primitive implementations,
								memory extraction
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								packages/cli
							</td>
							<td className="py-2 pr-4 font-mono text-xs">
								@questpie/autopilot
							</td>
							<td className="py-2 text-xs">
								CLI interface — init, start, ask, attach, inbox, agents, status
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								apps/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs">—</td>
							<td className="py-2 text-xs">
								TanStack Start landing page and documentation site
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Quick Start
			</h2>
			<CodeBlock title="terminal">
				{`$ bunx @questpie/autopilot init my-company
$ cd my-company
$ export ANTHROPIC_API_KEY=sk-ant-xxx
$ autopilot start
$ autopilot ask "Build a landing page for our product"
$ autopilot attach peter  # Watch Peter code in real-time`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Documentation
			</h2>
			<div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
				<Link
					to="/docs/getting-started"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Getting Started
					</div>
					<div className="text-ghost text-xs">
						Prerequisites, installation, first commands, project structure
					</div>
				</Link>
				<Link
					to="/docs/architecture"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Architecture
					</div>
					<div className="text-ghost text-xs">
						Four-layer stack, orchestrator internals, filesystem convention
					</div>
				</Link>
				<Link
					to="/docs/agents"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Agents
					</div>
					<div className="text-ghost text-xs">
						8 agent roles, lifecycle, memory isolation, context assembly
					</div>
				</Link>
				<Link
					to="/docs/primitives"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Primitives
					</div>
					<div className="text-ghost text-xs">
						Structured tool calls, categories, approval gates, code examples
					</div>
				</Link>
				<Link
					to="/docs/workflows"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Workflows
					</div>
					<div className="text-ghost text-xs">
						Development, marketing, incident workflows as YAML files
					</div>
				</Link>
				<Link
					to="/docs/memory"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Context & Memory
					</div>
					<div className="text-ghost text-xs">
						4-layer context assembly, persistent memory, memory extraction
					</div>
				</Link>
				<Link
					to="/docs/cli"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						CLI Reference
					</div>
					<div className="text-ghost text-xs">
						All autopilot commands — init, ask, attach, inbox, agents, status
					</div>
				</Link>
			</div>
		</article>
	)
}
