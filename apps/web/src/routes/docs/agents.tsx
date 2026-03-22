import { createFileRoute } from '@tanstack/react-router'
import { AgentCard } from '@/components/AgentCard'
import { CodeBlock } from '@/components/CodeBlock'

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
				Agents
			</h1>
			<p className="text-muted text-lg mb-8">
				Define your AI team. Each agent gets a name, a role template, tools,
				filesystem scope, and their own persistent memory.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Example: Solo Dev Shop Template
			</h2>
			<div className="grid grid-cols-2 gap-2 mb-4 max-md:grid-cols-1">
				<AgentCard name="Sam" role="STRATEGIST" desc="Scopes features, writes specs, defines requirements" color="purple" status="idle" />
				<AgentCard name="Alex" role="PLANNER" desc="Creates implementation plans with file-level detail" color="cyan" status="idle" />
				<AgentCard name="Max" role="DEVELOPER" desc="Writes code, creates branches and PRs" color="green" status="run" />
				<AgentCard name="Riley" role="REVIEWER" desc="Reviews code quality, suggests improvements" color="green" status="idle" />
				<AgentCard name="Ops" role="DEVOPS" desc="Deploys, monitors infrastructure, health checks" color="orange" status="schd" />
				<AgentCard name="Jordan" role="DESIGN" desc="UI/UX design, design system, mockups" color="purple-light" status="idle" />
				<AgentCard name="Morgan" role="MARKETING" desc="Copy, social media, campaigns, announcements" color="red" status="idle" />
				<AgentCard name="CEO" role="META" desc="Decomposes intent, manages agents, owns workflows" color="white" status="schd" />
			</div>
			<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-3 mb-8">
				<div className="font-sans text-[12px] text-muted leading-relaxed">
					This is the default <strong className="text-purple">Solo Dev Shop</strong> template.
					You choose the names, roles, and how many agents you need.
					Multiple agents can share the same role.
				</div>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Defining Agents
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents are defined in{' '}
				<code className="font-mono text-xs text-purple">/company/team/agents.yaml</code>.
				Each agent gets a name, a role template, a description, filesystem scope, and tools.
			</p>
			<CodeBlock title="/company/team/agents.yaml">
				{`agents:
  - id: sam
    name: Sam
    role: strategist
    description: "Scopes features, writes specs, analyzes requirements"
    fs_scope:
      read: ["/knowledge/**", "/projects/*/docs/**", "/tasks/**"]
      write: ["/projects/*/docs/**", "/tasks/**", "/comms/**"]
    tools: [read_file, write_file, send_message, create_task, search_knowledge]

  - id: max
    name: Max
    role: developer
    description: "Writes code, creates branches and PRs"
    fs_scope:
      read: ["/knowledge/technical/**", "/projects/**", "/tasks/**"]
      write: ["/projects/*/code/**", "/tasks/**", "/comms/**"]
    tools: [read_file, write_file, git_commit, git_create_pr, send_message]

  # Multiple agents can share a role
  - id: alice
    name: Alice
    role: developer
    description: "Frontend specialist, React and CSS"
    fs_scope:
      read: ["/projects/frontend/**", "/tasks/**"]
      write: ["/projects/frontend/**", "/tasks/**", "/comms/**"]
    tools: [read_file, write_file, git_commit, git_create_pr, send_message]`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Managing Agents
			</h2>
			<CodeBlock title="terminal">
				{`# Add a new agent
autopilot agent add --name "Alice" --role developer --desc "Frontend specialist"

# Remove an agent
autopilot agent remove alice

# List all agents
autopilot agents

# The CEO agent can also manage the roster
autopilot ask "Add a QA agent for testing"`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Role Templates
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Roles define the default tools, filesystem scope, and system prompt for an agent.
				Built-in templates include:
			</p>
			<ul className="text-ghost leading-relaxed space-y-1 font-mono text-sm">
				<li><span className="text-purple">strategist</span> — scopes features, writes specs</li>
				<li><span className="text-purple">planner</span> — creates implementation plans</li>
				<li><span className="text-purple">developer</span> — writes code, creates PRs</li>
				<li><span className="text-purple">reviewer</span> — reviews code quality</li>
				<li><span className="text-purple">devops</span> — deploys, monitors infrastructure</li>
				<li><span className="text-purple">design</span> — UI/UX, design system</li>
				<li><span className="text-purple">marketing</span> — copy, social, campaigns</li>
				<li><span className="text-purple">meta</span> — decomposes intent, manages team (CEO)</li>
			</ul>
			<p className="text-ghost leading-relaxed mt-4 mb-4">
				You can also create custom roles by defining a new role template in{' '}
				<code className="font-mono text-xs text-purple">/company/team/roles/</code>.
			</p>

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
