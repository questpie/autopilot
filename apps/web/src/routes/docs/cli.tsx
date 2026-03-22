import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/cli')({
	head: () => ({
		meta: [{ title: 'CLI Reference — QUESTPIE Autopilot' }],
	}),
	component: CLIReference,
})

function CLIReference() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				CLI Reference
			</h1>
			<p className="text-muted text-lg mb-8">
				The <code className="font-mono text-purple">autopilot</code> command
				line interface.
			</p>

			<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-4 mb-8">
				<div className="font-sans text-sm text-fg">
					<strong className="text-white">Coming Soon</strong> — CLI is under
					active development.
				</div>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Core Commands
			</h2>
			<CodeBlock title="getting started">
				{`autopilot init [name]         # Initialize a new company
autopilot start               # Start the orchestrator
autopilot status              # Show company overview`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-6 mb-4">
				Intent & Tasks
			</h2>
			<CodeBlock title="working with tasks">
				{`autopilot ask "<intent>"      # Give high-level intent to CEO
autopilot inbox               # View items needing attention
autopilot tasks               # List all tasks
autopilot approve <task-id>   # Approve a task at human gate
autopilot reject <task-id>    # Reject a task with feedback
autopilot resolve <task-id>   # Resolve a blocker`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-6 mb-4">
				Agents & Observation
			</h2>
			<CodeBlock title="watching agents work">
				{`autopilot agents              # List agents and status
autopilot attach <agent>      # Live-stream agent session
autopilot attach <agent> --compact      # One-line mode
autopilot attach <agent> --tools-only   # Only tool calls
autopilot agent show <agent>  # Agent details and stats
autopilot replay <session-id> # Replay past session
autopilot sessions            # List recent sessions
autopilot sessions search "<query>"     # Search sessions`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-6 mb-4">
				Knowledge & Config
			</h2>
			<CodeBlock title="managing context">
				{`autopilot knowledge add <file>  # Add to company knowledge base
autopilot secrets set <key>     # Store an encrypted secret
autopilot board                 # View dashboard pins
autopilot log                   # View activity feed
autopilot log --agent <name>    # Filter by agent`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-6 mb-4">
				kubectl Analogy
			</h2>
			<div className="text-ghost leading-relaxed">
				<p className="mb-4">
					If you're familiar with Kubernetes, QUESTPIE Autopilot CLI follows
					similar patterns:
				</p>
			</div>
			<CodeBlock title="comparison">
				{`kubectl get pods         \u2192  autopilot agents
kubectl logs -f pod/web  \u2192  autopilot attach peter
kubectl logs pod/web     \u2192  autopilot replay <session>
kubectl describe pod     \u2192  autopilot agent show peter
kubectl top pods         \u2192  autopilot agents --stats
kubectl apply -f ...     \u2192  autopilot ask "..."
kubectl get events       \u2192  autopilot log`}
			</CodeBlock>
		</article>
	)
}
