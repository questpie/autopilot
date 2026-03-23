import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/memory')({
	head: () => ({ ...seoHead({ title: 'Context & Memory', description: '4-layer context assembly, persistent agent memory, memory extraction after sessions, and cross-session knowledge retention.', path: '/docs/memory' }) }),
	component: Memory,
})

function Memory() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Context & Memory
			</h1>
			<p className="text-muted text-lg mb-8">
				How agents remember, learn, and maintain awareness across sessions.
				4-layer context assembly. Persistent memory extraction. Role-scoped
				isolation.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				The Problem
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				AI agents are stateless. Every Claude session starts blank. But a
				real employee does not forget yesterday's work, last week's
				decisions, or the company's architecture. For QUESTPIE Autopilot
				to work, agents need persistent memory, company awareness,
				role-scoped context, session continuity, and cross-agent
				awareness — all without reading each other's private data.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				The filesystem already stores everything. The challenge is{' '}
				<strong className="text-fg">
					what to load into each agent's context window
				</strong>{' '}
				at session start, and{' '}
				<strong className="text-fg">what to persist</strong> when the
				session ends.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				4-Layer Context System
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Before every agent session, the Context Assembler builds a
				system prompt from four sources. Each layer has a different
				purpose, update frequency, and token budget.
			</p>

			<CodeBlock title="context-assembly-architecture">
				{`┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT ASSEMBLER                         │
│                                                             │
│  Runs before every agent session. Builds the context        │
│  window from multiple sources, scoped to the agent's role.  │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Identity │ │ Company  │ │  Memory  │ │  Task    │      │
│  │ Layer    │ │ State    │ │  Store   │ │ Context  │      │
│  │ ~2K tok  │ │ ~5K tok  │ │ ~20K tok │ │ ~15K tok │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │            │            │            │              │
│       ▼            ▼            ▼            ▼              │
│  ┌─────────────────────────────────────────────────┐       │
│  │           SYSTEM PROMPT (assembled)              │       │
│  │                                                   │       │
│  │  1. Identity (who you are, your role, rules)      │       │
│  │  2. Company state (current snapshot)              │       │
│  │  3. Memories (relevant past sessions)             │       │
│  │  4. Task context (what to do right now)           │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
                   AGENT SESSION
                   (Claude Agent SDK)
                         │
                    session ends
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY EXTRACTOR                          │
│                                                             │
│  Extracts and persists:                                     │
│  - Session summary (what was done, decisions made)          │
│  - Learnings (what worked, what didn't)                     │
│  - Updated knowledge (new facts about codebase, infra)      │
│  - Relationship context (interactions with other agents)    │
└─────────────────────────────────────────────────────────────┘`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Layer 1: Identity (~2K tokens)
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				The agent's role definition. Loaded from{' '}
				<code className="font-mono text-xs text-purple">
					/company/team/agents.yaml
				</code>
				. This is the system prompt base and never changes within a
				session. It includes the role description, rules, team context,
				available tools, and filesystem scope.
			</p>
			<CodeBlock title="identity-sources">
				{`/company/team/agents.yaml       → role, description, tools, MCPs
/company/team/workflows/*.yaml  → workflows this agent participates in
/company/company.yaml           → company name, settings, conventions`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Layer 2: Company State (~5K tokens)
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				A real-time snapshot of the company, scoped to the agent's role.
				Generated fresh before each session. Each agent role sees a
				different view — the developer sees their active tasks, branches,
				and review queue. The CEO sees all projects, team status, and
				human inbox. DevOps sees infrastructure health, deployments, and
				alerts.
			</p>
			<CodeBlock title="developer-snapshot.md">
				{`## Company State — 2026-03-22T14:30:00Z

### Your Active Tasks
- **task-040**: Implement QUESTPIE Studio landing page
  Status: in_progress (since 10:05 today)
  Branch: feat/studio-landing
  Spec: /projects/questpie-studio/docs/landing-spec.md
  Last commit: "feat: scaffold landing page layout" (14:30)

- **task-044**: Fix auth redirect bug
  Status: assigned (waiting, lower priority)

### Blocked On
- task-042: GitHub repo creation (waiting on Dominik)
  → You can continue task-040 without this

### Recent Code Changes (your branches)
- feat/studio-landing: 3 commits, +247 -12 lines

### Team Context
- Sam completed landing page spec 4h ago
- Riley is available for review when you're ready
- Ops reports all systems healthy`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Layer 3: Memory Store (~20K tokens)
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				The core innovation. Each agent has a personal memory file that
				persists across sessions. Memories are structured, searchable,
				and role-scoped. The Assembler ranks memories by relevance to the
				current task and fills the budget by priority.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				Memory content is ranked by relevance before loading:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">High priority</strong> — facts
					about the codebase, known mistakes to avoid, decisions
					related to the current task, previous sessions on the
					current task
				</li>
				<li>
					<strong className="text-fg">Medium priority</strong> —
					recent sessions on other tasks, learnings file
				</li>
				<li>
					<strong className="text-fg">Low priority</strong> —
					relationship notes for agents mentioned in the current task
				</li>
			</ul>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Layer 4: Task Context (~15K tokens)
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				When an agent picks up a task, the Context Assembler loads all
				relevant context for that specific task: the task YAML itself,
				spec and plan documents, task history, dependencies, related
				messages, previous sessions on this task, and code context
				(recent commits, changed files, relevant files identified by the
				planner).
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Token Budget Management
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Each agent session has a total context budget of ~100K tokens
				(half of Claude's 200K context window). The remaining 100K is
				reserved for working memory during the session. The Assembler
				fills layers by priority — identity is never truncated, task
				context is rarely truncated, and company state can be summarized
				if needed.
			</p>
			<CodeBlock title="token-budget.ts">
				{`interface TokenBudget {
  total: number          // 100,000 — max tokens for context
  identity: number       // 2,000   — reserved for identity layer
  taskContext: number    // 15,000  — reserved for task context
  memories: number       // 20,000  — reserved for memories
  snapshot: number       // 5,000   — reserved for company state
  working: number        // 58,000  — remaining for conversation during session
}

// Priority-based filling:
// 1. Identity (never truncated)
// 2. Current task context (rarely truncated)
// 3. Recent memories & session summaries
// 4. Company snapshot (can be summarized if over budget)`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Memory File Structure
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Each agent's memory lives in{' '}
				<code className="font-mono text-xs text-purple">
					/company/context/memory/{'{agent-id}'}/
				</code>
				. The directory contains a structured memory YAML file, a
				learnings document, a relationships document, and a directory
				of session summaries.
			</p>
			<CodeBlock title="memory-directory-structure">
				{`/company/context/memory/
├── max/
│   ├── memory.yaml              # Structured memories
│   ├── learnings.md             # What I've learned
│   ├── relationships.md         # Working notes about teammates
│   └── sessions/
│       ├── 2026-03-22T10-00.md  # Session transcript summary
│       ├── 2026-03-22T14-30.md
│       └── ...
├── sam/
│   ├── memory.yaml
│   ├── learnings.md
│   └── ...
├── riley/
│   └── ...`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				memory.yaml Format
			</h3>
			<CodeBlock title="/company/context/memory/max/memory.yaml">
				{`# Facts — things the agent knows about the company/codebase
# Extracted from past sessions. Accumulate over time.
facts:
  codebase:
    - "QUESTPIE v3 uses file-convention codegen, not decorators"
    - "Auth is handled by Better Auth library, not custom"
    - "Database migrations are in /packages/questpie/migrations/"
    - "The admin panel uses a custom block system with JSONB storage"
    - "Search has multiple adapters: Postgres FTS, PgVector, Elastic, Meilisearch"

  architecture:
    - "Monorepo structure: packages/questpie, packages/admin, apps/docs"
    - "Build tool: Bun, not npm/yarn"
    - "ORM: Drizzle with bun-sql driver for PostgreSQL"
    - "Job queue: pg-boss"
    - "File storage: FlyDrive with adapter pattern"

  conventions:
    - "Always write QUESTPIE in all caps"
    - "Use conventional commits: feat:, fix:, docs:, chore:"
    - "Biome for formatting and linting, not ESLint/Prettier"
    - "No any types in TypeScript strict mode"
    - "PR-based workflow, no direct pushes to main"

  infrastructure:
    - "Single Hetzner CAX41 node with k3s"
    - "CloudNativePG for PostgreSQL (1 primary + 2 replicas)"
    - "Cloudflare R2 for backups"

  preferences:
    - "Dominik prefers small, focused PRs over large ones"
    - "Riley is strict about type safety in reviews"
    - "Code comments only for non-obvious business logic"

# Decisions — past decisions with context for why
decisions:
  - date: "2026-03-21"
    decision: "Use webhook-based Stripe integration, not redirect-based"
    reason: "Better UX, Dominik approved"
    task: task-039

  - date: "2026-03-20"
    decision: "Landing page uses static generation, not SSR"
    reason: "No dynamic data, faster load times, simpler deployment"
    task: task-040

# Patterns — recurring patterns the agent has noticed
patterns:
  - "When implementing new pages, always check /knowledge/technical/stack.md first"
  - "Riley usually requests extracting shared logic into utils in 1st review round"
  - "Dominik merges PRs within 2 hours during business hours"

# Mistakes — things that went wrong and how to avoid them
mistakes:
  - date: "2026-03-15"
    what: "Used ESLint config instead of Biome"
    fix: "Always use Biome. Config is in biome.json at repo root"

  - date: "2026-03-17"
    what: "Forgot to add migration file for new column"
    fix: "After any schema change, run bun run db:generate and commit the migration"`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Session Summaries
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				After every session, a summary is generated and stored. These
				summaries are used to restore continuity when an agent picks up
				the same task later.
			</p>
			<CodeBlock title="/company/context/memory/max/sessions/2026-03-22T10-00.md">
				{`# Session: 2026-03-22T10:00 — task-040

## What I Did
- Read Sam's spec at /projects/questpie-studio/docs/landing-spec.md
- Read Alex's implementation plan
- Scaffolded landing page layout (src/pages/landing.tsx)
- Created PricingTable component with monthly/annual toggle
- Created HeroSection component
- Set up route in app router

## Decisions Made
- Used CSS Modules over Tailwind (consistent with existing codebase)
- PricingTable takes config prop for reusability
- Static generation for landing page (no SSR needed)

## Blocked On
- task-042: Need GitHub repo for autopilot (separate project)
  → Not blocking task-040 though, continuing

## Left Off At
- Hero and Pricing sections done
- TODO: Feature grid, testimonials, footer CTA
- Branch: feat/studio-landing, 3 commits

## Notes for Next Session
- Check if Sam added the feature list to the spec
- Need design assets from Jordan for hero illustration
- Ask Riley to pre-review PricingTable component structure`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Memory Extraction
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The Memory Extractor runs after every agent session. It uses a
				cheap, fast model (Claude Haiku) to analyze the session
				transcript and extract structured updates: new facts, decisions
				made, learnings, mistakes, interaction notes, and patterns.
			</p>
			<CodeBlock title="memory-extractor.ts">
				{`async function extractAndPersistMemory(
  agentId: string,
  session: CompletedSession,
): Promise<void> {
  const memoryDir = \`/company/context/memory/\${agentId}\`

  // 1. Generate session summary (Claude Haiku — ~$0.001)
  const summary = await generateSessionSummary(session)
  await writeFile(
    \`\${memoryDir}/sessions/\${session.startedAt}.md\`,
    summary,
  )

  // 2. Extract new facts, decisions, learnings from session
  const extractions = await extractMemoryUpdates(session)
  // Returns: { facts, decisions, learnings, mistakes, interactions, patterns }

  // 3. Merge into existing memory file
  const existingMemory = await parseYaml(\`\${memoryDir}/memory.yaml\`)
  const updatedMemory = mergeMemory(existingMemory, extractions)
  await writeYaml(\`\${memoryDir}/memory.yaml\`, updatedMemory)

  // 4. Update learnings if any new ones
  if (extractions.learnings.length > 0) {
    await appendToFile(
      \`\${memoryDir}/learnings.md\`,
      formatNewLearnings(extractions.learnings),
    )
  }

  // 5. Update relationships if interactions occurred
  if (extractions.interactions.length > 0) {
    await updateRelationships(
      \`\${memoryDir}/relationships.md\`,
      extractions.interactions,
    )
  }

  // 6. Prune old sessions (keep last 50, summarize older ones)
  await pruneSessionHistory(memoryDir, {
    keepRecent: 50,
    summarizeOlder: true,
  })
}

// Total cost per session: ~$0.004
// 50 sessions/day: ~$0.20/day
// Memory system costs: <$2/month`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Memory Isolation Rules
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Memory is private. No agent reads another agent's memory. This
				is an absolute rule enforced by filesystem scope. Cross-agent
				information sharing happens only through two channels: task
				history and communication channels.
			</p>

			<CodeBlock title="context-isolation-matrix">
				{`Access by role:     meta  strat  dev  review  plan  devops  mktg  design
─────────────────────────────────────────────────────────────────────────
Company overview      ✅    ✅    ⚡     ⚡    ⚡    ⚡     ⚡      ⚡
All tasks             ✅    ✅    ⚡     ⚡    ⚡    ⚡     ⚡      ⚡
My tasks only         -     -     ✅    ✅    ✅    ✅     ✅     ✅
Business strategy     ✅    ✅    ❌    ❌    ❌    ❌     ⚡      ❌
Code details          ⚡    ❌    ✅    ✅    ✅    ⚡     ❌      ⚡
Infrastructure        ⚡    ❌    ❌    ❌    ❌    ✅     ❌      ❌
Brand & marketing     ⚡    ⚡    ❌    ❌    ❌    ❌     ✅     ✅
Design system         ⚡    ❌    ⚡    ❌    ❌    ❌     ⚡      ✅
Other agents' memory  ❌    ❌    ❌    ❌    ❌    ❌     ❌      ❌
My own memory         ✅    ✅    ✅    ✅    ✅    ✅     ✅     ✅
Session transcripts   ❌    ❌    ❌    ❌    ❌    ❌     ❌      ❌
Channel messages      ✅    ✅    ✅    ✅    ✅    ✅     ✅     ✅

✅ = Full access     ⚡ = Summary/limited     ❌ = No access`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Key Isolation Principles
			</h3>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">
						No agent reads another agent's memory
					</strong>{' '}
					— ever. Memory files are private to their owner.
				</li>
				<li>
					<strong className="text-fg">
						No agent reads session transcripts
					</strong>{' '}
					— only summaries via task history.
				</li>
				<li>
					<strong className="text-fg">CEO sees the most</strong> —
					but never individual agent memories or full transcripts.
				</li>
				<li>
					<strong className="text-fg">
						Cross-agent communication
					</strong>{' '}
					— happens through channels (
					<code className="font-mono text-xs text-purple">
						/comms/channels/
					</code>
					) and task history only.
				</li>
				<li>
					<strong className="text-fg">
						Shared knowledge is readable by all
					</strong>{' '}
					— within filesystem scope permissions, at{' '}
					<code className="font-mono text-xs text-purple">
						/company/knowledge/
					</code>
					.
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Shared vs Personal Knowledge
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				When an agent learns something, there is a clear rule for where
				it goes:
			</p>
			<CodeBlock title="knowledge-routing">
				{`Agent Memory (personal)     → /company/context/memory/{agent-id}/
Shared Knowledge (company)  → /company/knowledge/

Rule:
  If a fact is about the agent's working patterns → personal memory
  If a fact is about the company/product/tech     → shared knowledge

Example:
  Max discovers that Drizzle migrations require a --strict flag.
  1. Personal memory: "Always use --strict flag for migrations"
  2. Shared knowledge: edits /company/knowledge/technical/migrations.md`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Context Assembly Example
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				When Max picks up task-040 (landing page implementation), the
				Context Assembler builds the following context. Total budget:
				100K tokens. Used: ~32K tokens.
			</p>
			<CodeBlock title="assembled-context-for-peter">
				{`═══════════════════════════════════════════════════════
ASSEMBLED CONTEXT FOR MAX — task-040
Token budget: 100,000 | Used: ~32,000
═══════════════════════════════════════════════════════

───────────── IDENTITY (2,100 tokens) ─────────────
[system prompt with role, team, rules, conventions]

───────────── COMPANY STATE (3,200 tokens) ─────────
## Your Active Tasks
- task-040: Landing page (in_progress, feat/studio-landing)
- task-044: Auth redirect bug (assigned, waiting)

## Blocked On
- task-042: GitHub repo (waiting on Dominik) — not blocking task-040

## Team
- Sam: idle | Riley: available for review | Ops: systems green

───────────── MEMORIES (18,500 tokens) ─────────────
## Facts
[27 facts about codebase, architecture, conventions]

## Relevant Decisions
- 2026-03-21: Webhook-based Stripe (Dominik approved)
- 2026-03-20: Static generation for landing page
- 2026-03-18: PricingTable takes config prop

## Mistakes to Avoid
- Use Biome not ESLint
- Always run db:generate after schema changes

## Previous Sessions on task-040
### 2026-03-22T10:00
- Scaffolded layout, created PricingTable and HeroSection
- Left off at: Hero and Pricing done, TODO features grid

## Patterns
- Reviewer requests extracting shared logic in 1st review round
- Break PRs into <200 lines for faster reviews

───────────── TASK CONTEXT (8,200 tokens) ──────────
## Task: task-040 — Create QUESTPIE Studio landing page
Status: in_progress
Branch: feat/studio-landing
Spec: [full content of landing-spec.md]
Plan: [full content of landing-plan.md]

## Task History
- 10:00 CEO created from intent
- 10:01 Assigned to Sam for scoping
- 10:30 Sam completed spec
- 14:30 Max started implementation

## Code Context
Branch: feat/studio-landing (3 commits, +247 -12)
Changed files: landing.tsx, PricingTable.tsx, landing.css
═══════════════════════════════════════════════════════`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Memory Pruning & Consolidation
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Memory files grow over time. The system runs weekly consolidation
				via the orchestrator's cron scheduler: pruning old sessions
				(keeping the last 50, summarizing older ones), deduplicating
				facts, consolidating learnings, and cleaning up old snapshots.
			</p>
			<CodeBlock title="consolidation-schedule.yaml">
				{`# Run weekly via orchestrator cron
consolidation:
  schedule: "0 2 * * 0"  # Sundays at 2 AM
  actions:
    - prune_sessions: { keep: 50 }
    - deduplicate_facts: true
    - consolidate_learnings: true
    - cleanup_old_snapshots: { keep_days: 7 }`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				Storage costs are negligible. A fully populated agent memory is
				~50-100 KB of YAML/Markdown. Session summaries are ~2-5 KB each.
				For 50 sessions per agent across a typical team: a few hundred
				files at ~5 KB each = a few MB total.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Human-Readable Memory
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				All memory files are plain text in the filesystem. No
				proprietary format, no database, no API required. The human can
				read, edit, or delete any agent's memory directly.
			</p>
			<CodeBlock title="memory-operations.sh">
				{`# Read an agent's memory
$ cat /company/context/memory/max/memory.yaml

# Edit a wrong fact
$ vim /company/context/memory/max/memory.yaml

# Delete a stale learning
$ vim /company/context/memory/max/learnings.md

# Bootstrap memory for a new company
$ autopilot knowledge import ./docs/     # Import existing docs
$ autopilot knowledge scan ./code/       # Scan codebase for facts`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Summary
			</h2>
			<div className="overflow-x-auto mb-6">
				<table className="w-full text-ghost text-sm font-mono border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-fg py-2 pr-4">Layer</th>
							<th className="text-left text-fg py-2 pr-4">What</th>
							<th className="text-left text-fg py-2 pr-4">
								When Updated
							</th>
							<th className="text-left text-fg py-2">Lifetime</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-purple">Identity</td>
							<td className="py-2 pr-4">Role, rules, team</td>
							<td className="py-2 pr-4">Manual (config change)</td>
							<td className="py-2">Permanent</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-purple">Company State</td>
							<td className="py-2 pr-4">Current snapshot</td>
							<td className="py-2 pr-4">Every session start</td>
							<td className="py-2">Ephemeral</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-purple">Memory Store</td>
							<td className="py-2 pr-4">
								Facts, decisions, learnings
							</td>
							<td className="py-2 pr-4">Every session end</td>
							<td className="py-2">Persistent (pruned)</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-purple">Task Context</td>
							<td className="py-2 pr-4">
								Spec, plan, history, code
							</td>
							<td className="py-2 pr-4">Every session start</td>
							<td className="py-2">Per-task</td>
						</tr>
					</tbody>
				</table>
			</div>
		</article>
	)
}
