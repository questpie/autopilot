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
				Complete command reference for the{' '}
				<code className="font-mono text-purple">autopilot</code> CLI.
				Your terminal into the AI company.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Installation
			</h2>
			<CodeBlock title="terminal">
				{`# Install globally
bun add -g @questpie/autopilot

# Or run directly (no install)
bunx @questpie/autopilot init my-company`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				kubectl Analogy
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				If you know Kubernetes, you already know Autopilot. Agents are
				pods, the orchestrator is the control plane, tasks are workloads.
			</p>
			<div className="overflow-x-auto mb-8">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								kubectl
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								autopilot
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								What it does
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl create ns
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot init
							</td>
							<td className="py-2 text-xs">Create workspace</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl apply -f ...
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot ask &quot;...&quot;
							</td>
							<td className="py-2 text-xs">Submit work</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl get pods
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot agents
							</td>
							<td className="py-2 text-xs">List workers</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl describe pod/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot agents show max
							</td>
							<td className="py-2 text-xs">Worker details</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl logs -f pod/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot attach max
							</td>
							<td className="py-2 text-xs">Live-stream output</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl logs pod/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot replay max
							</td>
							<td className="py-2 text-xs">Read past output</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl get jobs
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot tasks
							</td>
							<td className="py-2 text-xs">List workloads</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl get events
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot inbox
							</td>
							<td className="py-2 text-xs">Items needing attention</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl get configmaps
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot knowledge
							</td>
							<td className="py-2 text-xs">View configuration</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Typical Workflow
			</h2>
			<CodeBlock title="terminal — init to production">
				{`# 1. Scaffold and enter company directory
$ autopilot init my-startup
  Company initialized successfully!
  Directory:  /home/user/my-startup
  Company:    my-startup
  Slug:       my-startup

$ cd my-startup

# 2. Add your API key and start the orchestrator
$ export ANTHROPIC_API_KEY=sk-ant-xxx
$ autopilot start
  QUESTPIE Autopilot
  Company: my-startup
  Agents:  8
  Port:    7777
  Orchestrator is running.

# 3. Submit intent — CEO decomposes into tasks
$ autopilot ask "Build a pricing page with Stripe checkout"
  Intent submitted!
  Task ID: TASK-001
  CEO agent will decompose your intent into tasks.

# 4. Watch an agent work in real-time
$ autopilot attach max
  [10:05] read_file   pricing-spec.md
  [10:08] write_file  src/pages/pricing.tsx
  [10:12] write_file  src/components/PricingTable.tsx
  [10:18] run_command bun test
  [10:19] git_commit  "feat: add pricing page"

# 5. Check what needs your attention
$ autopilot inbox
  TASK-003  review   PR #12: Pricing page   → riley
  TASK-007  blocked  Need Stripe API keys    → max

# 6. Approve or reject
$ autopilot tasks approve TASK-003
  Task TASK-003 approved and moved to done.`}
			</CodeBlock>

			{/* ── Setup ─────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Setup Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot init
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Scaffold a new company directory from a template. Creates the
				full filesystem structure with agents, workflows, knowledge
				directories, and task folders.
			</p>
			<CodeBlock title="syntax">
				{`autopilot init [name] [options]

Arguments:
  name                    Company name (default: "My Company")

Options:
  -f, --force             Overwrite existing directory`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot init "Acme Corp"
  QUESTPIE Autopilot
  Initializing company: Acme Corp

  Company initialized successfully!
  Directory:  /home/user/acme-corp
  Company:    Acme Corp
  Slug:       acme-corp

  Company structure:
  acme-corp/
  ├── company.yaml
  ├── team/
  │   ├── agents.yaml
  │   ├── workflows/
  │   ├── schedules.yaml
  │   └── policies/
  ├── tasks/
  │   ├── backlog/
  │   ├── active/
  │   ├── review/
  │   ├── blocked/
  │   └── done/
  ├── knowledge/
  ├── projects/
  ├── comms/
  ├── context/
  ├── secrets/
  ├── dashboard/
  └── logs/

  Next steps:
  1. cd acme-corp
  2. autopilot status
  3. autopilot ask "Build me a landing page"
  4. autopilot start

$ autopilot init my-startup --force   # overwrite existing`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot start
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Start the orchestrator process. Launches the FS watcher,
				workflow engine, scheduler, webhook server, and session
				streaming. Must be run from inside a company directory.
			</p>
			<CodeBlock title="syntax">
				{`autopilot start [options]

Options:
  -p, --port <port>       Webhook server port (default: 7777)

Environment:
  ANTHROPIC_API_KEY       Required. Your Anthropic API key or
                          Claude Max subscription token.`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ export ANTHROPIC_API_KEY=sk-ant-xxx
$ autopilot start
  QUESTPIE Autopilot
  Company: my-startup
  Agents:  8
  Port:    7777
  Orchestrator is running.
  Press Ctrl+C to stop

$ autopilot start --port 8080`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot status
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Display a company overview: agent roster, task counts by
				status, and totals. Does not require the orchestrator to be
				running.
			</p>
			<CodeBlock title="syntax">
				{`autopilot status`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot status
  QUESTPIE Autopilot — my-startup
  slug: my-startup | timezone: UTC

  Agents
    strategist  Sam        sam
    planner     Alex       alex
    developer   Max        max
    reviewer    Riley      riley
    devops      Ops        ops
    designer    Jordan     jordan
    marketing   Morgan     morgan
    meta        CEO        ceo

  Tasks
    backlog   3
    active    2
    review    1
    done      12

  Total: 18 tasks | 8 agents`}
			</CodeBlock>

			{/* ── Intent & Tasks ────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Intent & Task Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot ask
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Submit a high-level intent. Creates a task of type{' '}
				<code className="font-mono text-xs text-purple">intent</code>{' '}
				in the backlog assigned to the CEO agent. The CEO decomposes
				it into scoped sub-tasks with dependencies.
			</p>
			<CodeBlock title="syntax">
				{`autopilot ask <intent>

Arguments:
  intent                  Natural language description of what you want`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`$ autopilot ask "Build a pricing page with Stripe checkout"
  Intent submitted!
  Task ID: TASK-001
  CEO agent will decompose your intent into tasks.
  Run 'autopilot attach ceo' to watch, or 'autopilot inbox' for updates.

$ autopilot ask "Fix the login redirect loop on Safari"
$ autopilot ask "Add dark mode support to the dashboard"`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot tasks
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				List all tasks. Filter by status or assigned agent.
			</p>
			<CodeBlock title="syntax">
				{`autopilot tasks [options]
autopilot tasks show <id>
autopilot tasks approve <id>
autopilot tasks reject <id> [reason]

Options:
  -s, --status <status>   Filter: backlog, active, review, blocked, done
  -a, --agent <agent>     Filter by assigned agent ID

Subcommands:
  show <id>               Show full task details with history
  approve <id>            Move task to done
  reject <id> [reason]    Move task to blocked with optional reason`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# List all tasks
$ autopilot tasks
  TASK-001  active   Implement pricing page   → max
  TASK-002  review   Review auth flow PR       → riley
  TASK-003  backlog  Add email templates
  3 task(s)

# Filter by status
$ autopilot tasks --status active
$ autopilot tasks --agent max

# Show task details
$ autopilot tasks show TASK-001
  Implement pricing page

  ID:          TASK-001
  Status:      active
  Type:        feature
  Priority:    high
  Assigned:    max
  Created by:  ceo
  Created at:  2026-03-22T10:00:00Z
  Updated at:  2026-03-22T14:30:00Z

  Description:
    Build a pricing page with 3 tiers and Stripe checkout integration.

  History:
    2026-03-22T10:00:00Z ceo created
    2026-03-22T10:05:00Z ceo assigned_to max

# Approve a task (moves to done)
$ autopilot tasks approve TASK-001
  Task TASK-001 approved and moved to done.

# Reject a task (moves to blocked)
$ autopilot tasks reject TASK-001 "Needs error handling for failed charges"
  Task TASK-001 rejected and moved to blocked.
  Reason: Needs error handling for failed charges`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot inbox
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Show tasks requiring human attention. Displays all tasks in{' '}
				<code className="font-mono text-xs text-purple">review</code>{' '}
				or{' '}
				<code className="font-mono text-xs text-purple">blocked</code>{' '}
				status.
			</p>
			<CodeBlock title="syntax">
				{`autopilot inbox`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot inbox
  Inbox
  Tasks requiring your attention

  TASK-003  review   PR #12: Pricing page with Stripe   → riley
  TASK-009  blocked  Need Stripe API keys                → max
  2 item(s) need attention
  Use \`autopilot tasks approve <id>\` or \`autopilot tasks reject <id>\` to respond.`}
			</CodeBlock>

			{/* ── Agents & Observation ────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Agents & Observation
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot agents
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				List all defined agents with their role, name, ID, and model.
			</p>
			<CodeBlock title="syntax">
				{`autopilot agents
autopilot agents show <id>

Subcommands:
  show <id>               Show agent details: tools, FS scope,
                          MCP servers, and triggers`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`$ autopilot agents
  Agents

  strategist  Sam        sam     claude-sonnet-4-20250514
  planner     Alex       alex    claude-sonnet-4-20250514
  developer   Max        max     claude-sonnet-4-20250514
  reviewer    Riley      riley   claude-sonnet-4-20250514
  devops      Ops        ops     claude-sonnet-4-20250514
  designer    Jordan     jordan  claude-sonnet-4-20250514
  marketing   Morgan     morgan  claude-sonnet-4-20250514
  meta        CEO        ceo     claude-sonnet-4-20250514
  8 agent(s)

$ autopilot agents show max
  Max

  ID:          max
  Role:        developer
  Model:       claude-sonnet-4-20250514
  Description: Full-stack developer

  Tools:
    - Read
    - Write
    - Edit
    - Bash
    - Glob
    - Grep

  MCPs:
    - autopilot

  FS Scope:
    Read:   /knowledge/**, /projects/**, /tasks/**
    Write:  /projects/**, /tasks/**, /comms/**

  Triggers:
    - on: task_assigned, status: active`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot attach
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Live-stream an agent's activity feed. Polls the orchestrator
				API every 2 seconds and prints events as they arrive. Like{' '}
				<code className="font-mono text-xs text-purple">
					kubectl logs -f
				</code>
				. Press Ctrl+C to detach.
			</p>
			<CodeBlock title="syntax">
				{`autopilot attach <agent> [options]

Arguments:
  agent                   Agent ID to attach to

Options:
  --compact               One line per event (time + agent + summary)
  --tools-only            Only show tool_call and tool_result events`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# Full stream
$ autopilot attach max
  Attached to max (polling every 2s)
  Press Ctrl+C to detach

  [10:05:12] max  read_file → pricing-spec.md
  [10:06:03] max  read_file → pricing-plan.md
  [10:07:15] max  Bash      git checkout -b feat/pricing-page
  [10:08:22] max  Write     src/pages/pricing.tsx
  [10:12:45] max  Write     src/components/PricingTable.tsx
  [10:18:01] max  Bash      bun test
  [10:19:30] max  Bash      git commit -m "feat: add pricing page"
  ^C
  Detached.

# Compact mode
$ autopilot attach max --compact

# Tools only — skip thinking events
$ autopilot attach max --tools-only`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot replay
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Replay an agent's past activity. Fetches the last N entries
				from the orchestrator API and prints them.
			</p>
			<CodeBlock title="syntax">
				{`autopilot replay <agent> [options]

Arguments:
  agent                   Agent ID to replay

Options:
  --limit <n>             Number of entries to show (default: 50)
  --compact               One line per event
  --tools-only            Only show tool_call and tool_result events`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot replay max --limit 10
  Replay for max (last 10 entries)

  [10:05:12] max  read_file → pricing-spec.md
  [10:06:03] max  read_file → pricing-plan.md
  [10:08:22] max  Write     src/pages/pricing.tsx
  ...
  10 entries`}
			</CodeBlock>

			{/* ── Knowledge & Config ──────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Knowledge & Config
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot knowledge
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Manage the company knowledge base. View the knowledge tree,
				read individual docs, add new docs from files or stdin, and
				scan the skill catalog.
			</p>
			<CodeBlock title="syntax">
				{`autopilot knowledge                        List knowledge tree
autopilot knowledge list                   List knowledge tree
autopilot knowledge show <path>            Print a knowledge doc
autopilot knowledge add <path> [--file f]  Add a doc (from file or stdin)
autopilot knowledge scan                   Show parsed skill catalog`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# Browse the knowledge tree
$ autopilot knowledge
  Knowledge
  knowledge/
  ├── brand/
  │   ├── guidelines.md
  │   └── voice.md
  ├── technical/
  │   ├── conventions.md
  │   ├── stack.md
  │   └── architecture.md
  ├── business/
  │   └── pricing.md
  └── integrations/
      ├── linear.md
      └── stripe.md

# Read a specific doc
$ autopilot knowledge show technical/conventions.md

# Add a doc from a file
$ autopilot knowledge add technical/migrations.md --file ./docs/migrations.md

# Pipe content from stdin
$ cat architecture.md | autopilot knowledge add technical/architecture.md

# Show the skill catalog
$ autopilot knowledge scan
  Skill Catalog
  code-review   Code Review Checklist   Review best practices   roles: reviewer
  api-design    API Design Patterns     REST/GraphQL patterns   roles: developer
  3 skill(s)`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot secrets
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Manage secrets for integrations. Secrets are YAML files in{' '}
				<code className="font-mono text-xs text-purple">
					/secrets/
				</code>{' '}
				scoped to specific agents.
			</p>
			<CodeBlock title="syntax">
				{`autopilot secrets                           List secret names
autopilot secrets list                     List with type and agent scope
autopilot secrets add <name> [options]     Add a secret
autopilot secrets remove <name>            Remove a secret

Options for add:
  --value <value>         Secret value (required)
  --agents <agents>       Comma-separated allowed agent IDs
  --type <type>           Secret type (default: api_token)`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# List secrets (values are masked)
$ autopilot secrets
  Secrets
  stripe   ********
  github   ********
  linear   ********
  3 secret(s)

# Detailed listing with agent scope
$ autopilot secrets list
  Secrets
  stripe   api_token   agents: max, ops, ceo
  github   api_token   agents: max, riley, ops
  linear   api_token   agents: ceo, sam
  3 secret(s)

# Add a secret
$ autopilot secrets add stripe --value sk_live_xxx --agents max,ops,ceo
  Secret 'stripe' added.

# Remove a secret
$ autopilot secrets remove stripe
  Secret 'stripe' removed.`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot board
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				View and manage dashboard pins created by agents. Pins show
				progress, alerts, deployment status, and action items.
			</p>
			<CodeBlock title="syntax">
				{`autopilot board                             List all pins
autopilot board clear                      Remove all pins`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`$ autopilot board
  Dashboard Board
  pin-001  status   engineering  Deploy v1.2.0 passed health checks
  pin-002  alert    security     3 CVEs found in dependencies
  pin-003  info     marketing    Landing page A/B test results: +12% conv...
  3 pin(s)

$ autopilot board clear
  Cleared 3 pin(s).`}
			</CodeBlock>

			{/* ── Communication ──────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Communication
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot channels
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				List, read, and send messages to agent communication channels.
				Channels are directories under{' '}
				<code className="font-mono text-xs text-purple">
					/comms/channels/
				</code>{' '}
				containing YAML message files.
			</p>
			<CodeBlock title="syntax">
				{`autopilot channels                          List all channels
autopilot channels show <channel>          Show messages in a channel
autopilot channels show <channel> --follow Live follow (poll every 2s)
autopilot channels send <channel> "msg"    Send a message

Options for show:
  -n, --limit <n>         Number of messages (default: 20)
  -f, --follow            Live follow mode`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# List all channels
$ autopilot channels
  Channels
  [dev]       42 messages  last: 14:30:02
  [general]   18 messages  last: 13:15:45
  [ops]        7 messages  last: 12:00:00
  3 channel(s)

# Read recent messages
$ autopilot channels show dev
  #dev

  14:25:02 [max]    Started implementing pricing page
  14:28:15 [max]    PR #47 created: feat/pricing-page
  14:30:02 [riley]  Reviewing PR #47 now
  3 message(s)

# Live follow a channel
$ autopilot channels show dev --follow
  Following... (Ctrl+C to stop)
  14:32:00 [riley]  PR #47 approved ✓
  ^C
  Stopped.

# Send a message
$ autopilot channels send dev "Please prioritize the auth fix"
  Message sent to #dev
  ID: msg-abc123`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot chat
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Send a message to a specific agent and get a streamed response.
				Shows recent channel history for context before chatting.
			</p>
			<CodeBlock title="syntax">
				{`autopilot chat <agent> <message> [options]

Arguments:
  agent                   Agent ID (with or without @ prefix)
  message                 Message to send

Options:
  -c, --channel <channel> Channel to load history from (default: general)`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`$ autopilot chat max "What's the status of the pricing page?"
  QUESTPIE Autopilot
  Chatting with [max] (Max)

  --- recent #general ---
  14:25 max: Started implementing pricing page
  14:30 riley: Reviewing PR #47 now
  ---

  The pricing page implementation is complete. PR #47 has been...
  --- 3 tool calls | session sess-abc123 ---

# Use a specific channel for context
$ autopilot chat @ops "Is the cluster healthy?" --channel ops`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot approve / reject
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Top-level shortcuts for{' '}
				<code className="font-mono text-xs text-purple">tasks approve</code>{' '}
				and{' '}
				<code className="font-mono text-xs text-purple">tasks reject</code>.
				Triggers workflow advancement.
			</p>
			<CodeBlock title="syntax">
				{`autopilot approve <id>            Approve task → move to done
autopilot reject <id> [reason]    Reject task → move to blocked`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`$ autopilot approve TASK-003
  Task TASK-003 approved and moved to done.
  Workflow advancement triggered.

$ autopilot reject TASK-005 "Missing error handling for edge cases"
  Task TASK-005 rejected and moved to blocked.
  Reason: Missing error handling for edge cases`}
			</CodeBlock>

			{/* ── Artifacts ──────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Artifacts
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot artifacts
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				List, open, and stop artifact dev servers. Artifacts are
				previewable outputs (React apps, HTML pages) created by agents
				under{' '}
				<code className="font-mono text-xs text-purple">
					/artifacts/
				</code>{' '}
				with{' '}
				<code className="font-mono text-xs text-purple">
					.artifact.yaml
				</code>{' '}
				configs.
			</p>
			<CodeBlock title="syntax">
				{`autopilot artifacts                List all artifacts
autopilot artifacts open <name>   Start and open in browser
autopilot artifacts stop <name>   Stop a running artifact`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# List artifacts
$ autopilot artifacts
  Artifacts
  [pricing-preview]  Pricing Page Preview   bunx vite --port {port}
  [dashboard-mock]   Dashboard Mockup       bunx serve -p {port}
  2 artifact(s)

# Open (cold-starts if not running)
$ autopilot artifacts open pricing-preview
  Starting artifact...
  Artifact "pricing-preview" is running
  URL: http://localhost:4100
  Opened in browser.

# Stop
$ autopilot artifacts stop pricing-preview
  Artifact "pricing-preview" stopped.`}
			</CodeBlock>

			{/* ── Quick Reference ─────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Quick Reference
			</h2>
			<div className="overflow-x-auto mb-8">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Command
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Category
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Description
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">init [name]</td>
							<td className="py-2 pr-4 text-xs">Setup</td>
							<td className="py-2 text-xs">Scaffold a new company directory</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">start</td>
							<td className="py-2 pr-4 text-xs">Setup</td>
							<td className="py-2 text-xs">Start the orchestrator process</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">status</td>
							<td className="py-2 pr-4 text-xs">Setup</td>
							<td className="py-2 text-xs">Company overview and task counts</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">ask &lt;intent&gt;</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">Submit intent to CEO agent</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">tasks</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">List and filter tasks</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">tasks show &lt;id&gt;</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">Full task details with history</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">tasks approve &lt;id&gt;</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">Move task to done</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">tasks reject &lt;id&gt; [reason]</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">Move task to blocked</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">inbox</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">Tasks needing human action</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">agents</td>
							<td className="py-2 pr-4 text-xs">Agents</td>
							<td className="py-2 text-xs">List all agents</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">agents show &lt;id&gt;</td>
							<td className="py-2 pr-4 text-xs">Agents</td>
							<td className="py-2 text-xs">Agent details, tools, FS scope, triggers</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">attach &lt;agent&gt;</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">Live-stream agent activity</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">replay &lt;agent&gt;</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">Replay past activity log</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">board</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">View dashboard pins</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">board clear</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">Remove all pins</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">approve &lt;id&gt;</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">Approve a task at a human gate</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">reject &lt;id&gt; [reason]</td>
							<td className="py-2 pr-4 text-xs">Tasks</td>
							<td className="py-2 text-xs">Reject a task with feedback</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">channels</td>
							<td className="py-2 pr-4 text-xs">Communication</td>
							<td className="py-2 text-xs">List and read agent channels</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">artifacts</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">List and view task artifacts</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">chat &lt;agent&gt;</td>
							<td className="py-2 pr-4 text-xs">Communication</td>
							<td className="py-2 text-xs">Interactive chat with an agent</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">knowledge</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Browse knowledge tree</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">knowledge show &lt;path&gt;</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Print a knowledge doc</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">knowledge add &lt;path&gt;</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Add a knowledge doc</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">knowledge scan</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Show skill catalog</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">secrets</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">List secrets (masked)</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">secrets add &lt;name&gt;</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Add a secret</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">secrets remove &lt;name&gt;</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Remove a secret</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Environment Variables
			</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Variable
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Required
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Description
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								ANTHROPIC_API_KEY
							</td>
							<td className="py-2 pr-4 text-xs">Yes</td>
							<td className="py-2 text-xs">
								Anthropic API key for Claude Agent SDK. Required
								by <code className="font-mono text-purple">autopilot start</code>.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								AUTOPILOT_ROOT
							</td>
							<td className="py-2 pr-4 text-xs">No</td>
							<td className="py-2 text-xs">
								Override company root directory. Default:
								auto-detected by walking up from cwd looking
								for company.yaml.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								AUTOPILOT_PORT
							</td>
							<td className="py-2 pr-4 text-xs">No</td>
							<td className="py-2 text-xs">
								Webhook server port (default: 7777)
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								AUTOPILOT_WS_PORT
							</td>
							<td className="py-2 pr-4 text-xs">No</td>
							<td className="py-2 text-xs">
								WebSocket port for session streaming
								(default: 7778)
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</article>
	)
}
