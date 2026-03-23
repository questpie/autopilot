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
				QUESTPIE Autopilot is an AI-native company operating system. You define
				a company as a filesystem, staff it with AI agents backed by Claude, and
				give high-level intents. The agents decompose, plan, implement, review,
				and deploy -- you approve at human gates.
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
						No database. YAML for structured data, Markdown for documents. The
						entire company state lives in files you can{' '}
						<code className="font-mono text-xs text-purple">ls</code>,{' '}
						<code className="font-mono text-xs text-purple">cat</code>,{' '}
						<code className="font-mono text-xs text-purple">grep</code>, back
						up, and version with Git. Tasks move between folders by status.
						Agent memory is YAML. Communication lives in Markdown channels.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">02</span>
						Agents as Employees
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Each agent is defined in YAML with an ID, role template, filesystem
						scope, and tool set. The default template ships 8 agents:{' '}
						<code className="font-mono text-xs text-purple">ceo</code> (meta),{' '}
						<code className="font-mono text-xs text-purple">sam</code>{' '}
						(strategist),{' '}
						<code className="font-mono text-xs text-purple">alex</code>{' '}
						(planner),{' '}
						<code className="font-mono text-xs text-purple">max</code>{' '}
						(developer),{' '}
						<code className="font-mono text-xs text-purple">riley</code>{' '}
						(reviewer),{' '}
						<code className="font-mono text-xs text-purple">ops</code> (devops),{' '}
						<code className="font-mono text-xs text-purple">morgan</code>{' '}
						(marketing),{' '}
						<code className="font-mono text-xs text-purple">jordan</code>{' '}
						(design). Each agent runs as a Claude session via the Anthropic
						Agent SDK with a 4-layer context assembly.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">03</span>
						Primitives, Not Chat
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Agents don't produce text output. They call structured primitives
						-- tool calls with clear targets and effects.{' '}
						<code className="font-mono text-xs text-purple">
							create_task()
						</code>
						,{' '}
						<code className="font-mono text-xs text-purple">
							send_message()
						</code>
						,{' '}
						<code className="font-mono text-xs text-purple">git_commit()</code>
						,{' '}
						<code className="font-mono text-xs text-purple">
							pin_to_board()
						</code>
						. Agent thinking is internal. Only primitive calls produce visible
						effects in the filesystem.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">04</span>
						Workflows as Files
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Workflows define how work moves through the company. They are YAML
						files in{' '}
						<code className="font-mono text-xs text-purple">
							team/workflows/
						</code>
						. The template includes three: development (intent to deployed
						feature), marketing (brief to published content), and incident
						(triage to post-mortem). The CEO agent owns workflow definitions;
						any agent can propose changes with evidence.
					</p>
				</div>

				<div className="border border-border p-4">
					<h3 className="font-sans text-base font-bold text-white mb-2 mt-0">
						<span className="text-purple font-mono mr-2">05</span>
						Orchestrator
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						A single Bun process that watches the filesystem for changes,
						matches events against workflow rules, spawns agent sessions,
						routes tasks, runs cron schedules, handles webhooks, and captures
						session streams for observability. It is the only long-running
						process -- agents are ephemeral.
					</p>
				</div>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Packages
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
							<td className="py-2 pr-4 font-mono text-xs">@questpie/autopilot-spec</td>
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
								@questpie/autopilot-orchestrator
							</td>
							<td className="py-2 text-xs">
								Filesystem watcher, workflow engine, agent spawner, scheduler,
								webhook server
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								packages/agents
							</td>
							<td className="py-2 pr-4 font-mono text-xs">
								@questpie/autopilot-agents
							</td>
							<td className="py-2 text-xs">
								Agent runtime, system prompts, primitive implementations, memory
								extraction
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
								CLI interface -- init, start, ask, attach, inbox, agents, status
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-purple text-xs">
								apps/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs">--</td>
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
				{`bun add -g @questpie/autopilot
autopilot init my-company
cd my-company
export ANTHROPIC_API_KEY=sk-ant-xxx

autopilot start
autopilot ask "Build a landing page for our product"
autopilot attach max`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Documentation
			</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
				<Link
					to="/docs/getting-started"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Getting Started
					</div>
					<div className="text-ghost text-xs">
						Prerequisites, installation, project structure, first commands
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
						Agent definitions, role templates, memory isolation, context
						assembly
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
						Development, marketing, and incident workflows as YAML files
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
						All Autopilot commands -- init, ask, attach, inbox, agents, status
					</div>
				</Link>
				<Link
					to="/docs/integrations"
					className="border border-border p-4 hover:border-purple transition-colors no-underline group"
				>
					<div className="font-sans text-sm font-bold text-white group-hover:text-purple mb-1">
						Integrations
					</div>
					<div className="text-ghost text-xs">
						3-part pattern, secret management, GitHub, Linear, Slack, Stripe
					</div>
				</Link>
			</div>
		</article>
	)
}
