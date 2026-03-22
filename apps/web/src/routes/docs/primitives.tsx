import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/primitives')({
	head: () => ({
		meta: [{ title: 'Primitives — QUESTPIE Autopilot' }],
	}),
	component: Primitives,
})

function Primitives() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Primitives
			</h1>
			<p className="text-muted text-lg mb-8">
				Structured tool calls. Not chat. Every agent action is a typed function
				call with clear targets and effects.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What are Primitives?
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents don't generate text output. They call primitives — structured
				tool calls that produce visible effects in the company filesystem. Agent
				thinking is private and messy. Only primitive calls produce observable
				results.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				This is the key difference from chat-based AI systems. There's no
				unstructured output. Every action is typed, validated, scoped, and
				logged. When you{' '}
				<code className="font-mono text-xs text-purple">
					autopilot attach peter
				</code>
				, you see a stream of primitive calls — not a chat transcript.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Communication
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Inter-agent and agent-to-human communication. Messages are written to
				the{' '}
				<code className="font-mono text-xs text-purple">/company/comms/</code>{' '}
				directory.
			</p>
			<CodeBlock title="primitives/communication.ts">
				{`send_message({
  to: 'channel:dev',              // channel, agent, human, or group
  content: 'PR is ready for review. Branch: feat/auth-flow',
  priority: 'normal',             // low | normal | high | urgent
  references: ['TASK-042']        // link to relevant tasks
})

ask_agent({
  to: 'agent:peter',              // request info from another agent
  question: 'What auth library did you use for the login flow?',
  reason: 'Need to document the API endpoints',
  urgency: 'normal',
  references: ['TASK-043']
})`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mt-4 mb-0 text-sm">
				<code className="font-mono text-xs text-purple">send_message</code>{' '}
				targets can be channels (
				<code className="font-mono text-xs text-muted">channel:dev</code>),
				specific agents (
				<code className="font-mono text-xs text-muted">agent:marek</code>),
				humans (
				<code className="font-mono text-xs text-muted">human:dominik</code>), or
				groups (
				<code className="font-mono text-xs text-muted">group:dev-team</code>).{' '}
				<code className="font-mono text-xs text-purple">ask_agent</code> is used
				when an agent needs information outside their filesystem scope — the
				owning agent decides whether to share or escalate.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Tasks
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Task lifecycle management. Tasks are YAML files that move between status
				folders (
				<code className="font-mono text-xs text-purple">
					backlog/ -&gt; active/ -&gt; review/ -&gt; done/
				</code>
				).
			</p>
			<CodeBlock title="primitives/tasks.ts">
				{`create_task({
  title: 'Implement Stripe checkout flow',
  description: 'Add payment processing with Stripe Elements...',
  type: 'feature',                // feature | bugfix | infra | content | research
  priority: 'high',               // low | medium | high | critical
  assigned_to: 'peter',
  project: 'web-app',
  depends_on: ['TASK-040'],       // blocked until dependency completes
  workflow: 'development',        // which workflow to follow
  context: {
    spec: 'projects/web-app/docs/stripe-spec.md',
    plan: 'projects/web-app/docs/stripe-plan.md'
  }
})

update_task({
  task_id: 'TASK-042',
  status: 'review',               // moves file to review/ folder
  note: 'Implementation complete. PR #17 ready for review.'
})

add_blocker({
  task_id: 'TASK-042',
  reason: 'Need Stripe API keys to test webhook integration',
  assigned_to: 'human:dominik',   // escalate to human
  blocking: true
})

resolve_blocker({
  task_id: 'TASK-042',
  note: 'API keys added to secrets/stripe.yaml'
})`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Dashboard
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents pin information to the dashboard for human visibility. Pins can
				include progress bars, action buttons, and auto-expiry.
			</p>
			<CodeBlock title="primitives/dashboard.ts">
				{`pin_to_board({
  group: 'deployments',
  title: 'Staging Deploy: v1.2.0',
  content: 'Deployed to staging. All health checks passing.',
  type: 'status',                  // status | metric | alert | action
  metadata: {
    progress: 100,                 // 0-100 progress bar
    expires_at: '2026-03-23T00:00:00Z',  // auto-remove
    actions: [
      { label: 'Promote to Prod', action: 'approve:TASK-045' },
      { label: 'View Logs', action: 'link:https://logs.example.com' }
    ]
  }
})

unpin_from_board({
  pin_id: 'pin-staging-v120'
})`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Knowledge
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Search and update the company knowledge base. Supports both keyword and
				semantic (embedding-based) search across indexed content.
			</p>
			<CodeBlock title="primitives/knowledge.ts">
				{`search_knowledge({
  query: 'authentication flow',
  scope: 'technical',              // brand | technical | business | legal
  max_results: 5
})

semantic_search({
  query: 'how do we handle user sessions',
  index: 'codebase',              // codebase | knowledge
  max_results: 10,
  threshold: 0.7                  // minimum similarity score
})

update_knowledge({
  path: 'knowledge/technical/auth-decisions.md',
  content: '## Auth Decisions\\n\\n- Using NextAuth with JWT...',
  reason: 'Documenting auth architecture after implementation'
})`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Files & Git
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Scoped filesystem access and git operations. Each agent can only
				read/write within their defined{' '}
				<code className="font-mono text-xs text-purple">fs_scope</code> — the
				orchestrator enforces this.
			</p>
			<CodeBlock title="primitives/files-git.ts">
				{`read_file({ path: 'projects/web-app/code/src/auth.ts' })

write_file({
  path: 'projects/web-app/code/src/checkout.ts',
  content: 'import Stripe from "stripe"\\n...'
})

list_directory({
  path: 'projects/web-app/code/src/',
  recursive: true
})

git_commit({
  repo: 'projects/web-app/code',
  message: 'feat: add Stripe checkout flow',
  files: ['src/checkout.ts', 'src/lib/stripe.ts']
})

git_create_branch({
  repo: 'projects/web-app/code',
  name: 'feat/stripe-checkout',
  from: 'main'
})

git_create_pr({
  repo: 'projects/web-app/code',
  title: 'feat: Stripe checkout integration',
  description: 'Implements checkout flow with Stripe Elements...',
  branch: 'feat/stripe-checkout',
  target: 'main',
  reviewers: ['marek']
})`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				External
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Interact with external services and run system commands. API keys are
				referenced from the encrypted{' '}
				<code className="font-mono text-xs text-purple">/company/secrets/</code>{' '}
				directory.
			</p>
			<CodeBlock title="primitives/external.ts">
				{`http_request({
  method: 'POST',
  url: 'https://api.stripe.com/v1/products',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'name=Premium+Plan&active=true',
  secret_ref: 'secrets/stripe.yaml#api_key'  // auto-injected
})

run_command({
  command: 'bun test',
  working_directory: 'projects/web-app/code',
  timeout_seconds: 120
})

install_tool({
  package_manager: 'bun',
  package: 'stripe',
  global: false
})`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Approval Gates
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Not all actions are equal. Some require human approval, others agents
				handle between themselves. This is configured in{' '}
				<code className="font-mono text-xs text-purple">
					team/policies/approval-gates.yaml
				</code>
				.
			</p>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Requires human approval
			</h3>
			<ul className="text-ghost leading-relaxed space-y-1 text-sm">
				<li>
					<span className="text-accent-red font-mono mr-1">gate</span> Merge
					to main branch
				</li>
				<li>
					<span className="text-accent-red font-mono mr-1">gate</span> Deploy
					to production
				</li>
				<li>
					<span className="text-accent-red font-mono mr-1">gate</span> Publish
					external content (blog posts, social media)
				</li>
				<li>
					<span className="text-accent-red font-mono mr-1">gate</span> Spend
					money (&gt;$10)
				</li>
				<li>
					<span className="text-accent-red font-mono mr-1">gate</span>{' '}
					Create/delete infrastructure
				</li>
				<li>
					<span className="text-accent-red font-mono mr-1">gate</span> Modify
					team structure or policies
				</li>
			</ul>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Agents approve between themselves
			</h3>
			<ul className="text-ghost leading-relaxed space-y-1 text-sm">
				<li>
					<span className="text-accent-green font-mono mr-1">auto</span> Code
					review — reviewer approves or requests changes
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">auto</span> Plan
					review — developer + reviewer validate the plan
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">auto</span> Spec
					review — planner reviews the spec
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">auto</span>{' '}
					Deploy to staging
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">auto</span>{' '}
					Knowledge base updates
				</li>
				<li>
					<span className="text-accent-green font-mono mr-1">auto</span>{' '}
					Health checks and monitoring
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Primitive Summary
			</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Category
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Primitives
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Used by
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Communication</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								send_message, ask_agent
							</td>
							<td className="py-2 text-xs">All agents</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Tasks</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								create_task, update_task, add_blocker, resolve_blocker
							</td>
							<td className="py-2 text-xs">All agents</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Dashboard</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								pin_to_board, unpin_from_board
							</td>
							<td className="py-2 text-xs">All agents</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Knowledge</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								search_knowledge, semantic_search, update_knowledge
							</td>
							<td className="py-2 text-xs">
								Strategist, Planner, Developer
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Files & Git</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								read_file, write_file, list_directory, git_*
							</td>
							<td className="py-2 text-xs">Scoped per agent role</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">External</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								http_request, run_command, install_tool
							</td>
							<td className="py-2 text-xs">Developer, DevOps</td>
						</tr>
					</tbody>
				</table>
			</div>
		</article>
	)
}
