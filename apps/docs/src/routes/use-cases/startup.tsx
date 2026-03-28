import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/use-cases/startup')({
	head: () => ({
		meta: [
			{ title: 'Startup Team — AI + Human Hybrid — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'3 AI agents + 3 humans in one config. Human gates at every critical decision. Augment your team, not replace it.',
			},
			{ property: 'og:title', content: 'Startup Team — AI + Human Hybrid — QuestPie Autopilot' },
			{
				property: 'og:description',
				content: '3 AI agents + 3 humans in one config. Human gates at every critical decision.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/use-cases/startup' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/use-cases/startup' }],
	}),
	component: StartupPage,
})

function StartupPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">USE CASE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Startup Team
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						3 AI agents + 3 humans. Same config file. Human gates at every
						critical decision. The point: augment your 2-5 person team, not
						replace it.
					</p>
				</section>

				{/* AGENTS CONFIG */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">agents.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="company.yaml — AI agents">
							{`agents:
  riley:
    role: Code Reviewer & Security Auditor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [code-review, security-audit, performance]

  ops:
    role: DevOps & Deployment
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [ci-cd, docker, monitoring]

  morgan:
    role: Technical Writer & Changelog
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search]
    skills: [technical-writing, changelog, release-notes]`}
						</CodeBlock>
					</div>
					<div className="max-w-[720px] mt-6">
						<CodeBlock title="humans.yaml">
							{`humans:
  alice:
    role: CTO / Lead Engineer
    gates: [architecture, production-deploy, security-critical]
    notify: [slack, email]

  bob:
    role: Full-Stack Developer
    gates: [merge-approval]
    notify: [slack]

  carol:
    role: Product Manager
    gates: [feature-scope, roadmap-changes]
    notify: [email]`}
						</CodeBlock>
					</div>
					<p className="font-mono text-xs text-lp-muted mt-4 max-w-[560px]">
						Humans define which gates they own. AI agents cannot bypass a
						human gate. Alice approves architecture. Bob approves merges.
						Carol approves scope changes.
					</p>
				</section>

				{/* WORKFLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">hybrid-dev.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="workflows/hybrid-dev.yaml">
							{`workflow: hybrid-development
steps:
  - name: scope
    type: human_gate
    owner: carol
    action: approve_feature_scope

  - name: implement
    agent: bob          # human writes the code
    type: human

  - name: ai_review
    agent: riley
    action: audit_code
    outputs: [approved, findings]

  - name: human_review
    type: human_gate
    owner: alice
    action: review_architecture

  - name: merge
    type: human_gate
    owner: bob
    action: approve_merge

  - name: deploy_staging
    agent: ops
    action: deploy
    env: staging

  - name: verify
    agent: ops
    action: run_health_checks

  - name: deploy_production
    type: human_gate
    owner: alice
    action: approve_production

  - name: release
    agent: ops
    action: deploy
    env: production

  - name: changelog
    agent: morgan
    action: write_changelog`}
						</CodeBlock>
					</div>
					<p className="font-mono text-xs text-lp-muted mt-4 max-w-[560px]">
						4 human gates in 10 steps. Humans own scope, architecture, merge,
						and production. AI handles review, deploy, verify, and docs.
					</p>
				</section>

				{/* TERMINAL FLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">What this looks like</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal">
							{`# Carol approves the feature scope
$ autopilot approve scope feat-user-settings

# Bob writes the code (human)
# Bob pushes PR #312

# Riley reviews automatically
[riley]  Reviewing PR #312...
[riley]  1 finding: missing input validation on email field
[riley]  Status: changes-requested

# Bob fixes, pushes again
[riley]  Re-reviewing PR #312...
[riley]  Approved. 0 findings.

# Alice reviews architecture
$ autopilot approve architecture pr-312

# Bob approves merge
$ autopilot approve merge pr-312

# Ops takes over
[ops]    Deployed to staging. Health: 6/6.

# Alice approves production
$ autopilot approve deploy production

[ops]    Deployed to production. Health: 6/6.
[morgan] Changelog updated.`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
							{`bun add -g @questpie/autopilot
autopilot init my-startup
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
