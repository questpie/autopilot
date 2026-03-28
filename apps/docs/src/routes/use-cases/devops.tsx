import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/use-cases/devops')({
	head: () => ({
		meta: [
			{ title: 'Infrastructure — AI SRE Team — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Automated incident response, runbook execution, deployment pipelines. 5-minute triage, persistent runbook memory, auto post-mortems.',
			},
			{
				property: 'og:title',
				content: 'Infrastructure — AI SRE Team — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Automated incident response, runbook execution, deployment pipelines. 5-minute triage, persistent runbook memory, auto post-mortems.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/use-cases/devops',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Infrastructure — AI SRE Team — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/use-cases/devops',
			},
		],
	}),
	component: UseCaseDevOpsPage,
})

function UseCaseDevOpsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>USE CASE</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Infrastructure.
						<br />
						AI SRE Team.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Automated incident response, runbook execution, and deployment
						pipelines. Persistent memory means your AI team learns from every
						incident.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The 8-step incident response workflow automates triage, runbook
						execution, and post-mortem capture. Human approval gates ensure no
						mitigation is applied to production without your sign-off.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The third time an alert fires for the same root cause, your AI SRE
						team already knows the fix. Triage drops from 20 minutes to under 5.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try the DevOps Template
						</a>
					</div>
				</section>

				{/* ========== BEFORE / AFTER ========== */}
				<Section id="before-after">
					<SectionHeader
						num="01"
						sub="Replace 3AM scrambles with structured, automated incident response."
					>
						From Panic to Process
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-red-400 mb-3">
								BEFORE AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Alert at 3AM — scramble to find the runbook</li>
								<li>Runbook in a Word doc, last updated 8 months ago</li>
								<li>Manually check 5 different dashboards</li>
								<li>Triage takes 20+ minutes to gather context</li>
								<li>Post-mortem is optional and rarely written</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								AFTER AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Ops triages severity in under 5 minutes</li>
								<li>Runbook executes automatically from knowledge base</li>
								<li>Push notification with proposed mitigation</li>
								<li>Approve from your phone, Ops applies the fix</li>
								<li>Post-mortem written automatically, runbooks updated</li>
							</ul>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Next month, when the same issue occurs, Ops recognizes the pattern
						from memory and resolves it faster. Alert-to-resolution time
						shrinks with every incident.
					</p>
				</Section>

				{/* ========== INCIDENT RESPONSE AGENTS ========== */}
				<Section id="agents">
					<SectionHeader
						num="02"
						sub="Reconfigure agents for infrastructure: monitoring, incident response, deployment, and documentation."
					>
						Your AI Infrastructure Team
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								CEO
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Routes alerts to the right specialist agent and coordinates
								multi-system incident responses.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Ops (Primary SRE)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Frontline. Triages incidents, executes runbooks, manages
								deployments, monitors health. Uses http, search, and message
								tools to coordinate.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Max (Infrastructure Dev)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes Terraform configs, CI/CD pipelines, automation scripts,
								and infrastructure-as-code.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Riley (Change Reviewer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Reviews infrastructure changes for risk. Validates rollback
								plans. Checks for security regressions and unexpected costs.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Sam (Capacity Planner)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Monitors resource usage trends, forecasts scaling needs,
								recommends optimization. Benchmarks against industry standards.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Alex (Incident Commander)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Coordinates multi-system incidents. Tracks resolution progress,
								manages communication timelines, ensures nothing falls through.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Morgan (Communicator)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes status page updates, stakeholder notifications, and
								post-mortem documents. Communications in parallel with
								resolution.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Jordan (Dashboard Builder)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates monitoring dashboards and visualization artifacts.
								Visual summaries of infrastructure health.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — devops agents">
							{`agents:
  ceo:
    name: CEO
    role: Alert Router & Incident Coordinator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http, search_web, browse]

  ops:
    name: Ops
    role: Primary SRE
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]
    skills: [incident-response, runbooks, deployments, monitoring]

  max:
    name: Max
    role: Infrastructure Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [terraform, ci-cd, automation, iac]

  riley:
    name: Riley
    role: Change Reviewer & Risk Assessor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [security, cost-analysis, rollback-validation]

  alex:
    name: Alex
    role: Incident Commander
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search]
    skills: [incident-management, coordination, timeline]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== INCIDENT RESPONSE WORKFLOW ========== */}
				<Section id="workflow">
					<SectionHeader
						num="03"
						sub="Automated incident response with structured triage and human approval before mitigation."
					>
						Detect to Resolved. 8 Steps.
					</SectionHeader>

					<div className="space-y-3 max-w-[640px]">
						{[
							{ step: 'triage', agent: 'Ops', action: 'Alert fires. Ops classifies severity (P1/P2/P3), identifies affected services, assesses blast radius' },
							{ step: 'investigate', agent: 'Ops', action: 'Checks logs, metrics, and recent deployments. Correlates data to identify root cause' },
							{ step: 'hotfix', agent: 'Ops', action: 'Prepares the fix based on investigation findings and stored runbook procedures' },
							{ step: 'quick_review', agent: 'Riley', action: 'Reviews the proposed hotfix for safety and correctness' },
							{ step: 'human_merge', agent: 'YOU', action: 'Review the proposed fix, assess risk, approve or reject — HUMAN GATE' },
							{ step: 'deploy_hotfix', agent: 'Ops', action: 'Applies the approved fix to production' },
							{ step: 'verify', agent: 'Ops', action: 'Automated health checks confirm the fix resolved the issue' },
							{ step: 'complete', agent: 'Morgan', action: 'Writes post-mortem. Ops updates runbooks in knowledge base' },
						].map((item) => (
							<div
								key={item.step}
								className="flex items-start gap-4 bg-lp-card border border-lp-border p-4"
							>
								<span className="font-mono text-xs text-[#B700FF] flex-shrink-0 w-28">
									{item.step}
								</span>
								<span className="font-mono text-xs text-white flex-shrink-0 w-16">
									{item.agent}
								</span>
								<span className="font-sans text-xs text-lp-muted">
									{item.action}
								</span>
							</div>
						))}
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="incident.yaml — workflow definition">
							{`workflow: incident-response
steps:
  - name: triage
    agent: ops
    action: classify_severity
    outputs: [severity, affected_services, blast_radius]

  - name: investigate
    agent: ops
    action: correlate_logs_metrics
    inputs: [severity, affected_services]

  - name: hotfix
    agent: ops
    action: prepare_fix
    inputs: [root_cause, runbook_match]

  - name: quick_review
    agent: riley
    action: review_hotfix
    inputs: [hotfix_diff]

  - name: human_merge
    type: human_gate
    action: approve_or_reject

  - name: deploy_hotfix
    agent: ops
    action: apply_to_production
    requires: [human_merge.approved]

  - name: verify
    agent: ops
    action: run_health_checks

  - name: complete
    agents: [morgan, ops]
    action: write_postmortem_update_runbooks`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== PERSISTENT RUNBOOK MEMORY ========== */}
				<Section id="memory">
					<SectionHeader
						num="04"
						sub="Persistent memory means your AI SRE team gets better at triage with every incident."
					>
						Agents Remember Every Incident
					</SectionHeader>

					<div className="space-y-4 max-w-[640px]">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Incident 1
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Ops investigates from scratch. Checks logs, tries multiple
								approaches, finds the fix in 20 minutes.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Incident 2
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Ops remembers the service name and the general area, researches
								the specific fix in 10 minutes.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Incident 3
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Ops recognizes the pattern from memory, applies the known fix
								in 3 minutes.
							</p>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Memory categories capture the learning: incident patterns (capped
						at 30 entries), mistakes to avoid (capped at 20), and successful
						mitigations. The knowledge base grows organically — every incident
						makes the team smarter.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Automate Your Infrastructure
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-6 max-w-md mx-auto">
						Free. Open source. Running in 5 minutes.
					</p>
					<div className="max-w-md mx-auto mb-8">
						<CodeBlock title="terminal">
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
