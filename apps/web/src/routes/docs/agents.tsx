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
				Defining Agents in YAML
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents are defined in{' '}
				<code className="font-mono text-xs text-purple">/company/team/agents.yaml</code>.
				Each agent gets a unique ID, a display name, a role template, a
				description of what they do, scoped filesystem access, and a list
				of available tools.
			</p>
			<CodeBlock title="/company/team/agents.yaml">
				{`agents:
  - id: sam
    name: Sam
    role: strategist
    description: "Scopes features, writes specs, analyzes requirements"
    model: claude-sonnet-4-20250514          # Optional per-agent model override
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
    tools: [read_file, write_file, git_commit, git_create_pr, send_message,
            run_command, http_request]

  - id: riley
    name: Riley
    role: reviewer
    description: "Reviews code quality, checks against spec"
    fs_scope:
      read: ["/knowledge/technical/**", "/projects/**", "/tasks/**"]
      write: ["/tasks/**", "/comms/**"]
    tools: [read_file, send_message, search_knowledge]

  # Multiple agents can share a role
  - id: alice
    name: Alice
    role: developer
    description: "Frontend specialist, React and CSS"
    model: claude-sonnet-4-20250514              # Use faster model for UI work
    fs_scope:
      read: ["/projects/frontend/**", "/tasks/**", "/knowledge/technical/**"]
      write: ["/projects/frontend/**", "/tasks/**", "/comms/**"]
    tools: [read_file, write_file, git_commit, git_create_pr, send_message]

  - id: ceo
    name: CEO
    role: meta
    description: "Decomposes intent, manages company structure"
    fs_scope:
      read: ["/**"]                           # CEO can read everything
      write: ["/tasks/**", "/team/**", "/comms/**"]
    tools: [read_file, write_file, create_task, send_message, update_task]`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Per-Agent Provider and Model Selection
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Each agent can use a different model. The company-level{' '}
				<code className="font-mono text-xs text-purple">company.yaml</code>{' '}
				sets the default, and agents can override it. This lets you use a
				powerful model for complex work (implementation, strategy) and a
				faster/cheaper model for routine tasks (review, health checks).
			</p>
			<CodeBlock title="model-selection.yaml">
				{`# company.yaml — default model for all agents
settings:
  model: claude-sonnet-4-20250514

# agents.yaml — per-agent overrides
agents:
  - id: max
    role: developer
    model: claude-sonnet-4-20250514          # Complex implementation work → most capable

  - id: riley
    role: reviewer
    model: claude-sonnet-4-20250514      # Code review → fast and capable

  - id: ops
    role: devops
    model: claude-sonnet-4-20250514      # Health checks → fast and cheap`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Managing Agents at Runtime
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				You can add and remove agents at any time without restarting the
				orchestrator. The FS watcher detects changes to agents.yaml and
				updates the agent roster live.
			</p>
			<CodeBlock title="terminal">
				{`# Add a new agent via CLI
$ autopilot agent add --name "Alice" --role developer --desc "Frontend specialist"
Added agent "alice" (developer) to team/agents.yaml

# Remove an agent
$ autopilot agent remove alice
Removed agent "alice" from team/agents.yaml

# List all agents and their status
$ autopilot agents
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

# The CEO agent can also manage the roster
$ autopilot ask "Add a QA agent for testing"
# CEO will edit agents.yaml and create the agent definition

# Or just edit the YAML directly — the watcher picks it up
$ vim team/agents.yaml`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Role Templates
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Roles define the default system prompt, tools, filesystem scope,
				and behavior for an agent. Built-in templates cover the most
				common company functions:
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Role
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								What They Do
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Default FS Access
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">meta</td>
							<td className="py-2 pr-4 text-xs">
								Decomposes intent, manages team, owns workflows
							</td>
							<td className="py-2 text-xs font-mono">read: /** write: /tasks, /team, /comms</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">strategist</td>
							<td className="py-2 pr-4 text-xs">
								Scopes features, writes specs, defines requirements
							</td>
							<td className="py-2 text-xs font-mono">read: /knowledge, /projects/*/docs</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">planner</td>
							<td className="py-2 pr-4 text-xs">
								Creates implementation plans from specs
							</td>
							<td className="py-2 text-xs font-mono">read: /knowledge, /projects</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">developer</td>
							<td className="py-2 pr-4 text-xs">
								Writes code, creates branches and PRs
							</td>
							<td className="py-2 text-xs font-mono">read+write: /projects/*/code</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">reviewer</td>
							<td className="py-2 pr-4 text-xs">
								Reviews code quality, approves/rejects PRs
							</td>
							<td className="py-2 text-xs font-mono">read: /projects write: /tasks, /comms</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">devops</td>
							<td className="py-2 pr-4 text-xs">
								Deploys, monitors infrastructure, incidents
							</td>
							<td className="py-2 text-xs font-mono">read+write: /infra, /logs</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">marketing</td>
							<td className="py-2 pr-4 text-xs">
								Copy, social media, campaigns, announcements
							</td>
							<td className="py-2 text-xs font-mono">read: /knowledge/brand write: /projects/*/marketing</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">design</td>
							<td className="py-2 pr-4 text-xs">
								UI/UX design, design system, mockups
							</td>
							<td className="py-2 text-xs font-mono">read: /knowledge/brand write: /projects/*/design</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-ghost leading-relaxed mb-4">
				You can create custom roles by adding role template files to{' '}
				<code className="font-mono text-xs text-purple">/company/team/roles/</code>.
				Custom roles define system prompt instructions, default tools, and
				default FS scope that any agent assigned to that role inherits.
			</p>
			<CodeBlock title="/company/team/roles/qa.yaml">
				{`# Custom role template
id: qa
name: "Quality Assurance"
description: "Writes and runs tests, validates against specs"

system_prompt: |
  You are a QA specialist. Your job is to ensure code quality through
  testing. You write unit tests, integration tests, and end-to-end tests.
  You validate implementations against their specs.

  Rules:
  - Every implementation must have corresponding tests
  - Test both happy paths and edge cases
  - Report test coverage metrics
  - If coverage is below 80%, create a task for more tests

default_tools: [read_file, write_file, run_command, send_message, create_task]

default_fs_scope:
  read: ["/projects/**", "/knowledge/technical/**", "/tasks/**"]
  write: ["/projects/*/code/tests/**", "/tasks/**", "/comms/**"]`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				FS Scope Enforcement
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every agent is sandboxed. The orchestrator enforces filesystem
				scope at the provider level — the Claude Agent SDK's permission
				modes prevent agents from reading or writing outside their
				defined paths. This is not advisory; it is enforced.
			</p>
			<CodeBlock title="scope-enforcement">
				{`# FS scope is defined per agent in agents.yaml
fs_scope:
  read: ["/knowledge/technical/**", "/projects/**", "/tasks/**"]
  write: ["/projects/*/code/**", "/tasks/**", "/comms/**"]

# What happens when an agent tries to access outside scope:
max> read_file("/secrets/stripe.yaml")
ERROR: Access denied. /secrets/ is outside your read scope.

max> write_file("/team/agents.yaml", "...")
ERROR: Access denied. /team/ is outside your write scope.

max> read_file("/context/memory/riley/memory.yaml")
ERROR: Access denied. Other agents' memory is never accessible.

# The orchestrator enforces this via Claude Agent SDK's permissionMode
# and by restricting the cwd and allowedPaths in the session config`}
			</CodeBlock>
			<CodeBlock title="scope-enforcement-matrix">
				{`Access by role:     meta  strat  dev  review  plan  devops  mktg  design
─────────────────────────────────────────────────────────────────────────
Company overview     read  read   —      —      —     —      —      —
All tasks            read  read   own    own    own   own    own    own
Code repos           —     —      r/w    read   read  read   —      —
Infrastructure       —     —      —      —      —     r/w    —      —
Brand & marketing    —     read   —      —      —     —      r/w    r/w
Knowledge (all)      read  read   tech   tech   tech  infra  brand  brand
Other agents' memory NEVER NEVER  NEVER  NEVER  NEVER NEVER  NEVER  NEVER
Own memory           read  read   read   read   read  read   read   read
Comms channels       r/w   r/w    r/w    r/w    r/w   r/w    r/w    r/w`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Memory Isolation
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Memory is private. No agent reads another agent's memory. This
				is an absolute rule enforced by filesystem scope. Cross-agent
				information sharing happens only through two channels:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Communication channels</strong> —
					messages in{' '}
					<code className="font-mono text-xs text-purple">/comms/channels/</code>{' '}
					are readable by all agents who participate
				</li>
				<li>
					<strong className="text-fg">Task history</strong> — the task YAML
					file contains an append-only history log visible to all agents
					assigned to that task
				</li>
			</ul>
			<p className="text-ghost leading-relaxed mb-4">
				If an agent needs information outside their scope, they use{' '}
				<code className="font-mono text-xs text-purple">ask_agent</code>.
				The owning agent decides whether to share, summarize, or escalate
				to human.
			</p>
			<CodeBlock title="cross-agent-info-sharing.ts">
				{`// Max needs to know what auth library Sam chose
ask_agent({
  to: "agent:sam",
  question: "What auth library did you choose for the login flow?",
  reason: "I need to integrate it with the pricing page checkout",
  urgency: "normal",
  references: ["TASK-003"]
})

// Sam decides to share (or not)
// → If Sam is idle, the orchestrator spawns Sam to answer
// → Sam reads the spec, responds with relevant info
// → Max receives the answer in their context

// If the info is in shared knowledge, Sam might say:
// "See /knowledge/technical/auth-decisions.md — I documented it there"
// Max can then read that file (it's in their scope)`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Context Assembly (4 Layers)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Before every agent session, the Context Assembler builds a
				system prompt from four sources. Each layer has a different
				purpose, update frequency, and token budget.
			</p>
			<CodeBlock title="4-layer-context-assembly">
				{`┌──────────────────────────────────────────────────────────┐
│                    CONTEXT ASSEMBLER                      │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Identity │ │ Company  │ │  Memory  │ │  Task    │    │
│  │ Layer    │ │ State    │ │  Store   │ │ Context  │    │
│  │ ~2K tok  │ │ ~5K tok  │ │ ~20K tok │ │ ~15K tok │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│       │            │            │            │            │
│       ▼            ▼            ▼            ▼            │
│  ┌─────────────────────────────────────────────────┐     │
│  │           SYSTEM PROMPT (assembled)              │     │
│  │                                                   │     │
│  │  1. Identity (who you are, rules, team roster)    │     │
│  │  2. Company state (role-scoped live snapshot)      │     │
│  │  3. Memories (facts, decisions, patterns, errors)  │     │
│  │  4. Task context (spec, plan, history, code)       │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
                         │
                   AGENT SESSION
                   (Claude Agent SDK)
                         │
                    session ends
                         │
                         ▼
              MEMORY EXTRACTOR (Haiku)
              Extracts facts, decisions,
              learnings → memory.yaml`}
			</CodeBlock>
			<div className="space-y-4 mb-8">
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						<span className="text-purple font-mono mr-2">L1</span>
						Identity (~2K tokens)
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Role definition, behavioral rules, team roster, available tools,
						company conventions. Loaded from agents.yaml and company.yaml.
						Never changes within a session. Never truncated.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						<span className="text-purple font-mono mr-2">L2</span>
						Company State (~5K tokens)
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Real-time, role-scoped snapshot generated fresh before each
						session. Developer sees active tasks, branches, review queue.
						CEO sees all projects, team status, human inbox. DevOps sees
						infrastructure health, deployments, alerts. Includes available
						skills metadata.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						<span className="text-purple font-mono mr-2">L3</span>
						Memory Store (~20K tokens)
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Persistent agent memory from past sessions. Facts about the
						codebase, architecture decisions, known mistakes to avoid,
						patterns noticed, previous sessions on the current task. Ranked
						by relevance before loading.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						<span className="text-purple font-mono mr-2">L4</span>
						Task Context (~15K tokens)
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Everything about the current task: YAML definition, spec and
						plan documents, task history, dependencies, related messages,
						code context (recent commits, changed files, planner-identified
						relevant files).
					</p>
				</div>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Agent Lifecycle
			</h2>
			<ol className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">Trigger fires</strong> — task assigned,
					schedule fires, webhook received, agent mentioned, message received
				</li>
				<li>
					<strong className="text-fg">Context Assembler runs</strong> — builds
					role-scoped system prompt from 4 layers
				</li>
				<li>
					<strong className="text-fg">Agent spawns</strong> — Claude Agent SDK
					session created with tools, MCP servers, hooks, and FS sandbox
				</li>
				<li>
					<strong className="text-fg">Agent works</strong> — reads files,
					writes code, calls primitives, communicates with other agents
				</li>
				<li>
					<strong className="text-fg">Session streams</strong> — all tool
					calls captured as JSONL for{' '}
					<code className="font-mono text-xs text-purple">
						autopilot attach
					</code>{' '}
					and replay
				</li>
				<li>
					<strong className="text-fg">Session ends</strong> — completes work
					or times out
				</li>
				<li>
					<strong className="text-fg">Memory Extractor</strong> — Haiku
					extracts facts, decisions, learnings, session summary
				</li>
				<li>
					<strong className="text-fg">Workflow routes</strong> — engine checks
					transitions, spawns next agent if needed
				</li>
			</ol>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Agent Primitives
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents do not chat. They call structured primitives. Thinking is
				private and messy. Only tool calls produce visible effects:
			</p>
			<div className="overflow-x-auto mb-4">
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
								Used By
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
								create_task, update_task, add_blocker
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
							<td className="py-2 pr-4 text-xs text-fg">Files & Git</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								read_file, write_file, git_commit, git_create_pr
							</td>
							<td className="py-2 text-xs">Scoped per agent</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Knowledge</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								search_knowledge, semantic_search
							</td>
							<td className="py-2 text-xs">All agents</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">External</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								http_request, run_command
							</td>
							<td className="py-2 text-xs">Developer, DevOps</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-ghost leading-relaxed mb-4">
				See the{' '}
				<a href="/docs/primitives" className="text-purple">
					Primitives
				</a>{' '}
				page for full documentation on every primitive with code examples.
			</p>
		</article>
	)
}
