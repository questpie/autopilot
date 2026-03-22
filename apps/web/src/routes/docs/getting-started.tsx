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
					<strong className="text-white">Coming Soon</strong> — QUESTPIE
					Autopilot is currently in development. Star the{' '}
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
			<ul className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">
						<a
							href="https://bun.sh"
							className="text-purple"
							target="_blank"
							rel="noopener noreferrer"
						>
							Bun
						</a>{' '}
						v1.0+
					</strong>{' '}
					— runtime, package manager, and test runner. Install with{' '}
					<code className="font-mono text-xs text-purple">
						curl -fsSL https://bun.sh/install | bash
					</code>
				</li>
				<li>
					<strong className="text-fg">Anthropic API key</strong> — agents run
					on Claude via the Agent SDK. Get a key from{' '}
					<a
						href="https://console.anthropic.com"
						className="text-purple"
						target="_blank"
						rel="noopener noreferrer"
					>
						console.anthropic.com
					</a>
				</li>
				<li>
					<strong className="text-fg">Git</strong> — required for versioning
					company state and code operations
				</li>
				<li>
					<strong className="text-fg">Docker</strong> (optional) — for
					containerized mode where each company runs in isolation
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Installation
			</h2>
			<CodeBlock title="terminal">
				{`# Initialize a new company (creates directory + scaffolds filesystem)
bunx @questpie/autopilot init my-company

# Or install globally first
bun add -g @questpie/autopilot
autopilot init my-company`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Project Structure After Init
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				After running{' '}
				<code className="font-mono text-xs text-purple">autopilot init</code>,
				you get a complete company filesystem:
			</p>
			<CodeBlock title="my-company/">
				{`company.yaml                  # Company name, settings, budget limits
team/
  agents.yaml                 # Agent definitions (name, role, tools, scope)
  humans.yaml                 # Human team members + notification prefs
  workflows/
    development.yaml           # Intent -> Scope -> Plan -> Implement -> Review -> Deploy
    marketing.yaml             # Brief -> Content -> Design -> Review -> Publish
    incident.yaml              # Triage -> Fix -> Review -> Deploy -> Verify
  schedules.yaml              # Cron jobs: daily standup, weekly metrics, etc.
  webhooks.yaml               # GitHub push, Stripe events, etc.
  transports.yaml             # Notification routing (email, WhatsApp, Slack)
  policies/
    approval-gates.yaml        # What requires human approval
    information-sharing.yaml   # What agents can share with each other
tasks/
  backlog/                    # Unassigned tasks
  active/                     # Tasks being worked on
  review/                     # Awaiting review/approval
  blocked/                    # Waiting on human or external
  done/                       # Completed (auto-archived)
comms/
  channels/                   # dev, ops, marketing, general
  direct/                     # Agent-to-agent direct messages
knowledge/
  brand/                      # Brand guidelines, tone of voice
  technical/                  # Stack conventions, architecture decisions
  business/                   # Strategy, pricing, market research
  onboarding/                 # How to work in this company
projects/                     # Code repos, design assets, marketing materials
context/
  memory/                     # Per-agent persistent memory (YAML)
  indexes/                    # Embedding indexes for semantic search
  snapshots/                  # Role-scoped company state snapshots
secrets/                      # Encrypted API keys and credentials
dashboard/                    # Board pins from agents
logs/                         # Activity feed, session streams, error logs`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				First Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Start the orchestrator
			</h3>
			<CodeBlock title="terminal">
				{`cd my-company
export ANTHROPIC_API_KEY=sk-ant-xxx

# Start the orchestrator (FS watcher + scheduler + webhook server)
autopilot start`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Check status
			</h3>
			<CodeBlock title="terminal">
				{`# Company overview — agents, active tasks, recent activity
autopilot status

# Output:
# QUESTPIE Autopilot — my-company
# Agents: 8 defined (from template), 0 active
# Tasks:  0 backlog, 0 active, 0 review, 0 blocked
# Uptime: 2m 14s`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Give your first intent
			</h3>
			<CodeBlock title="terminal">
				{`# High-level intent — CEO agent decomposes into tasks
autopilot ask "Set up a Next.js project with authentication"

# The CEO agent will:
# 1. Decompose into scoped tasks (setup, auth, testing, deployment)
# 2. Route to strategist for scoping
# 3. Then planner for implementation plan
# 4. Then developer for code
# 5. Then reviewer for code review
# 6. You merge, devops deploys`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Watch agents work
			</h3>
			<CodeBlock title="terminal">
				{`# List all agents and their current status
autopilot agents

# Live-stream an agent's session (like kubectl logs -f)
autopilot attach max

# Compact mode — one line per tool call
autopilot attach max --compact

# Only show tool calls, skip thinking
autopilot attach max --tools-only`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Handle approvals
			</h3>
			<CodeBlock title="terminal">
				{`# Check your inbox for items needing attention
autopilot inbox

# Approve a task at a human gate (merge, deploy, publish)
autopilot approve TASK-001

# Reject with feedback — agent will rework
autopilot reject TASK-001 --reason "Needs error handling for edge cases"`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Configuration
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The root{' '}
				<code className="font-mono text-xs text-purple">company.yaml</code> file
				controls global settings:
			</p>
			<CodeBlock title="company.yaml">
				{`name: my-company
version: "1.0"
description: "AI-powered SaaS startup"

settings:
  model: claude-sonnet-4-20250514      # Default model for agents
  max_concurrent_agents: 3        # How many agents can run at once
  session_timeout: 30m            # Max session duration
  auto_archive_done: true         # Move done tasks to archive

budget:
  daily_limit_usd: 50             # Daily API spend limit
  alert_threshold: 0.8            # Alert at 80% of limit

git:
  auto_commit: true               # Auto-commit filesystem changes
  main_branch: main

server:
  webhook_port: 7777              # Webhook + dashboard port
  ws_port: 7778                   # WebSocket for session streaming`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Docker Mode
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				For production use, run each company in an isolated Docker container.
				The container mounts the company filesystem and exposes webhook +
				WebSocket ports:
			</p>
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

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What Happens Under the Hood
			</h2>
			<ol className="text-ghost leading-relaxed space-y-3">
				<li>
					<strong className="text-fg">CEO decomposes</strong> — breaks your
					intent into scoped tasks with dependencies and assigns them to the
					development workflow
				</li>
				<li>
					<strong className="text-fg">Strategist scopes</strong> —
					writes specs, defines business requirements, success criteria
				</li>
				<li>
					<strong className="text-fg">Planner plans</strong> — creates
					file-level implementation plans with estimated complexity
				</li>
				<li>
					<strong className="text-fg">Developer implements</strong> —
					writes code, creates branches and PRs, runs tests
				</li>
				<li>
					<strong className="text-fg">Reviewer reviews</strong> —
					reviews code quality, checks against spec, suggests improvements
				</li>
				<li>
					<strong className="text-fg">You merge</strong> — human gate for code
					deployment. You review the PR and merge to main
				</li>
				<li>
					<strong className="text-fg">DevOps deploys</strong> — handles
					infrastructure, deploys to staging, then production after your
					approval
				</li>
				<li>
					<strong className="text-fg">Marketer announces</strong> — writes
					release notes, social posts, campaign copy
				</li>
			</ol>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Next Steps
			</h2>
			<ul className="text-ghost leading-relaxed space-y-1">
				<li>
					Read the{' '}
					<a href="/docs/architecture" className="text-purple">
						Architecture
					</a>{' '}
					docs to understand the four-layer stack
				</li>
				<li>
					Learn about the{' '}
					<a href="/docs/agents" className="text-purple">
						Agent system
					</a>{' '}
					— defining agents, role templates, and filesystem scopes
				</li>
				<li>
					Explore{' '}
					<a href="/docs/primitives" className="text-purple">
						Primitives
					</a>{' '}
					— the structured tool calls agents use
				</li>
				<li>
					See the{' '}
					<a href="/docs/cli" className="text-purple">
						CLI Reference
					</a>{' '}
					for all available commands
				</li>
			</ul>
		</article>
	)
}
