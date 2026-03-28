import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/features/workflows')({
	head: () => ({
		meta: [
			{ title: 'Workflow Engine — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Define multi-step workflows in YAML. Agents execute steps automatically. Humans approve at decision points.',
			},
			{
				property: 'og:title',
				content: 'Workflow Engine — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Define multi-step workflows in YAML. Agents execute steps. Humans approve at gates.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/workflows',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/workflows',
			},
		],
	}),
	component: FeatureWorkflowsPage,
})

function FeatureWorkflowsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-4">
						WORKFLOWS
					</p>
					<h1 className="font-mono text-[32px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						YAML State Machines.
						<br />
						Human Gates.
					</h1>
					<p className="font-sans text-base text-lp-muted mt-5 leading-relaxed max-w-[560px]">
						Steps, transitions, conditions. Agents execute automatically.
						Humans approve at critical points. The engine validates graph
						connectivity before anything runs.
					</p>
				</section>

				{/* ========== CORE — full development.yaml ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						THE CONFIG
					</p>

					<CodeBlock title="workflows/development.yaml">
						{`name: development
description: Full development lifecycle — strategy through production

steps:
  scope:
    agent: ceo
    auto: true
    description: Decompose intent into requirements
    transitions:
      - to: plan
        condition: requirements_clear

  plan:
    agent: ceo
    auto: true
    description: Define technical approach and task tree
    transitions:
      - to: approve_plan
        condition: tasks_created

  approve_plan:
    type: human_gate
    description: Review scope and task breakdown before coding starts
    transitions:
      - to: implement
        condition: approved
      - to: plan
        condition: rejected

  implement:
    agent: max
    auto: true
    description: Write code, tests, branch per task
    transitions:
      - to: code_review
        condition: code_complete

  code_review:
    agent: riley
    auto: true
    description: Review PR — style, security, correctness
    transitions:
      - to: approve_merge
        condition: review_passed
      - to: implement
        condition: changes_requested

  approve_merge:
    type: human_gate
    description: Final sign-off before merge
    transitions:
      - to: merge
        condition: approved
      - to: implement
        condition: rejected

  merge:
    agent: max
    auto: true
    description: Squash-merge into main
    transitions:
      - to: deploy_staging

  deploy_staging:
    agent: ops
    auto: true
    description: Deploy to staging, run smoke tests
    transitions:
      - to: approve_production
        condition: staging_healthy
      - to: implement
        condition: staging_failed

  approve_production:
    type: human_gate
    description: Greenlight production deploy
    transitions:
      - to: deploy_production
        condition: approved

  deploy_production:
    agent: ops
    auto: true
    description: Rolling deploy to production
    transitions:
      - to: verify

  verify:
    agent: ops
    auto: true
    description: Health checks, error rate monitoring
    transitions:
      - to: done
        condition: healthy

  done:
    type: terminal
    description: Workflow complete`}
					</CodeBlock>
				</section>

				{/* ========== HOW — flow diagram ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						HOW IT EXECUTES
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<CodeBlock title="execution flow">
							{`scope          [ceo]     auto
  |
  v
plan           [ceo]     auto
  |
  v
APPROVE PLAN   [you]     ◆ HUMAN GATE
  |         \\
  v          --> plan (rejected)
implement      [max]     auto
  |                       ^
  v                       | changes_requested
code_review    [riley]   auto
  |                       | rejected
  v                       |
APPROVE MERGE  [you]     ◆ HUMAN GATE
  |
  v
merge          [max]     auto
  |
  v
deploy_staging [ops]     auto
  |         \\
  v          --> implement (staging_failed)
APPROVE PROD   [you]     ◆ HUMAN GATE
  |
  v
deploy_prod    [ops]     auto
  |
  v
verify         [ops]     auto
  |
  v
done           ---       terminal

12 steps. 8 automated. 3 human gates. 1 terminal.`}
						</CodeBlock>

						<CodeBlock title="terminal — live execution">
							{`$ autopilot chat ceo "Build pricing page"

[workflow:development] Starting -> scope
[ceo]    Decomposing: 3 requirements identified
[ceo]    -> plan
[ceo]    Task tree: TASK-47, TASK-48, TASK-49

[workflow] ◆ HUMAN GATE: approve_plan
  Review scope and task breakdown
  [Approve] [Reject]

> approved

[workflow] -> implement
[max]    Branch: feature/TASK-47-pricing-table
[max]    Writing src/components/PricingTable.tsx
[max]    Writing tests/PricingTable.test.tsx
[max]    bun test -- 47 passed, 0 failed
[max]    -> code_review

[riley]  Reviewing PR #23
[riley]  Issue: unused import (line 12)
[riley]  -> implement (changes_requested)

[max]    Fixing...
[max]    bun test -- 47 passed
[riley]  Approved
[riley]  -> approve_merge

[workflow] ◆ HUMAN GATE: approve_merge
  Final sign-off before merge
  [Approve] [Reject] [View Diff]

> approved

[max]    Squash-merged PR #23
[ops]    Deploying to staging...
[ops]    Smoke tests: 12/12 passed

[workflow] ◆ HUMAN GATE: approve_production
  Greenlight production deploy
  [Approve]

> approved

[ops]    Rolling deploy: 100%
[ops]    Health check: 200 OK
[ops]    Error rate: 0.00%
[workflow] -> done ✓`}
						</CodeBlock>
					</div>
				</section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8">
					<div className="max-w-md">
						<CodeBlock title="terminal">
							{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ autopilot start`}
						</CodeBlock>
					</div>
					<div className="flex gap-4 mt-6">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							className="inline-block border border-lp-border text-lp-fg font-mono text-sm px-6 py-3 hover:border-[#B700FF] transition-colors no-underline"
						>
							View on GitHub
						</a>
					</div>
				</section>
			</main>
		</div>
	)
}
