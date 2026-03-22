import { createFileRoute } from '@tanstack/react-router'
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
				AI-native company operating system.
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
				You give high-level intents like "Build a pricing page with Stripe
				integration." A team of 8 AI agents decomposes, plans, implements,
				reviews, deploys, and announces it. You approve at human gates.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Core Principles
			</h2>
			<ul className="text-ghost leading-relaxed space-y-2 list-none p-0">
				<li className="flex gap-2">
					<span className="text-purple font-mono">01</span>
					<span>
						<strong className="text-fg">Filesystem is the database.</strong> YAML,
						Markdown, JSON. Git for versioning. No proprietary formats.
					</span>
				</li>
				<li className="flex gap-2">
					<span className="text-purple font-mono">02</span>
					<span>
						<strong className="text-fg">Agents are employees.</strong> Each has a
						role, tools, memory, and filesystem scope. They communicate through
						structured primitives.
					</span>
				</li>
				<li className="flex gap-2">
					<span className="text-purple font-mono">03</span>
					<span>
						<strong className="text-fg">You are the CEO.</strong> Give intent,
						approve at gates. Merge code, deploy to prod, publish content.
					</span>
				</li>
				<li className="flex gap-2">
					<span className="text-purple font-mono">04</span>
					<span>
						<strong className="text-fg">Everything is observable.</strong> Attach
						to any agent session like{' '}
						<code className="font-mono text-xs text-purple">kubectl logs -f</code>
						. Replay past sessions. Search across all work.
					</span>
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Quick Example
			</h2>
			<CodeBlock title="terminal">
				{`$ bunx @questpie/autopilot init my-company
$ cd my-company
$ export ANTHROPIC_API_KEY=sk-ant-xxx
$ autopilot start
$ autopilot ask "Build a landing page for our product"
$ autopilot attach peter  # Watch Peter code in real-time`}
			</CodeBlock>
		</article>
	)
}
