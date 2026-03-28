import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/use-cases/startup')({
	head: () => ({
		meta: [
			{ title: 'Startup Team — AI-Augmented Engineering — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Augment your 2-5 person team with AI agents for code review, DevOps, QA, and documentation. Human gates for critical decisions.',
			},
			{
				property: 'og:title',
				content: 'Startup Team — AI-Augmented Engineering — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Augment your 2-5 person team with AI agents for code review, DevOps, QA, and documentation. Human gates for critical decisions.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/use-cases/startup',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Startup Team — AI-Augmented Engineering — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/use-cases/startup',
			},
		],
	}),
	component: UseCaseStartupPage,
})

function UseCaseStartupPage() {
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
						Startup Team.
						<br />
						AI-Augmented Engineering.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Augment your 2-5 person team with AI agents for code review,
						DevOps, QA, and documentation. Human gates for every critical
						decision.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Add AI code review to every PR. Catch bugs before they ship.
						Automated DevOps without a dedicated hire. Documentation that
						writes itself from your codebase and decisions. Human approval
						gates at every critical point — your team stays in control.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						This is not about replacing your team. This is about giving your
						engineers AI teammates — configured in YAML — that handle the work
						nobody has time to do.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try the Startup Template
						</a>
					</div>
				</section>

				{/* ========== BEFORE / AFTER ========== */}
				<Section id="before-after">
					<SectionHeader
						num="01"
						sub="Keep doing what humans do best. Delegate the rest."
					>
						Your Team, Amplified
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-red-400 mb-3">
								BEFORE AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>PRs sit unreviewed for days — everyone is coding</li>
								<li>Deployments are manual, inconsistent, and scary</li>
								<li>Onboarding doc was last updated 6 months ago</li>
								<li>"We'll fix it in production" is the QA strategy</li>
								<li>Marketing is an afterthought addressed quarterly</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								AFTER AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Every PR reviewed within minutes by Riley</li>
								<li>Ops manages consistent deploys with staging verification</li>
								<li>Documentation updated automatically on code changes</li>
								<li>Test coverage tracked and enforced via workflow gates</li>
								<li>Morgan handles blog posts, changelogs, and release notes</li>
							</ul>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Your engineering team focuses on architecture, product direction,
						and creative work. The repetitive work — reviews, deploys, docs,
						tests — runs automatically.
					</p>
				</Section>

				{/* ========== TEAM AUGMENTATION ========== */}
				<Section id="augmentation">
					<SectionHeader
						num="02"
						sub="Your human team handles architecture and product decisions. AI agents handle the repetitive work."
					>
						AI Fills the Gaps
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								HUMAN FOCUS
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Architecture decisions, product direction, customer
								conversations, hiring, fundraising, and creative
								problem-solving. The work where human judgment is
								irreplaceable.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								AI HANDLES
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Code review on every PR, deployment pipeline management,
								documentation generation, test writing, dependency updates,
								security scanning, SEO content, and release notes.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — startup team augmentation">
							{`agents:
  riley:
    name: Riley
    role: Code Reviewer & Security Auditor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [code-review, security-audit, performance]

  ops:
    name: Ops
    role: DevOps & Deployment
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [ci-cd, docker, monitoring]

  max:
    name: Max
    role: Junior Developer & Test Writer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search]
    skills: [typescript, testing, documentation]

  morgan:
    name: Morgan
    role: Technical Writer
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search]
    skills: [technical-writing, changelog, release-notes]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== HUMAN GATES ========== */}
				<Section id="human-gates">
					<SectionHeader
						num="03"
						sub="Mix human and AI reviewers — require both Riley's automated review and a human code owner's approval."
					>
						Human Gates. Full Control.
					</SectionHeader>

					<div className="space-y-3 max-w-[640px]">
						{[
							{ gate: 'Merge Approval', desc: 'Both Riley and a human code owner must approve before merge proceeds' },
							{ gate: 'Production Deploy', desc: 'Staging verification passes, then you approve the production release' },
							{ gate: 'Architecture Changes', desc: 'Any structural change flagged for human review before implementation' },
							{ gate: 'Security Findings', desc: 'Critical security issues block the pipeline until human review' },
						].map((item) => (
							<div
								key={item.gate}
								className="bg-lp-card border border-lp-border p-4 flex flex-col sm:flex-row sm:items-start gap-3"
							>
								<span className="font-mono text-xs text-[#B700FF] flex-shrink-0 sm:w-40">
									{item.gate}
								</span>
								<span className="font-sans text-xs text-lp-muted">
									{item.desc}
								</span>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Parallel task execution means Max works on a feature while Morgan
						writes the documentation. Riley reviews code while Ops prepares
						the deployment pipeline. Tasks do not block each other unless they
						have explicit dependencies.
					</p>
				</Section>

				{/* ========== MULTI-MODEL VALIDATION ========== */}
				<Section id="multi-model">
					<SectionHeader
						num="04"
						sub="Choose the right model for each agent role. Mix providers per task type."
					>
						Multi-Model Validation
					</SectionHeader>

					<div className="max-w-[640px]">
						<CodeBlock title="company.yaml — multi-model setup">
							{`agents:
  # Claude for code — best at reading and writing code
  riley:
    provider: anthropic
    model: claude-sonnet-4-20250514

  # Claude Agent SDK for filesystem tasks
  max:
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514

  # GPT for documentation — strong at natural language
  morgan:
    provider: codex-sdk
    model: gpt-4o

  # Mix models per role for validation
  # Riley reviews Max's code — different model catches different bugs
  # Morgan reviews Riley's comments — different perspective on clarity`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						When you onboard a new human team member, the same knowledge base
						accelerates their ramp-up. Documentation written for AI agents
						turns out to be excellent documentation for humans too.
					</p>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="terminal — onboard AI like a new hire">
							{`autopilot knowledge add ./docs/architecture.md
autopilot knowledge add ./docs/coding-standards.md
autopilot knowledge add ./docs/api-reference.md
autopilot knowledge add ./docs/deploy-process.md`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Augment Your Team Today
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-6 max-w-md mx-auto">
						Free. Open source. Works alongside your existing tools.
					</p>
					<div className="max-w-md mx-auto mb-8">
						<CodeBlock title="terminal">
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
