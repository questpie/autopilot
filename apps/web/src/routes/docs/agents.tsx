import { createFileRoute } from '@tanstack/react-router'
import { AgentCard } from '@/components/AgentCard'

export const Route = createFileRoute('/docs/agents')({
	head: () => ({
		meta: [{ title: 'Agents — QUESTPIE Autopilot' }],
	}),
	component: Agents,
})

function Agents() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Agent Roles
			</h1>
			<p className="text-muted text-lg mb-8">
				8 specialized AI agents. Each with distinct tools, filesystem scope, and
				persistent memory.
			</p>

			<div className="grid grid-cols-2 gap-2 mb-10 max-md:grid-cols-1">
				<AgentCard name="Ivan" role="STRATEGIST" desc="Scopes features, writes specs, defines requirements" color="purple" status="idle" />
				<AgentCard name="Adam" role="PLANNER" desc="Creates implementation plans with file-level detail" color="cyan" status="idle" />
				<AgentCard name="Peter" role="DEVELOPER" desc="Writes code, creates branches and PRs" color="green" status="run" />
				<AgentCard name="Marek" role="REVIEWER" desc="Reviews code quality, suggests improvements" color="green" status="idle" />
				<AgentCard name="Ops" role="DEVOPS" desc="Deploys, monitors infrastructure, health checks" color="orange" status="schd" />
				<AgentCard name="Designer" role="DESIGN" desc="UI/UX design, design system, mockups" color="purple-light" status="idle" />
				<AgentCard name="Marketer" role="MARKETING" desc="Copy, social media, campaigns, announcements" color="red" status="idle" />
				<AgentCard name="CEO" role="META" desc="Decomposes intent, manages agents, owns workflows" color="white" status="schd" />
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				How Agents Work
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Each agent is a Claude session (via the Anthropic Agent SDK) with
				persistent identity. Before every session, 4 layers of context are
				assembled:
			</p>
			<ol className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">Identity</strong> (~2K tokens) — role
					definition, rules, team context
				</li>
				<li>
					<strong className="text-fg">Company State</strong> (~5K tokens) —
					role-scoped snapshot of the company filesystem
				</li>
				<li>
					<strong className="text-fg">Memory</strong> (~20K tokens) — facts,
					decisions, mistakes, learnings from past sessions
				</li>
				<li>
					<strong className="text-fg">Task Context</strong> (~15K tokens) — spec,
					plan, code, history for the current task
				</li>
			</ol>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Agent Primitives
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents don't "chat." They call structured primitives. Thinking is
				private and messy. Only tool calls produce visible effects:
			</p>
			<ul className="text-ghost leading-relaxed space-y-1 font-mono text-sm">
				<li>
					<span className="text-purple">send_message</span> — communicate with
					other agents
				</li>
				<li>
					<span className="text-purple">create_task</span> — create new tasks
				</li>
				<li>
					<span className="text-purple">pin_to_board</span> — surface info to the
					dashboard
				</li>
				<li>
					<span className="text-purple">git_commit / git_pr</span> — version
					control operations
				</li>
				<li>
					<span className="text-purple">read_file / write_file</span> — scoped
					filesystem access
				</li>
				<li>
					<span className="text-purple">add_blocker</span> — escalate to human
					when stuck
				</li>
				<li>
					<span className="text-purple">ask_agent</span> — request info from
					another agent
				</li>
				<li>
					<span className="text-purple">http_request</span> — call external APIs
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Memory Isolation
			</h2>
			<p className="text-ghost leading-relaxed">
				No agent reads another agent's memory. Cross-agent information sharing
				happens only through communication channels and task history. If an
				agent needs information outside their scope, they use{' '}
				<code className="font-mono text-xs text-purple">ask_agent</code> — the
				owning agent decides whether to share or escalate to human.
			</p>
		</article>
	)
}
