import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/use-cases/agency')({
	head: () => ({
		meta: [
			{ title: 'Marketing Agency — Scale Output, Not Headcount — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Content pipeline, SEO optimization, campaign management with AI agents. Per-client knowledge, brand voice enforcement, multi-platform publishing.',
			},
			{
				property: 'og:title',
				content: 'Marketing Agency — Scale Output, Not Headcount — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Content pipeline, SEO optimization, campaign management with AI agents. Per-client knowledge, brand voice enforcement, multi-platform publishing.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/use-cases/agency',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Marketing Agency — Scale Output, Not Headcount — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/use-cases/agency',
			},
		],
	}),
	component: UseCaseAgencyPage,
})

function UseCaseAgencyPage() {
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
						Marketing Agency.
						<br />
						Scale Output, Not Headcount.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						AI agents handle content pipeline, SEO, campaign management, and
						per-client knowledge. Your team focuses on strategy and
						relationships.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Per-client knowledge bases keep brand voice and context isolated.
						Client A's tone guide never bleeds into Client B's content. The
						7-step marketing workflow automates from brief to publication with
						human approval before anything goes live.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Multi-platform content adaptation produces blog posts, social copy,
						email campaigns, and newsletters from a single content brief.
						Monthly reporting compiles from agent activity data in minutes, not
						the full day it takes now.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try the Agency Template
						</a>
					</div>
				</section>

				{/* ========== BEFORE / AFTER ========== */}
				<Section id="before-after">
					<SectionHeader
						num="01"
						sub="Stop burning margin on repeatable work."
					>
						Same Revenue. Half the Hours.
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-red-400 mb-3">
								BEFORE AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Client briefs sit in email for days</li>
								<li>Writers start from scratch — no brand voice memory</li>
								<li>SEO research is manual, inconsistent, often skipped</li>
								<li>Same blog post reformatted for 4 platforms by hand</li>
								<li>Monthly reports take a full day to compile</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								AFTER AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Briefs decomposed into content tasks within minutes</li>
								<li>Brand voice loaded from per-client knowledge</li>
								<li>Research agents analyze competitors before drafting</li>
								<li>Content adapted for all platforms in one workflow run</li>
								<li>Monthly reports compile automatically — minutes, not hours</li>
							</ul>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Your margin improves because repeatable production work drops. Your
						team spends time on strategy, client relationships, and creative
						direction. The work that requires human judgment.
					</p>
				</Section>

				{/* ========== MARKETING AGENTS ========== */}
				<Section id="agents">
					<SectionHeader
						num="02"
						sub="Reconfigure the default agents for agency work. Content, SEO, client management."
					>
						Your AI Content Machine
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								CEO
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Receives client briefs, decomposes them into content tasks, and
								assigns to the right agent. One brief becomes a coordinated
								production workflow.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Sam (Strategist)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Defines content strategy per client. Audience research, keyword
								analysis, competitive positioning.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Morgan (Content Lead)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes the work — blog posts, social copy, email campaigns, ad
								copy. Loads client brand voice from the knowledge base.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Alex (Planner)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Manages the content calendar. Tracks deadlines, assigns
								priorities, coordinates timing across client campaigns.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Riley (Editor)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Reviews all content for quality, brand voice compliance, and SEO
								optimization. Catches tone inconsistencies before you see the draft.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Jordan (Designer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates social media graphics, landing page mockups, and
								presentation decks alongside written content.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Max (Developer)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Builds landing pages, email templates, and tracking
								integrations. The technical work that supports campaigns.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Ops (Publisher)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Publishes content to platforms, manages scheduling, and monitors
								performance metrics.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — agency agents">
							{`agents:
  ceo:
    name: CEO
    role: Client Brief Coordinator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http, search_web, browse]

  sam:
    name: Sam
    role: Content Strategist
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web, browse]
    skills: [seo, audience-research, keyword-analysis]

  morgan:
    name: Morgan
    role: Content Writer
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web]
    skills: [copywriting, brand-voice, email-marketing]

  riley:
    name: Riley
    role: Content Editor & SEO Reviewer
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [editing, seo-audit, brand-compliance]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== CAMPAIGN WORKFLOW ========== */}
				<Section id="workflow">
					<SectionHeader
						num="03"
						sub="Automated content pipeline with quality gates and human approval before publication."
					>
						Brief to Published. 7 Steps.
					</SectionHeader>

					<div className="space-y-3 max-w-[640px]">
						{[
							{ step: '01', agent: 'CEO', action: 'Client brief received via dashboard, CLI, or chat' },
							{ step: '02', agent: 'Sam', action: 'Researches topic — competitors, trending content, keywords' },
							{ step: '03', agent: 'Morgan', action: 'Drafts content following brand voice from client knowledge' },
							{ step: '04', agent: 'Riley', action: 'Reviews for quality, SEO optimization, brand consistency' },
							{ step: '05', agent: 'YOU', action: 'Review and approve — or request revision — HUMAN GATE' },
							{ step: '06', agent: 'Jordan', action: 'Creates accompanying visual assets' },
							{ step: '07', agent: 'Ops', action: 'Publishes across configured platforms' },
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
						One human gate at step 5 before publication. Everything before it
						runs autonomously. You review finished work, not work-in-progress.
					</p>
				</Section>

				{/* ========== PER-CLIENT KNOWLEDGE ========== */}
				<Section id="knowledge">
					<SectionHeader
						num="04"
						sub="Upload brand guidelines, tone docs, and past content. Agents write in each client's voice."
					>
						Every Client. Their Own Voice.
					</SectionHeader>

					<div className="max-w-[640px]">
						<CodeBlock title="terminal — per-client knowledge">
							{`# Set up per-client knowledge
autopilot knowledge add ./clients/acme/brand-guide.md
autopilot knowledge add ./clients/acme/tone-examples.md
autopilot knowledge add ./clients/acme/approved-terms.yaml`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Create a knowledge directory per client. Brand guidelines define the
						voice. Tone examples show agents how the client writes. Past content
						provides patterns to follow. Approved terminology and prohibited
						words lists enforce vocabulary rules.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Knowledge is isolated — the agent working on Client A's blog post
						never accesses Client B's brand guidelines. Brand voice stays
						consistent across every piece of content for that client.
					</p>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="company.yaml — client knowledge scoping">
							{`agents:
  morgan:
    name: Morgan
    role: Content Writer
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web]
    fs_scope:
      read: ["./clients/\${client}/**", "./templates/**"]
      write: ["./output/\${client}/**"]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Scale Without Hiring
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-6 max-w-md mx-auto">
						Same team. More clients. Better margins. Free. Open source.
					</p>
					<div className="max-w-md mx-auto mb-8">
						<CodeBlock title="terminal">
							{`bun add -g @questpie/autopilot
autopilot init my-agency
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
