import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/features/workflows')({
	head: () => ({
		meta: [
			{ title: 'Workflow Engine — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Define multi-step workflows in YAML. Agents execute steps automatically. Humans approve at decision points. 3 built-in workflows included.',
			},
			{
				property: 'og:title',
				content: 'Workflow Engine — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Define multi-step workflows in YAML. Agents execute steps automatically. Humans approve at decision points. 3 built-in workflows included.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/workflows',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Workflow Engine — QuestPie Autopilot',
			},
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
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>WORKFLOWS</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						YAML State Machines.
						<br />
						Human Gates.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Define any process as a workflow. Agents execute the steps. Humans
						approve at critical points.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Declarative YAML workflows define steps, transitions, and
						conditions. Human approval gates pause execution wherever you need
						human judgment. 3 built-in workflows are included for development,
						marketing, and incident response. The validation engine checks
						graph connectivity before a single agent starts working.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						This is not a flow builder where you connect boxes. This is a state
						machine engine where every step has a defined agent, every
						transition has a condition, and every critical decision has a human
						gate.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
					</div>
				</section>

				{/* ========== HUMAN GATES ========== */}
				<Section id="human-gates">
					<SectionHeader
						num="01"
						sub="Human-in-the-loop at decision points, not everywhere. Approve merges, deploys, and budgets."
					>
						Automation Pauses for You
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Define{' '}
						<code className="font-mono text-lp-fg text-xs">
							type: human_gate
						</code>{' '}
						on any workflow step to require your approval before the workflow
						continues. When execution reaches a human gate, it pauses. A
						notification appears in your inbox on the dashboard, in the CLI via{' '}
						<code className="font-mono text-lp-fg text-xs">
							autopilot inbox
						</code>
						, and as a PWA push notification on your phone.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Approve with one click and agents resume from where they stopped.
						Reject with feedback and the workflow routes back to the previous
						step with your comments attached. Agents read your feedback and
						adjust their approach.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Review steps add team-level quality control. Set{' '}
						<code className="font-mono text-lp-fg text-xs">
							min_approvals
						</code>{' '}
						to require multiple sign-offs. Define{' '}
						<code className="font-mono text-lp-fg text-xs">
							reviewer_role
						</code>{' '}
						to ensure only qualified agents or humans review specific work. Both
						Riley's automated code review and your manual approval can be
						required before a merge proceeds.
					</p>
				</Section>

				{/* ========== DEVELOPMENT WORKFLOW ========== */}
				<Section id="development">
					<SectionHeader
						num="02"
						sub="The built-in development workflow covers the complete software lifecycle."
					>
						Strategy to Deployment. 12 Steps.
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{
								step: '1',
								title: 'Analyze',
								desc: 'CEO decomposes your intent into concrete requirements.',
								gate: false,
							},
							{
								step: '2',
								title: 'Strategize',
								desc: 'Sam defines the technical approach and priorities.',
								gate: false,
							},
							{
								step: '3',
								title: 'Plan',
								desc: 'Alex creates a task tree with dependencies and effort estimates.',
								gate: false,
							},
							{
								step: '4',
								title: 'Implement',
								desc: 'Max writes code, creates a feature branch, and runs tests.',
								gate: false,
							},
							{
								step: '5',
								title: 'Code Review',
								desc: "Riley reviews for bugs, security issues, and performance regressions.",
								gate: false,
							},
							{
								step: '6',
								title: 'Approve Merge',
								desc: "You review Max's code and Riley's comments, then approve or reject.",
								gate: true,
							},
							{
								step: '7',
								title: 'Merge',
								desc: 'Max merges the approved branch.',
								gate: false,
							},
							{
								step: '8',
								title: 'Deploy Staging',
								desc: 'Ops deploys to your staging environment.',
								gate: false,
							},
							{
								step: '9',
								title: 'Verify Staging',
								desc: 'Automated smoke tests confirm the deployment is healthy.',
								gate: false,
							},
							{
								step: '10',
								title: 'Approve Production',
								desc: 'You greenlight the production deployment.',
								gate: true,
							},
							{
								step: '11',
								title: 'Deploy Production',
								desc: 'Ops deploys to production.',
								gate: false,
							},
							{
								step: '12',
								title: 'Verify Production',
								desc: 'Post-deploy health checks confirm everything is running.',
								gate: false,
							},
						].map((item) => (
							<div
								key={item.step}
								className={`border p-6 ${item.gate ? 'bg-lp-purple-faint border-lp-purple-glow' : 'bg-lp-card border-lp-border'}`}
							>
								<div className="flex items-center gap-2 mb-1">
									<span className="font-mono text-[11px] text-lp-purple">
										STEP {item.step}
									</span>
									{item.gate && (
										<span className="font-mono text-[9px] text-lp-purple tracking-[0.1em] border border-lp-purple-glow px-1.5 py-0.5">
											HUMAN GATE
										</span>
									)}
								</div>
								<h3 className="font-mono text-sm font-bold text-white mb-2">
									{item.title}
								</h3>
								<p className="font-sans text-xs text-lp-muted leading-relaxed">
									{item.desc}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6">
						10 automated steps. 2 human decisions. One intent to start the
						entire chain.
					</p>
				</Section>

				{/* ========== MARKETING WORKFLOW ========== */}
				<Section id="marketing">
					<SectionHeader
						num="03"
						sub="From brief to publication with quality gates at every stage."
					>
						Content Pipeline. Automated.
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{
								step: '1',
								title: 'Brief',
								desc: 'Define content goals, target audience, and keywords.',
								gate: false,
							},
							{
								step: '2',
								title: 'Research',
								desc: 'Morgan researches topics, competitor content, and trending themes using search_web and browse.',
								gate: false,
							},
							{
								step: '3',
								title: 'Draft',
								desc: 'Morgan writes the first draft following brand voice guidelines from the knowledge base.',
								gate: false,
							},
							{
								step: '4',
								title: 'Review',
								desc: 'Human reviews the draft for accuracy, tone, and brand consistency.',
								gate: true,
							},
							{
								step: '5',
								title: 'Revise',
								desc: 'Morgan incorporates your feedback and produces a second draft.',
								gate: false,
							},
							{
								step: '6',
								title: 'Approve Publish',
								desc: 'Final sign-off before the content goes live.',
								gate: true,
							},
							{
								step: '7',
								title: 'Publish',
								desc: 'Morgan distributes the approved content across configured platforms.',
								gate: false,
							},
						].map((item) => (
							<div
								key={item.step}
								className={`border p-6 ${item.gate ? 'bg-lp-purple-faint border-lp-purple-glow' : 'bg-lp-card border-lp-border'}`}
							>
								<div className="flex items-center gap-2 mb-1">
									<span className="font-mono text-[11px] text-lp-purple">
										STEP {item.step}
									</span>
									{item.gate && (
										<span className="font-mono text-[9px] text-lp-purple tracking-[0.1em] border border-lp-purple-glow px-1.5 py-0.5">
											HUMAN GATE
										</span>
									)}
								</div>
								<h3 className="font-mono text-sm font-bold text-white mb-2">
									{item.title}
								</h3>
								<p className="font-sans text-xs text-lp-muted leading-relaxed">
									{item.desc}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						One human gate before publication. Everything before it runs
						autonomously. Your content pipeline produces work while you focus on
						strategy and client relationships.
					</p>
				</Section>

				{/* ========== INCIDENT RESPONSE ========== */}
				<Section id="incident">
					<SectionHeader
						num="04"
						sub="Automated incident response with structured triage, runbook execution, and post-mortem capture."
					>
						5-Minute Triage. Zero Panic.
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{[
							{
								step: '1',
								title: 'Triage',
								desc: 'Ops classifies severity as P1, P2, or P3, identifies affected services, and assesses blast radius.',
								gate: false,
							},
							{
								step: '2',
								title: 'Investigate',
								desc: 'Ops checks logs, metrics, and recent deployments. Correlates data to identify root cause.',
								gate: false,
							},
							{
								step: '3',
								title: 'Hotfix',
								desc: 'Ops prepares the fix based on investigation findings and stored runbook procedures from the knowledge base.',
								gate: false,
							},
							{
								step: '4',
								title: 'Quick Review',
								desc: 'Riley reviews the proposed hotfix for safety and correctness.',
								gate: false,
							},
							{
								step: '5',
								title: 'Human Merge',
								desc: 'You review the proposed fix before it proceeds.',
								gate: true,
							},
							{
								step: '6',
								title: 'Deploy Hotfix',
								desc: 'Ops applies the approved fix to production.',
								gate: false,
							},
							{
								step: '7',
								title: 'Verify',
								desc: 'Automated health checks confirm the fix resolved the issue.',
								gate: false,
							},
							{
								step: '8',
								title: 'Complete',
								desc: 'Ops writes a post-mortem, Morgan communicates status to stakeholders, and the knowledge base is updated.',
								gate: false,
							},
						].map((item) => (
							<div
								key={item.step}
								className={`border p-6 ${item.gate ? 'bg-lp-purple-faint border-lp-purple-glow' : 'bg-lp-card border-lp-border'}`}
							>
								<div className="flex items-center gap-2 mb-1">
									<span className="font-mono text-[11px] text-lp-purple">
										STEP {item.step}
									</span>
									{item.gate && (
										<span className="font-mono text-[9px] text-lp-purple tracking-[0.1em] border border-lp-purple-glow px-1.5 py-0.5">
											HUMAN GATE
										</span>
									)}
								</div>
								<h3 className="font-mono text-sm font-bold text-white mb-2">
									{item.title}
								</h3>
								<p className="font-sans text-xs text-lp-muted leading-relaxed">
									{item.desc}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Next time the same issue occurs, Ops remembers the root cause and
						the fix. Triage time drops from 20 minutes to under 5.
					</p>
				</Section>

				{/* ========== CUSTOM WORKFLOWS ========== */}
				<Section id="custom">
					<SectionHeader
						num="05"
						sub="Define steps, transitions, conditions, and gates. The engine validates connectivity before execution."
					>
						Build Any Process in YAML
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Every step has an assigned agent and an execution mode. Auto steps
						run without human intervention. Human gate steps pause for approval.
						Each step defines transitions with conditions that determine the
						next step in the chain.
					</p>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="workflows/client-onboarding.yaml">
							{`name: client-onboarding
description: New client onboarding process
steps:
  intake:
    agent: ceo
    auto: true
    description: Collect client requirements
    transitions:
      - to: proposal
        condition: requirements_gathered

  proposal:
    agent: sam
    auto: true
    description: Draft proposal document
    transitions:
      - to: review_proposal
        condition: proposal_ready

  review_proposal:
    type: human_gate
    description: Review and approve proposal
    transitions:
      - to: setup_project
        condition: approved
      - to: proposal
        condition: revision_needed

  setup_project:
    agent: alex
    auto: true
    description: Create project structure and tasks
    transitions:
      - to: kickoff
        condition: project_ready

  kickoff:
    agent: ceo
    auto: true
    description: Send kickoff message to client`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Workflow validation runs before execution. The engine checks that
						every step is reachable, every transition points to a valid step,
						and every condition has a corresponding outcome. Invalid workflows
						are rejected with specific error messages telling you what to fix.
					</p>
				</Section>

				{/* ========== REVIEW STEPS ========== */}
				<Section id="review">
					<SectionHeader
						num="06"
						sub="Require minimum approvals. Match reviewers by role. Block bad work."
					>
						Enforce Quality Standards
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Set{' '}
						<code className="font-mono text-lp-fg text-xs">
							min_approvals
						</code>{' '}
						on any review step to require multiple sign-offs before work
						proceeds. A code review step can require both Riley's automated
						review and a human code owner's approval. Neither alone is
						sufficient.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Define{' '}
						<code className="font-mono text-lp-fg text-xs">
							reviewer_role
						</code>{' '}
						to ensure only qualified reviewers participate. A security review
						step matches agents or humans with the security role. A design
						review step requires someone with design expertise.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Reviewers can approve, reject with detailed feedback, or request
						specific changes. Rejected work loops back to the implementation
						step with the feedback attached. The implementing agent reads the
						feedback, adjusts the work, and resubmits. All review decisions are
						logged in the audit trail.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Automate any process
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						YAML state machines with human approval gates. 3 built-in workflows
						included.
					</p>
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
