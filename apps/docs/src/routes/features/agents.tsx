import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/features/agents')({
	head: () => ({
		meta: [
			{ title: 'AI Agents — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Define AI agents in YAML. Persistent memory, structured tools, multi-provider support. Configure your team, not your prompts.',
			},
			{ property: 'og:title', content: 'AI Agents — QuestPie Autopilot' },
			{
				property: 'og:description',
				content:
					'Define AI agents in YAML. Persistent memory, structured tools, multi-provider support.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/agents',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/agents',
			},
		],
	}),
	component: FeatureAgentsPage,
})

function FeatureAgentsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-4">
						AGENTS
					</p>
					<h1 className="font-mono text-[32px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Define Your Agents
						<br />
						in YAML.
					</h1>
					<p className="font-sans text-base text-lp-muted mt-5 leading-relaxed max-w-[560px]">
						Each agent gets an identity, a provider, a model, a set of tools,
						and a filesystem sandbox. Memory persists between sessions.
						Configuration is the entire interface.
					</p>
				</section>

				{/* ========== CORE — full agents.yaml ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						THE CONFIG
					</p>

					<CodeBlock title="team/agents.yaml">
						{`# Three agents. Three roles. One file.

agents:
  ceo:
    name: CEO
    role: Company Orchestrator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools:
      - task          # create, assign, update, close
      - message       # send to channels and agents
      - pin           # surface important state
      - search        # FTS5 + vector across all entities
      - http          # external API calls
      - search_web    # web search via provider
      - browse        # read web pages
    # No fs_scope. CEO delegates. Never writes code.

  max:
    name: Max
    role: Senior Full-Stack Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools:
      - task
      - message
      - pin
      - search
      - http
      - bash          # shell execution in sandbox
    skills:
      - typescript
      - react
      - bun
      - testing
    fs_scope:
      write:
        - "src/**"
        - "tests/**"
        - "package.json"
      read:
        - "src/**"
        - "tests/**"
        - "package.json"
        - "tsconfig.json"
        - "knowledge/**"

  riley:
    name: Riley
    role: Code Reviewer & Security Auditor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools:
      - task
      - message
      - search
    fs_scope:
      read:
        - "src/**"
        - "tests/**"
        - ".github/**"
      write: []       # Riley reads. Never writes.`}
					</CodeBlock>

					<div className="mt-8 font-mono text-sm space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="border border-[#333] p-4">
								<p className="text-[#B700FF] text-xs tracking-[0.1em] mb-2">
									PROVIDER PER AGENT
								</p>
								<p className="text-lp-muted text-xs leading-relaxed">
									CEO runs on Claude Agent SDK. Riley runs on Anthropic API
									direct. Mix providers in one team. Same orchestrator handles
									both.
								</p>
							</div>
							<div className="border border-[#333] p-4">
								<p className="text-[#B700FF] text-xs tracking-[0.1em] mb-2">
									FILESYSTEM SANDBOX
								</p>
								<p className="text-lp-muted text-xs leading-relaxed">
									<span className="text-lp-fg">fs_scope.write</span> and{' '}
									<span className="text-lp-fg">fs_scope.read</span> enforced at
									the tool layer. Max writes src/. Riley cannot. No exceptions.
								</p>
							</div>
							<div className="border border-[#333] p-4">
								<p className="text-[#B700FF] text-xs tracking-[0.1em] mb-2">
									TOOLS ARE EXPLICIT
								</p>
								<p className="text-lp-muted text-xs leading-relaxed">
									An agent without{' '}
									<span className="text-lp-fg">bash</span> cannot run shell
									commands. An agent without{' '}
									<span className="text-lp-fg">http</span> cannot make external
									requests. Nothing is implicit.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* ========== HOW — terminal session output ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						WHAT A SESSION LOOKS LIKE
					</p>

					<CodeBlock title="terminal — autopilot chat ceo 'Build a pricing page'">
						{`[14:01:03] ceo      intent received
[14:01:04] ceo      tool:task    create TASK-47 "PricingTable component"
[14:01:04] ceo      tool:task    create TASK-48 "PricingTable unit tests"
[14:01:05] ceo      tool:task    assign TASK-47 → max
[14:01:05] ceo      tool:task    assign TASK-48 → max
[14:01:05] ceo      tool:message @max "Implement PricingTable.
                                  See knowledge/ui-conventions.md."

[14:01:08] max      picked up TASK-47
[14:01:09] max      tool:search  "pricing component patterns"
[14:01:10] max      tool:fs_read knowledge/ui-conventions.md
[14:01:14] max      tool:fs_write src/components/PricingTable.tsx  +87 lines
[14:01:18] max      tool:fs_write tests/PricingTable.test.tsx      +43 lines
[14:01:22] max      tool:bash    bun test PricingTable
                                  12 passed, 0 failed (1.2s)
[14:01:23] max      tool:task    update TASK-47 status=review
[14:01:23] max      tool:message @riley "PR ready for review"

[14:01:26] riley    picked up TASK-47 review
[14:01:28] riley    tool:search  "PricingTable error handling"
[14:01:30] riley    tool:task    comment TASK-47
                                  "L12: unused import. L34: missing
                                   error boundary on async fetch."

[14:01:33] max      tool:fs_write src/components/PricingTable.tsx  patch
[14:01:35] max      tool:bash    bun test PricingTable
                                  12 passed, 0 failed (1.1s)

[14:01:38] riley    tool:task    approve TASK-47
[14:01:38] riley    tool:pin     "TASK-47 approved. PR clean."

[14:01:39] max      picked up TASK-48
           ...`}
					</CodeBlock>

					<div className="mt-8">
						<CodeBlock title="terminal — memory extracted after session">
							{`$ autopilot memory show max --last-session

EXTRACTED:
  [decision]  Use ErrorBoundary wrapper on all async components
  [pattern]   PricingTable follows compound-component pattern
  [fact]      UI conventions doc at knowledge/ui-conventions.md
  [mistake]   Forgot to remove debug import on first pass

CATEGORY    COUNT   BUDGET
bio         3       --
facts       14      --
decisions   9/50    capped
mistakes    5/20    capped
patterns    7/30    capped

Extraction model: claude-haiku  Cost: $0.003
Next session: Max starts with this context.`}
						</CodeBlock>
					</div>
				</section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						GET STARTED
					</p>

					<div className="max-w-lg">
						<CodeBlock title="terminal">
							{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ cat team/agents.yaml`}
						</CodeBlock>
					</div>

					<p className="font-mono text-sm text-lp-muted mt-6 max-w-[480px]">
						Init creates the config directory with a default agents.yaml.
						Edit the file. Run{' '}
						<span className="text-lp-fg">autopilot start</span>. Your team
						is live.
					</p>

					<div className="flex gap-4 mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							className="inline-block border border-[#333] text-lp-fg font-mono text-sm px-6 py-3 hover:border-[#B700FF] transition-colors no-underline"
						>
							View on GitHub
						</a>
					</div>
				</section>
			</main>
		</div>
	)
}
