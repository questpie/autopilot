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
				The{' '}
				<code className="font-mono text-purple">autopilot</code> command
				line interface. Your terminal to the AI company.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Installation
			</h2>
			<CodeBlock title="terminal">
				{`# Install globally
bun add -g @questpie/autopilot

# Or run directly with bunx (no install needed)
bunx @questpie/autopilot init my-company`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				kubectl Analogy
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				If you know Kubernetes, you already know Autopilot CLI. The mental
				model is the same: agents are pods, the orchestrator is the
				control plane, tasks are workloads.
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
								kubectl apply -f ...
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot ask &quot;...&quot;
							</td>
							<td className="py-2 text-xs">Submit work to the system</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl get pods
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot agents
							</td>
							<td className="py-2 text-xs">List running workers</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl logs -f pod/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot attach max
							</td>
							<td className="py-2 text-xs">Live-stream worker output</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl describe pod/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot agent show max
							</td>
							<td className="py-2 text-xs">Detailed worker info</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl logs pod/web
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot replay &lt;session&gt;
							</td>
							<td className="py-2 text-xs">Read past output</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl top pods
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot agents --stats
							</td>
							<td className="py-2 text-xs">Resource usage / token stats</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl get events
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot log
							</td>
							<td className="py-2 text-xs">Activity stream</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								kubectl create ns
							</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								autopilot init
							</td>
							<td className="py-2 text-xs">Create workspace</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Typical Workflow
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				A complete session from creating a company to watching agents
				deliver a feature:
			</p>
			<CodeBlock title="terminal — full workflow">
				{`# 1. Create and enter company
$ autopilot init my-startup
Creating company "my-startup"...
  team/agents.yaml              8 agents (solo-dev-shop template)
  team/workflows/               3 workflows (development, marketing, incident)
  team/schedules.yaml           4 recurring schedules
  knowledge/                    brand, technical, business, onboarding
  tasks/                        backlog, active, review, blocked, done
Done. cd my-startup && autopilot start

$ cd my-startup

# 2. Set your API key and start the orchestrator
$ export ANTHROPIC_API_KEY=sk-ant-xxx
$ autopilot start
QUESTPIE Autopilot v0.1.0
  Orchestrator started
  FS watcher:    watching /company
  Webhook server: http://localhost:7777
  WebSocket:      ws://localhost:7778
  Scheduler:      4 cron jobs loaded
  Agents:         8 defined, 0 active

# 3. Give intent — CEO decomposes into tasks
$ autopilot ask "Build a pricing page with Stripe checkout"
Intent received. Spawning CEO agent...
  CEO created 4 tasks:
  TASK-001  Scope pricing page requirements     → sam (strategist)
  TASK-002  Plan pricing page implementation    → alex (planner)
  TASK-003  Implement pricing page + Stripe     → max (developer)
  TASK-004  Review pricing page PR              → riley (reviewer)

# 4. Watch an agent work in real-time
$ autopilot attach max
Attaching to max (developer)...
  [10:05] Reading spec: /projects/web-app/docs/pricing-spec.md
  [10:06] Reading plan: /projects/web-app/docs/pricing-plan.md
  [10:07] git_create_branch("feat/pricing-page", from: "main")
  [10:08] write_file("src/pages/pricing.tsx", ...)
  [10:12] write_file("src/components/PricingTable.tsx", ...)
  [10:15] write_file("src/lib/stripe.ts", ...)
  [10:18] run_command("bun test")
  [10:19] git_commit("feat: add pricing page with Stripe checkout")
  [10:20] git_create_pr("feat: Pricing page with Stripe", branch: "feat/pricing-page")
  [10:20] update_task(TASK-003, status: "done")
  [10:20] send_message(to: "agent:riley", "PR ready for review")
  Session complete. 15 tool calls, 12m 34s.

# 5. Check what needs your attention
$ autopilot inbox
INBOX — 2 items need attention
  [merge]  TASK-003  PR #12: Pricing page with Stripe   riley approved
  [deploy] TASK-003  Deploy pricing page to production   ops ready

# 6. Approve the merge
$ autopilot approve TASK-003
Approved. Merging PR #12 to main...
  Workflow advancing: human_merge → deploy_staging`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Setup Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot init
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Scaffold a new company filesystem with agents, workflows,
				knowledge structure, and all required directories.
			</p>
			<CodeBlock title="syntax">
				{`autopilot init [name] [options]

Arguments:
  name                    Company name (default: current directory name)

Options:
  --template <template>   Template to use (default: "solo-dev-shop")
  --dir <path>            Target directory (default: ./<name>)
  --skip-git              Don't initialize git repository`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot init my-startup
Creating company "my-startup"...
  team/agents.yaml              8 agents (solo-dev-shop template)
  team/workflows/               3 workflows
  team/schedules.yaml           4 recurring schedules
  team/policies/                approval gates, information sharing
  knowledge/                    brand, technical, business, onboarding
  tasks/                        backlog, active, review, blocked, done
  context/memory/               per-agent memory directories
  secrets/                      encrypted credentials store
  dashboard/                    board pins
  logs/                         activity, sessions, errors
  Initialized git repository
Done. cd my-startup && autopilot start

$ autopilot init agency --template solo-dev-shop
$ autopilot init corp --dir /opt/companies/corp`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot start
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Start the orchestrator process. This launches the FS watcher,
				workflow engine, scheduler, webhook server, and WebSocket
				streaming server.
			</p>
			<CodeBlock title="syntax">
				{`autopilot start [options]

Options:
  --port <port>           Webhook server port (default: 7777)
  --ws-port <port>        WebSocket port (default: 7778)
  --verbose               Show detailed orchestrator logs
  --dry-run               Start without spawning agents (watch + log only)

Environment:
  ANTHROPIC_API_KEY       Required. Your Anthropic API key.`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ export ANTHROPIC_API_KEY=sk-ant-xxx
$ autopilot start
QUESTPIE Autopilot v0.1.0
  Orchestrator started
  FS watcher:    watching /company (chokidar)
  Webhook server: http://localhost:7777
  WebSocket:      ws://localhost:7778
  Scheduler:      4 cron jobs loaded
    daily-standup    0 9 * * 1-5    CEO
    weekly-metrics   0 10 * * 1     CEO
    health-check     */30 * * * *   Ops
    knowledge-sync   0 3 * * 0      CEO
  Agents:         8 defined, 0 active
  Max concurrent: 3

$ autopilot start --port 8080 --verbose
$ autopilot start --dry-run`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot status
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Display a company overview including agent count, active
				tasks, recent activity, and system health.
			</p>
			<CodeBlock title="syntax">
				{`autopilot status [options]

Options:
  --json                  Output as JSON`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot status
QUESTPIE Autopilot — my-startup
  Agents:  8 defined, 2 active (max, riley)
  Tasks:   3 backlog, 2 active, 1 review, 0 blocked, 12 done
  Inbox:   1 item needs attention
  Uptime:  4h 22m
  API:     $3.42 today ($50.00 daily limit)

  Active Sessions:
    max    developer   TASK-003 "Implement pricing page"    12m
    riley  reviewer    TASK-002 "Review auth flow PR"       3m

  Recent Activity:
    14:30  max    git_commit "feat: add pricing table"
    14:28  max    write_file src/components/PricingTable.tsx
    14:25  riley  send_message to:channel:dev "Auth PR approved"
    14:20  sam    update_task TASK-005 status:done`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Intent & Task Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot ask
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Submit a high-level intent to the CEO agent. The CEO
				decomposes it into scoped tasks with dependencies and assigns
				them to the appropriate workflow.
			</p>
			<CodeBlock title="syntax">
				{`autopilot ask "<intent>" [options]

Arguments:
  intent                  Natural language description of what you want

Options:
  --project <name>        Target project (default: auto-detected)
  --priority <level>      Priority: low, medium, high, critical (default: medium)
  --workflow <id>         Force a specific workflow (default: CEO decides)`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# Simple feature request
$ autopilot ask "Build a pricing page with Stripe checkout"
Intent received. Spawning CEO agent...
  CEO created 4 tasks:
  TASK-001  Scope pricing page requirements     → sam (strategist)
  TASK-002  Plan pricing page implementation    → alex (planner)
  TASK-003  Implement pricing page + Stripe     → max (developer)
  TASK-004  Review pricing page PR              → riley (reviewer)

# Bug fix with high priority
$ autopilot ask "Fix the login redirect loop on Safari" --priority high
Intent received. Spawning CEO agent...
  CEO created 2 tasks:
  TASK-010  Investigate Safari redirect bug     → max (developer)
  TASK-011  Review Safari fix PR                → riley (reviewer)

# Target a specific project
$ autopilot ask "Add dark mode support" --project web-app

# Force incident workflow
$ autopilot ask "Production API returning 500 errors" --workflow incident`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot tasks
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				List all tasks across all status folders. Filter by status,
				agent, project, or priority.
			</p>
			<CodeBlock title="syntax">
				{`autopilot tasks [options]

Options:
  --status <status>       Filter: backlog, active, review, blocked, done
  --agent <name>          Filter by assigned agent
  --project <name>        Filter by project
  --priority <level>      Filter by priority
  --limit <n>             Max results (default: 20)
  --json                  Output as JSON`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot tasks
TASKS — 18 total
  backlog (3)
    TASK-015  Add email templates           medium  unassigned
    TASK-016  Write API documentation       low     unassigned
    TASK-017  Set up monitoring dashboards  medium  unassigned

  active (2)
    TASK-003  Implement pricing page        high    max (developer)     12m
    TASK-012  Review auth flow PR           medium  riley (reviewer)    3m

  review (1)
    TASK-002  Plan pricing implementation   medium  alex (planner)      awaiting review

  blocked (0)

  done (12)
    ... (use --status done to see)

$ autopilot tasks --status active
$ autopilot tasks --agent max
$ autopilot tasks --priority critical`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot inbox
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Show items that need human attention. These are tasks at human
				gates (merge, deploy, publish), blockers assigned to you, and
				urgent agent messages.
			</p>
			<CodeBlock title="syntax">
				{`autopilot inbox [options]

Options:
  --all                   Include resolved items
  --json                  Output as JSON`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot inbox
INBOX — 3 items need attention

  [merge]    TASK-003  PR #12: Pricing page with Stripe
             riley approved. Ready to merge to main.
             autopilot approve TASK-003

  [deploy]   TASK-007  Deploy auth service to production
             Staging verified. Health checks passing.
             autopilot approve TASK-007

  [blocker]  TASK-009  Need Stripe API keys for checkout testing
             max is blocked. Add keys to secrets/stripe.yaml
             autopilot resolve TASK-009`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot approve / reject / resolve
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Act on items in your inbox. Approve advances the task through
				the workflow. Reject sends it back with feedback. Resolve
				clears a blocker.
			</p>
			<CodeBlock title="syntax">
				{`autopilot approve <task-id>
autopilot reject <task-id> [--reason "<feedback>"]
autopilot resolve <task-id> [--note "<resolution>"]`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# Approve a merge — workflow advances to deploy
$ autopilot approve TASK-003
Approved. Merging PR #12 to main...
  Workflow advancing: human_merge → deploy_staging
  Ops agent will deploy to staging automatically.

# Reject with feedback — goes back to developer
$ autopilot reject TASK-003 --reason "Needs error handling for failed Stripe charges"
Rejected. Sending feedback to max (developer)...
  Workflow: human_merge → implement (with feedback)
  max will pick up the task with your feedback in context.

# Resolve a blocker
$ autopilot resolve TASK-009 --note "Added Stripe keys to secrets/stripe.yaml"
Blocker resolved. Unblocking max...
  TASK-009 moved from blocked → active
  max will resume with the updated context.`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Agent Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot agents
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				List all agents and their current status. Shows which agents
				are running, idle, or on a schedule.
			</p>
			<CodeBlock title="syntax">
				{`autopilot agents [options]

Options:
  --stats                 Show token usage and session counts
  --json                  Output as JSON`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot agents
AGENTS — 8 defined, 2 active

  NAME     ROLE         STATUS   TASK              UPTIME
  sam      strategist   idle     —                 —
  alex     planner      idle     —                 —
  max      developer    run      TASK-003          12m
  riley    reviewer     run      TASK-012          3m
  ops      devops       schd     health-check      —
  jordan   design       idle     —                 —
  morgan   marketing    idle     —                 —
  ceo      meta         schd     daily-standup      —

$ autopilot agents --stats
AGENTS — 8 defined, 2 active

  NAME     ROLE         SESSIONS  TOKENS (24h)  COST (24h)
  sam      strategist   3         42,100        $0.63
  alex     planner      2         31,800        $0.48
  max      developer    8         187,200       $2.81
  riley    reviewer     5         62,400        $0.94
  ops      devops       12        18,900        $0.28
  jordan   design       1         15,300        $0.23
  morgan   marketing    0         0             $0.00
  ceo      meta         4         28,700        $0.43
  TOTAL                 35        386,400       $5.80`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot agent add / remove / show
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Manage the agent roster at runtime. Add new agents, remove
				existing ones, or view detailed agent information.
			</p>
			<CodeBlock title="syntax">
				{`autopilot agent add --name <name> --role <role> [options]
autopilot agent remove <agent-id>
autopilot agent show <agent-id>

Options for add:
  --name <name>           Agent display name (required)
  --role <role>           Role template (required)
  --desc <description>    Agent description
  --model <model>         AI model override (default: company setting)`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# Add a new agent
$ autopilot agent add --name "Alice" --role developer --desc "Frontend specialist"
Added agent "alice" (developer) to team/agents.yaml

# Add a QA agent with custom model
$ autopilot agent add --name "QA" --role reviewer --desc "Testing specialist" --model claude-sonnet-4-20250514
Added agent "qa" (reviewer) to team/agents.yaml

# Remove an agent
$ autopilot agent remove alice
Removed agent "alice" from team/agents.yaml

# View agent details
$ autopilot agent show max
AGENT — max (developer)
  Name:     Max
  Role:     developer
  Model:    claude-sonnet-4-20250514
  Status:   running (TASK-003, 12m)

  FS Scope:
    read:   /knowledge/technical/**, /projects/**, /tasks/**
    write:  /projects/*/code/**, /tasks/**, /comms/**

  Tools:    read_file, write_file, git_commit, git_create_pr, send_message,
            search_knowledge, run_command, http_request

  Memory:
    facts:      27 entries
    decisions:  8 entries
    mistakes:   3 entries
    sessions:   42 summaries

  Recent Sessions (last 5):
    2026-03-22 14:30  TASK-003  "Implement pricing page"        12m  active
    2026-03-22 10:00  TASK-003  "Implement pricing page"        8m   done
    2026-03-21 16:00  TASK-001  "Set up project structure"      15m  done
    2026-03-21 11:00  TASK-001  "Set up project structure"      22m  done
    2026-03-20 14:00  TASK-000  "Initial codebase scaffold"     18m  done`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Observation Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot attach
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Live-stream an agent's session in real time. Like{' '}
				<code className="font-mono text-xs text-purple">
					kubectl logs -f
				</code>
				. See every tool call as it happens.
			</p>
			<CodeBlock title="syntax">
				{`autopilot attach <agent-name> [options]

Arguments:
  agent-name              Agent to attach to (by name or ID)

Options:
  --compact               One-line summary per tool call
  --tools-only            Only show tool calls, skip thinking
  --raw                   Show raw JSONL stream`}
			</CodeBlock>
			<CodeBlock title="examples">
				{`# Full stream — see thinking + tool calls
$ autopilot attach max
Attaching to max (developer)...
  [10:05] Thinking: Let me read the spec first to understand requirements...
  [10:05] read_file("/projects/web-app/docs/pricing-spec.md")
  [10:06] Thinking: The spec requires 3 pricing tiers with Stripe...
  [10:06] read_file("/projects/web-app/docs/pricing-plan.md")
  [10:07] git_create_branch("feat/pricing-page", from: "main")
  [10:08] write_file("src/pages/pricing.tsx", 142 lines)
  [10:12] write_file("src/components/PricingTable.tsx", 89 lines)
  ...

# Compact mode — one line per action
$ autopilot attach max --compact
  10:05 read_file   pricing-spec.md
  10:06 read_file   pricing-plan.md
  10:07 git_branch  feat/pricing-page
  10:08 write_file  src/pages/pricing.tsx (142 lines)
  10:12 write_file  src/components/PricingTable.tsx (89 lines)
  10:15 write_file  src/lib/stripe.ts (67 lines)
  10:18 run_command bun test (passed)
  10:19 git_commit  "feat: add pricing page"
  10:20 git_pr      "Pricing page with Stripe" → main

# Tools only — skip all thinking text
$ autopilot attach max --tools-only`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot replay / sessions
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Browse and replay past agent sessions. Useful for debugging,
				auditing, or understanding how a task was completed.
			</p>
			<CodeBlock title="syntax">
				{`autopilot sessions [options]
autopilot sessions search "<query>"
autopilot replay <session-id> [options]

Options for sessions:
  --agent <name>          Filter by agent
  --limit <n>             Max results (default: 20)

Options for replay:
  --compact               One-line summary per tool call
  --tools-only            Only show tool calls
  --speed <multiplier>    Playback speed (default: 1, use 0 for instant)`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot sessions --agent max
SESSIONS — max (developer)

  SESSION                       TASK       DURATION  TOOL CALLS
  2026-03-22T14:30:00-max      TASK-003   12m 34s   15
  2026-03-22T10:00:00-max      TASK-003   8m 12s    11
  2026-03-21T16:00:00-max      TASK-001   15m 45s   22
  ...

$ autopilot replay 2026-03-22T14:30:00-max --speed 0
Replaying session 2026-03-22T14:30:00-max (max, TASK-003)...
  [10:05] read_file pricing-spec.md
  [10:06] read_file pricing-plan.md
  ...
  Session complete. 15 tool calls, 12m 34s.`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot log
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				View the company activity feed. Every tool call, task change,
				and system event is logged here.
			</p>
			<CodeBlock title="syntax">
				{`autopilot log [options]

Options:
  --agent <name>          Filter by agent
  --type <type>           Filter: tool_call, task_change, message, error
  --limit <n>             Max entries (default: 50)
  --follow                Follow mode (like tail -f)
  --json                  Output as JSON`}
			</CodeBlock>
			<CodeBlock title="example">
				{`$ autopilot log --limit 10
ACTIVITY LOG

  14:30  max    tool_call     git_commit "feat: add pricing table"
  14:28  max    tool_call     write_file src/components/PricingTable.tsx
  14:25  riley  tool_call     send_message to:channel:dev "Auth PR approved"
  14:20  sam    task_change   TASK-005 status:done
  14:15  ceo    task_change   TASK-010 created, assigned to max
  14:10  ops    tool_call     run_command "kubectl get pods"
  14:05  max    tool_call     read_file pricing-spec.md
  14:00  system schedule      health-check triggered (ops)
  13:55  riley  tool_call     write_file review-comments.md
  13:50  alex   task_change   TASK-002 status:review

$ autopilot log --agent max --follow
$ autopilot log --type error`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Knowledge & Configuration Commands
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot knowledge
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Manage the company knowledge base. Import existing
				documentation, scan codebases for facts, or add individual
				files.
			</p>
			<CodeBlock title="syntax">
				{`autopilot knowledge add <file-or-dir>
autopilot knowledge import <directory>
autopilot knowledge scan <codebase-path>
autopilot knowledge list [--scope <scope>]`}
			</CodeBlock>
			<CodeBlock title="example">
				{`# Add a single document to technical knowledge
$ autopilot knowledge add ./architecture.md
Added to /company/knowledge/technical/architecture.md

# Import all docs from a directory
$ autopilot knowledge import ./docs/
Imported 12 files to /company/knowledge/

# Scan a codebase to extract facts (stack, conventions, patterns)
$ autopilot knowledge scan ./src/
Scanned 142 files. Extracted 34 facts to knowledge/technical/.

# List knowledge by scope
$ autopilot knowledge list --scope technical
KNOWLEDGE — technical (8 files)
  conventions.md          Code style, naming, patterns
  stack.md                Runtime, framework, libraries
  architecture.md         System design and data flow
  migrations.md           Database migration procedures
  ...`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot secrets
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Manage encrypted secrets for integrations. Secrets are stored
				in{' '}
				<code className="font-mono text-xs text-purple">
					/company/secrets/
				</code>{' '}
				and scoped to specific agents.
			</p>
			<CodeBlock title="syntax">
				{`autopilot secrets add <service>
autopilot secrets list
autopilot secrets remove <service>`}
			</CodeBlock>
			<CodeBlock title="example">
				{`# Add a new secret (interactive prompt for value)
$ autopilot secrets add stripe
Service: stripe
API key: sk_live_xxx (hidden)
Allowed agents (comma-separated): max, ops, ceo
Saved to /company/secrets/stripe.yaml

# List all secrets (values hidden)
$ autopilot secrets list
SECRETS — 3 configured
  SERVICE    AGENTS              ADDED
  github     max, riley, ops     2026-03-15
  stripe     max, ops, ceo       2026-03-20
  linear     ceo, sam            2026-03-21

# Remove a secret
$ autopilot secrets remove stripe
Removed /company/secrets/stripe.yaml`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				autopilot board
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				View dashboard pins created by agents. Pins show progress,
				alerts, deployment status, and action items.
			</p>
			<CodeBlock title="example">
				{`$ autopilot board
DASHBOARD — 4 active pins

  [progress]   Landing Page Implementation              max
               Hero done | Pricing done | Features WIP | Footer TODO
               Progress: 50%

  [success]    Staging Deploy: v1.2.0                   ops
               All health checks passing.
               Actions: [Promote to Prod] [View Logs]

  [warning]    PR #12 Needs Your Merge                  riley
               Pricing page reviewed and approved.
               Actions: [Merge PR] [View PR] [Reject]

  [info]       Cluster Health                           ops
               12/12 pods OK | CPU 23% | Memory 41%
               Expires: 6h`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Command Reference
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
							<td className="py-2 pr-4 font-mono text-xs text-purple">init</td>
							<td className="py-2 pr-4 text-xs">Setup</td>
							<td className="py-2 text-xs">Scaffold a new company</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">start</td>
							<td className="py-2 pr-4 text-xs">Setup</td>
							<td className="py-2 text-xs">Start the orchestrator</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">status</td>
							<td className="py-2 pr-4 text-xs">Setup</td>
							<td className="py-2 text-xs">Company overview and health</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">ask</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">Submit intent to CEO agent</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">tasks</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">List and filter tasks</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">inbox</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">Items needing human action</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">approve</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">Approve a task at a human gate</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">reject</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">Reject with feedback</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">resolve</td>
							<td className="py-2 pr-4 text-xs">Intent</td>
							<td className="py-2 text-xs">Resolve a blocker</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">agents</td>
							<td className="py-2 pr-4 text-xs">Agents</td>
							<td className="py-2 text-xs">List agents and status</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">agent add</td>
							<td className="py-2 pr-4 text-xs">Agents</td>
							<td className="py-2 text-xs">Add a new agent to the team</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">agent remove</td>
							<td className="py-2 pr-4 text-xs">Agents</td>
							<td className="py-2 text-xs">Remove an agent</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">agent show</td>
							<td className="py-2 pr-4 text-xs">Agents</td>
							<td className="py-2 text-xs">Agent details and memory stats</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">attach</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">Live-stream agent session</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">sessions</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">List past sessions</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">replay</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">Replay a past session</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">log</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">Activity feed</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">board</td>
							<td className="py-2 pr-4 text-xs">Observation</td>
							<td className="py-2 text-xs">View dashboard pins</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">knowledge</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Manage knowledge base</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">secrets</td>
							<td className="py-2 pr-4 text-xs">Config</td>
							<td className="py-2 text-xs">Manage encrypted secrets</td>
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
								Anthropic API key for Claude Agent SDK
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								AUTOPILOT_ROOT
							</td>
							<td className="py-2 pr-4 text-xs">No</td>
							<td className="py-2 text-xs">
								Override company root (default: auto-detected from cwd)
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
								WebSocket port (default: 7778)
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</article>
	)
}
