import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/getting-started')({
	head: () => ({
		meta: [{ title: 'Getting Started — QUESTPIE Autopilot' }],
	}),
	component: GettingStarted,
})

function GettingStarted() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Getting Started
			</h1>
			<p className="text-muted text-lg mb-8">
				Set up your AI-powered company in under 5 minutes.
			</p>

			<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-4 mb-8">
				<div className="font-sans text-sm text-fg">
					<strong className="text-white">Coming Soon</strong> — QUESTPIE Autopilot
					is currently in development. Star the{' '}
					<a
						href="https://github.com/questpie/autopilot"
						className="text-purple"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub repo
					</a>{' '}
					to follow progress.
				</div>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Prerequisites
			</h2>
			<ul className="text-ghost leading-relaxed space-y-1">
				<li>
					<a
						href="https://bun.sh"
						className="text-purple"
						target="_blank"
						rel="noopener noreferrer"
					>
						Bun
					</a>{' '}
					v1.0+
				</li>
				<li>
					Anthropic API key (
					<a
						href="https://console.anthropic.com"
						className="text-purple"
						target="_blank"
						rel="noopener noreferrer"
					>
						get one here
					</a>
					)
				</li>
				<li>Docker (optional, for containerized mode)</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Installation
			</h2>
			<CodeBlock title="terminal">
				{`# Initialize a new company
bunx @questpie/autopilot init my-company

# Or install globally
bun add -g @questpie/autopilot
autopilot init my-company`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				First Run
			</h2>
			<CodeBlock title="terminal">
				{`cd my-company
export ANTHROPIC_API_KEY=sk-ant-xxx

# Start the orchestrator
autopilot start

# Give your first intent
autopilot ask "Set up a Next.js project with authentication"

# Watch Peter work in real-time
autopilot attach peter

# Check your inbox for approvals
autopilot inbox`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What Happens Next
			</h2>
			<ol className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">CEO decomposes</strong> — breaks your intent
					into scoped tasks with dependencies
				</li>
				<li>
					<strong className="text-fg">Ivan scopes</strong> — writes specs, defines
					requirements
				</li>
				<li>
					<strong className="text-fg">Adam plans</strong> — creates implementation
					plans with file-level detail
				</li>
				<li>
					<strong className="text-fg">Peter implements</strong> — writes code,
					creates branches and PRs
				</li>
				<li>
					<strong className="text-fg">Marek reviews</strong> — reviews code quality,
					suggests changes
				</li>
				<li>
					<strong className="text-fg">You merge</strong> — human gate for code
					deployment
				</li>
				<li>
					<strong className="text-fg">Ops deploys</strong> — handles infrastructure
					and monitoring
				</li>
				<li>
					<strong className="text-fg">Marketer announces</strong> — writes copy,
					social posts
				</li>
			</ol>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Docker Mode
			</h2>
			<CodeBlock title="docker-compose.yaml">
				{`services:
  autopilot:
    image: ghcr.io/questpie/autopilot:latest
    volumes:
      - ./my-company:/company
    ports:
      - "7777:7777"    # Webhook server + dashboard
      - "7778:7778"    # WebSocket (session streaming)
    environment:
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
    restart: unless-stopped`}
			</CodeBlock>
		</article>
	)
}
