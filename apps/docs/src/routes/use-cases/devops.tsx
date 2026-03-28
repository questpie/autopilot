import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/use-cases/devops')({
	head: () => ({
		meta: [
			{ title: 'DevOps / SRE — Incident Response — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'SRE agents with incident.yaml workflow. Triage, investigate, hotfix, review, human merge, deploy, verify, complete.',
			},
			{ property: 'og:title', content: 'DevOps / SRE — Incident Response — QuestPie Autopilot' },
			{
				property: 'og:description',
				content: 'SRE agents with incident.yaml workflow. 8-step incident response.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/use-cases/devops' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/use-cases/devops' }],
	}),
	component: DevOpsPage,
})

function DevOpsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">USE CASE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						DevOps / SRE
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						SRE agents with an 8-step incident response workflow. Persistent
						memory means the third time an alert fires for the same root
						cause, triage takes 3 minutes instead of 20.
					</p>
				</section>

				{/* AGENTS CONFIG */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">agents.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="company.yaml — SRE agents">
							{`agents:
  sre-lead:
    role: Primary SRE & Incident Responder
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]
    skills: [incident-response, runbooks, deployments, monitoring]

  infra-dev:
    role: Infrastructure Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [terraform, ci-cd, automation, iac]

  change-reviewer:
    role: Change Reviewer & Risk Assessor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [security, cost-analysis, rollback-validation]

  comms:
    role: Incident Communications
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search]
    skills: [status-pages, post-mortems, stakeholder-updates]`}
						</CodeBlock>
					</div>
				</section>

				{/* WORKFLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">incident.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="workflows/incident.yaml">
							{`workflow: incident-response
steps:
  - name: triage
    agent: sre-lead
    action: classify_severity
    outputs: [severity, affected_services, blast_radius]

  - name: investigate
    agent: sre-lead
    action: correlate_logs_metrics
    inputs: [severity, affected_services]
    outputs: [root_cause, runbook_match]

  - name: hotfix
    agent: sre-lead
    action: prepare_fix
    inputs: [root_cause, runbook_match]
    outputs: [hotfix_diff]

  - name: quick_review
    agent: change-reviewer
    action: review_hotfix
    inputs: [hotfix_diff]
    outputs: [approved, risk_assessment]

  - name: human_merge
    type: human_gate
    action: approve_or_reject

  - name: deploy_hotfix
    agent: sre-lead
    action: apply_to_production
    requires: [human_merge.approved]

  - name: verify
    agent: sre-lead
    action: run_health_checks
    outputs: [health_status]

  - name: complete
    agents: [comms, sre-lead]
    action: write_postmortem_update_runbooks`}
						</CodeBlock>
					</div>
				</section>

				{/* TERMINAL FLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Incident response</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal">
							{`# Alert fires at 03:14 UTC
[sre-lead]        triage: P1 — api-gateway latency spike
[sre-lead]        Affected: api-gateway, auth-service
[sre-lead]        Blast radius: 40% of requests > 2s

[sre-lead]        investigate: correlating logs...
[sre-lead]        Root cause: connection pool exhaustion (auth-service)
[sre-lead]        Runbook match: runbook-047 (seen 2x before)

[sre-lead]        hotfix: increasing pool size, adding circuit breaker
[change-reviewer] quick_review: approved. Risk: low. Rollback: trivial.

  HUMAN GATE: Review hotfix and approve
  $ autopilot approve hotfix incident-2026-0328

[sre-lead]        deploy_hotfix: applied to production
[sre-lead]        verify: latency nominal. 0 errors. Health: 8/8.

[comms]           Post-mortem written. Status page updated.
[sre-lead]        Runbook-047 updated with new pool config.

# triage -> investigate -> hotfix -> quick_review
# -> human_merge -> deploy_hotfix -> verify -> complete
# 1 human gate. Memory grows with every incident.`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
							{`bun add -g @questpie/autopilot
autopilot init my-infra
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
