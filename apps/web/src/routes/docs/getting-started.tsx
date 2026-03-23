import { createFileRoute, Link } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/getting-started')({
	head: () => ({ ...seoHead({ title: 'Getting Started', description: 'Install QUESTPIE Autopilot, create your first company, and run AI agents in minutes. Prerequisites, project structure, and first commands.', path: '/docs/getting-started', ogImage: 'https://autopilot.questpie.com/og-getting-started.png' }) }),
	component: GettingStarted,
})

function GettingStarted() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Getting Started
			</h1>
			<p className="text-muted text-lg mb-8">
				Install Autopilot, scaffold a company, and give your first intent.
			</p>

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
					-- runtime, package manager, and test runner
					<CodeBlock title="terminal">
						{`curl -fsSL https://bun.sh/install | bash`}
					</CodeBlock>
				</li>
				<li>
					<strong className="text-fg">Anthropic API key</strong> -- agents run
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
					<strong className="text-fg">Git</strong> -- required for versioning
					company state and code operations
				</li>
				<li>
					<strong className="text-fg">Docker</strong> (optional) -- for
					containerized production mode
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Installation
			</h2>
			<CodeBlock title="terminal">
				{`# Scaffold a new company from the default template
bunx @questpie/autopilot init my-company

# Or install globally first
bun add -g @questpie/autopilot
autopilot init my-company`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Project Structure
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				After{' '}
				<code className="font-mono text-xs text-purple">autopilot init</code>,
				you get a complete company filesystem based on the{' '}
				<code className="font-mono text-xs text-purple">solo-dev-shop</code>{' '}
				template:
			</p>
			<CodeBlock title="my-company/">
				{`company.yaml                  # Company identity and global settings
team/
  agents.yaml                 # 8 AI agents: ceo, sam, alex, max, riley, ops, morgan, jordan
  humans.yaml                 # Human team members and notification preferences
  workflows/
    development.yaml          # Intent -> Scope -> Plan -> Implement -> Review -> Deploy
    marketing.yaml            # Brief -> Content -> Design -> Review -> Publish
    incident.yaml             # Triage -> Fix -> Review -> Deploy -> Verify
  schedules.yaml              # Cron jobs (daily standup, weekly metrics)
  webhooks.yaml               # Inbound webhook definitions (GitHub, Stripe)
  policies/
    approval-gates.yaml       # What requires human approval
tasks/
  backlog/                    # Unassigned tasks
  active/                     # Tasks being worked on
  review/                     # Awaiting human review or approval
  blocked/                    # Waiting on external dependency
  done/                       # Completed (auto-archived)
comms/
  channels/
    general/                  # Company-wide channel
    dev/                      # Development channel
  direct/                     # Agent-to-agent direct messages
knowledge/
  brand/                      # Brand guidelines, tone of voice
  technical/                  # Stack conventions, architecture decisions
  business/                   # Strategy, pricing, market research
  onboarding/                 # How-we-work docs for agent context
projects/                     # Code repos, design assets, marketing materials
context/
  memory/                     # Per-agent persistent memory (YAML)
skills/                       # Agent Skills (agentskills.io standard)
  code-review/SKILL.md        # Each skill = directory + SKILL.md
  deployment/SKILL.md
  ...
secrets/                      # Encrypted API keys and credentials
dashboard/
  pins/                       # Board pins from agents
logs/
  activity/                   # Activity feed
  sessions/                   # Agent session streams
  errors/                     # Error logs
infra/                        # Infrastructure configuration`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Configuration
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The root{' '}
				<code className="font-mono text-xs text-purple">company.yaml</code>{' '}
				controls company identity, agent runtime settings, and budget limits.
				This is the default from the template:
			</p>
			<CodeBlock title="company.yaml">
				{`name: "My Company"
slug: "my-company"
description: "A solo developer shop powered by QUESTPIE Autopilot"
timezone: "UTC"
language: "en"
languages: ["en"]

owner:
  name: "Founder"
  email: "founder@example.com"
  notification_channels: []

settings:
  auto_assign: true
  require_approval: ["merge", "deploy", "spend", "publish"]
  max_concurrent_agents: 4
  agent_provider: "claude-agent-sdk"
  agent_model: "claude-sonnet-4-6"
  budget:
    daily_token_limit: 2000000
    alert_at: 80

integrations: {}`}
			</CodeBlock>

			<p className="text-ghost leading-relaxed mb-4 mt-4">
				Agents are defined in{' '}
				<code className="font-mono text-xs text-purple">team/agents.yaml</code>.
				Each agent has an ID, role template, filesystem scope, and available
				tools:
			</p>
			<CodeBlock title="team/agents.yaml (excerpt)">
				{`agents:
  - id: ceo
    name: "CEO Agent"
    role: meta
    description: "Decomposes high-level intents into tasks, manages company structure"
    fs_scope:
      read: ["/**"]
      write: ["/tasks/**", "/team/**", "/comms/**", "/dashboard/**"]
    tools: ["fs", "terminal", "task", "message", "board"]

  - id: max
    name: "Max"
    role: developer
    description: "Implements features, writes code, creates branches and PRs"
    fs_scope:
      read: ["/knowledge/technical/**", "/projects/**", "/tasks/**"]
      write: ["/projects/*/code/**", "/tasks/**", "/comms/**"]
    tools: ["fs", "terminal", "task", "message", "git"]`}
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

autopilot start`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4 mt-2 text-sm">
				This starts the filesystem watcher, scheduler, and webhook server. It
				runs until you stop it.
			</p>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Check company status
			</h3>
			<CodeBlock title="terminal">
				{`autopilot status

# QUESTPIE Autopilot — my-company
# Agents: 8 defined, 0 active
# Tasks:  0 backlog, 0 active, 0 review, 0 blocked
# Uptime: 2m 14s`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Give your first intent
			</h3>
			<CodeBlock title="terminal">
				{`autopilot ask "Set up a Next.js project with authentication"

# The CEO agent decomposes this into scoped tasks:
# 1. Sam (strategist) scopes the feature and writes a spec
# 2. Alex (planner) creates a file-level implementation plan
# 3. Max (developer) writes the code and opens a PR
# 4. Riley (reviewer) reviews for quality and spec compliance
# 5. You approve the merge (human gate)
# 6. Ops (devops) deploys to staging, then production`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Watch agents work
			</h3>
			<CodeBlock title="terminal">
				{`# List all agents and their current status
autopilot agents

# Live-stream an agent's session
autopilot attach max

# Compact mode -- one line per tool call
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

# Approve a task at a human gate
autopilot approve TASK-001

# Reject with feedback -- agent will rework
autopilot reject TASK-001 --reason "Needs error handling for edge cases"`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Docker Mode
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				For production, run the company in an isolated Docker container. The
				container mounts the company filesystem and exposes webhook and WebSocket
				ports:
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
				Next Steps
			</h2>
			<ul className="text-ghost leading-relaxed space-y-1">
				<li>
					<Link to="/docs/architecture" className="text-purple">
						Architecture
					</Link>{' '}
					-- understand the four-layer stack and orchestrator internals
				</li>
				<li>
					<Link to="/docs/agents" className="text-purple">
						Agents
					</Link>{' '}
					-- role templates, filesystem scopes, and context assembly
				</li>
				<li>
					<Link to="/docs/primitives" className="text-purple">
						Primitives
					</Link>{' '}
					-- the structured tool calls agents use
				</li>
				<li>
					<Link to="/docs/workflows" className="text-purple">
						Workflows
					</Link>{' '}
					-- how tasks flow through development, marketing, and incident
					pipelines
				</li>
				<li>
					<Link to="/docs/cli" className="text-purple">
						CLI Reference
					</Link>{' '}
					-- all available commands and options
				</li>
			</ul>
		</article>
	)
}
