import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/use-cases/solo-dev')({
	head: () => ({
		meta: [
			{ title: 'Solo Dev Shop — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Default agents.yaml + development workflow. One founder runs a full company with AI agents configured in YAML.',
			},
			{ property: 'og:title', content: 'Solo Dev Shop — QuestPie Autopilot' },
			{
				property: 'og:description',
				content:
					'Default agents.yaml + development workflow. One founder runs a full company with AI agents configured in YAML.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/use-cases/solo-dev' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/use-cases/solo-dev' }],
	}),
	component: SoloDevPage,
})

function SoloDevPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">USE CASE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Solo Dev Shop
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						The default template. 8 agents, 1 workflow, 0 employees.
						Dogfooded daily at QuestPie s.r.o. — this page was built using
						this exact configuration.
					</p>
				</section>

				{/* AGENTS CONFIG */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">agents.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="company.yaml — default agents">
							{`agents:
  ceo:
    role: Company Orchestrator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http, search_web, browse]

  sam:
    role: Strategist
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, search_web, browse]

  alex:
    role: Planner
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search]

  max:
    role: Senior Full-Stack Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]
    skills: [typescript, react, bun, testing]

  riley:
    role: Code Reviewer & Security Auditor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]

  ops:
    role: DevOps & Infrastructure
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]

  morgan:
    role: Content & Marketing
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web, browse]

  jordan:
    role: UI/UX Designer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search]`}
						</CodeBlock>
					</div>
					<p className="font-mono text-xs text-lp-muted mt-4 max-w-[560px]">
						Same engine, different YAML = different company. This is the default.
						Rename agents, swap models, add skills — it is just config.
					</p>
				</section>

				{/* WORKFLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">development.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="workflows/development.yaml">
							{`workflow: development
steps:
  - name: decompose
    agent: ceo
    action: analyze_intent
    outputs: [task_tree]

  - name: strategize
    agent: sam
    action: define_approach

  - name: plan
    agent: alex
    action: create_task_tree
    outputs: [tasks, dependencies]

  - name: implement
    agent: max
    action: write_code_and_tests

  - name: review
    agent: riley
    action: audit_code
    outputs: [approved, findings]

  - name: human_merge
    type: human_gate
    action: approve_or_reject

  - name: deploy_staging
    agent: ops
    action: deploy
    env: staging

  - name: verify_staging
    agent: ops
    action: run_health_checks

  - name: human_production
    type: human_gate
    action: approve_production

  - name: deploy_production
    agent: ops
    action: deploy
    env: production

  - name: verify_production
    agent: ops
    action: run_health_checks

  - name: announce
    agent: morgan
    action: write_release_notes`}
						</CodeBlock>
					</div>
				</section>

				{/* TERMINAL FLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Full flow</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal">
							{`$ autopilot chat ceo "Build a pricing page with 3 tiers"

[ceo]       Decomposing intent into task tree...
[ceo]       Created 4 tasks, assigned to sam, alex, max, jordan
[sam]       Defining strategic approach: competitor analysis, tier structure
[alex]      Task tree ready: 4 implementation tasks, 2 dependencies
[max]       Implementing pricing page component...
[max]       Tests passing: 12/12
[max]       PR #847 created: feat/pricing-page
[riley]     Reviewing PR #847...
[riley]     Approved. 0 issues found.

  HUMAN GATE: Review PR #847 and approve merge
  $ autopilot approve merge pr-847

[ops]       Deploying to staging...
[ops]       Health checks: 4/4 passing

  HUMAN GATE: Approve production deploy
  $ autopilot approve deploy production

[ops]       Deploying to production...
[ops]       Health checks: 4/4 passing
[morgan]    Release notes published.

# Total human effort: 2 approvals (~5 min)
# Total agent effort: 10 steps (~30 min)
# Result: idea -> deployed feature`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
							{`bun add -g @questpie/autopilot
autopilot init my-project
autopilot start`}
						</CodeBlock>
					</div>
					<a
						href="/docs/getting-started"
						className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
					>
						Get Started
					</a>
				</section>
			</main>
		</div>
	)
}
