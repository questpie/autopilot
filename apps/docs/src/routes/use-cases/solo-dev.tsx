import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/use-cases/solo-dev')({
	head: () => ({
		meta: [
			{ title: 'Solo Dev Shop — One Founder, Full Team — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Run a complete development company with AI agents configured in YAML. From strategy to deployment. Code review, DevOps, marketing — all automated.',
			},
			{
				property: 'og:title',
				content: 'Solo Dev Shop — One Founder, Full Team — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Run a complete development company with AI agents configured in YAML. From strategy to deployment. Code review, DevOps, marketing — all automated.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/use-cases/solo-dev',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Solo Dev Shop — One Founder, Full Team — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/use-cases/solo-dev',
			},
		],
	}),
	component: UseCaseSoloDevPage,
})

function UseCaseSoloDevPage() {
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
						Solo Dev Shop.
						<br />
						One Founder, Full Team.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Run a complete development company with AI agents defined in YAML.
						From strategy to deployment — with code review, DevOps, and
						marketing you actually never had. Customize the default agents or
						build your own team from scratch.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Stop wearing every hat. Let agents own the roles you cannot fill.
						Riley reviews every PR — no more shipping bugs to production alone.
						Ops handles deployments with human approval gates. Morgan writes
						blog posts every week — marketing actually happens.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						This is the default template. Dogfooded daily at QuestPie s.r.o.
						Every feature on this page was built using this exact workflow.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try the Solo Dev Template
						</a>
					</div>
				</section>

				{/* ========== BEFORE / AFTER ========== */}
				<Section id="before-after">
					<SectionHeader
						num="01"
						sub="Stop doing everything. Start approving results."
					>
						Your Week, Transformed
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-red-400 mb-3">
								BEFORE AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Monday: write code all day, skip tests</li>
								<li>Tuesday: deploy manually, break staging, 3 hours fixing</li>
								<li>Wednesday: plan that blog post — it never happens</li>
								<li>Thursday: no roadmap, panic-plan based on urgency</li>
								<li>Friday: push to prod, zero code review, cross fingers</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								AFTER AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Monday: review Max's PR, approve Riley's feedback</li>
								<li>Tuesday: approve staging deploy, verify tests pass</li>
								<li>Wednesday: read Morgan's published blog post</li>
								<li>Thursday: review Alex's sprint plan, approve 3 tasks</li>
								<li>Friday: approve production deploy, close laptop, go outside</li>
							</ul>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Your role transforms from doing everything to approving results.
						The quality of every output improves because specialists handle
						each step. You make decisions. Agents execute.
					</p>
				</Section>

				{/* ========== AGENT TEAM ========== */}
				<Section id="agents">
					<SectionHeader
						num="02"
						sub="Each agent owns a role you cannot hire for. Together, they run your development company."
					>
						Every Role Covered
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								CEO
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Decomposes your intent into a plan. You say "build a landing
								page" and CEO creates tasks, assigns each to the right agent,
								and monitors completion.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Sam (Strategist)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes strategy documents you never have time to write. Market
								analysis, competitive positioning, quarterly priorities.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Alex (Planner)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates task trees with dependencies and estimates. Your
								backlog is always organized and ready for the next sprint.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Max (Developer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes code, runs tests, creates PRs. Full filesystem access
								through the SDK. Creates branches, follows your conventions.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Riley (Reviewer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Audits every line of code. Checks for bugs, security
								vulnerabilities, performance regressions. Bad code gets blocked.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Ops (DevOps)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Handles deployments and infrastructure. CI/CD pipelines,
								staging verification, production health checks.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Morgan (Marketer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Blog posts, social media copy, SEO articles, email campaigns.
								Marketing happens every week because Morgan does not get pulled
								into code reviews.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Jordan (Designer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								UI components, landing pages, design systems. Your product
								looks like a 20-person team built it.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — solo dev agents">
							{`agents:
  ceo:
    name: CEO
    role: Company Orchestrator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http, search_web, browse]

  max:
    name: Max
    role: Senior Full-Stack Developer
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http]
    skills: [typescript, react, bun, testing]

  riley:
    name: Riley
    role: Code Reviewer & Security Auditor
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]

  ops:
    name: Ops
    role: DevOps & Infrastructure
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]

  morgan:
    name: Morgan
    role: Content & Marketing
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web, browse]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== DEVELOPMENT WORKFLOW ========== */}
				<Section id="workflow">
					<SectionHeader
						num="03"
						sub="The 12-step development workflow handles the entire lifecycle. You approve at two gates."
					>
						Strategy to Deployment. Automated.
					</SectionHeader>

					<div className="max-w-[640px]">
						<CodeBlock title="terminal">
							{`autopilot chat ceo "Build a pricing page with 3 tiers"`}
						</CodeBlock>
					</div>

					<div className="mt-6 space-y-3 max-w-[640px]">
						{[
							{ step: '01', agent: 'CEO', action: 'Analyzes your request, decomposes into tasks' },
							{ step: '02', agent: 'Sam', action: 'Defines the strategic approach' },
							{ step: '03', agent: 'Alex', action: 'Creates the task tree with dependencies' },
							{ step: '04', agent: 'Max', action: 'Implements the code, writes tests' },
							{ step: '05', agent: 'Riley', action: 'Reviews for bugs and security issues' },
							{ step: '06', agent: 'YOU', action: 'Approve the merge — HUMAN GATE' },
							{ step: '07', agent: 'Ops', action: 'Deploys to staging' },
							{ step: '08', agent: 'Ops', action: 'Runs automated verification' },
							{ step: '09', agent: 'YOU', action: 'Approve production — HUMAN GATE' },
							{ step: '10', agent: 'Ops', action: 'Deploys to production' },
							{ step: '11', agent: 'Ops', action: 'Health checks pass' },
							{ step: '12', agent: 'Morgan', action: 'Writes release notes, blog post' },
						].map((item) => (
							<div
								key={item.step}
								className="flex items-start gap-4 bg-lp-card border border-lp-border p-4"
							>
								<span className="font-mono text-xs text-[#B700FF] flex-shrink-0 w-6">
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

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Total human effort: 2 approvals, approximately 5 minutes. Total
						agent effort: 10 automated steps, approximately 30 minutes. From
						idea to deployed feature by typing one sentence and clicking two
						buttons.
					</p>
				</Section>

				{/* ========== KNOWLEDGE SETUP ========== */}
				<Section id="knowledge">
					<SectionHeader
						num="04"
						sub="Upload your codebase conventions, API docs, and brand guidelines. Agents learn and remember."
					>
						Teach Once. Remember Forever.
					</SectionHeader>

					<div className="max-w-[640px]">
						<CodeBlock title="terminal — upload knowledge">
							{`# Upload your conventions
autopilot knowledge add ./docs/coding-standards.md
autopilot knowledge add ./docs/deploy-process.md
autopilot knowledge add ./docs/api-docs.md`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Persistent memory means Max remembers your branch naming scheme
						after the first session. He remembers your test patterns after the
						second. By the fifth session, Max works as if he has been on your
						team for months.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agents search knowledge before every task — they follow your
						conventions because they read your documentation first. Memory
						survives across sessions. Every agent builds its own understanding
						of your project.
					</p>
				</Section>

				{/* ========== REAL RESULTS ========== */}
				<Section id="results">
					<SectionHeader
						num="05"
						sub="This is not a demo. Autopilot runs the company that builds Autopilot."
					>
						Dogfooded Daily at QuestPie
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Built With Itself
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								QuestPie s.r.o. uses Autopilot daily for its own development.
								The Solo Dev template is the same configuration used internally.
								Every feature on this landing page was built using this workflow.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Real Workflow
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Code written by Max, reviewed by Riley, deployed by Ops,
								marketed by Morgan. The workflow you are evaluating is the
								workflow that built the product you are evaluating.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Stop Doing Everything Alone
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-6 max-w-md mx-auto">
						Install in 60 seconds. Free. Open source. MIT license.
					</p>
					<div className="max-w-md mx-auto mb-8">
						<CodeBlock title="terminal">
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
