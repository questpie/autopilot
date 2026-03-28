import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/use-cases/agency')({
	head: () => ({
		meta: [
			{ title: 'Marketing Agency — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Marketing agents.yaml + content workflow. Brief to published in one pipeline. Per-client knowledge isolation.',
			},
			{ property: 'og:title', content: 'Marketing Agency — QuestPie Autopilot' },
			{
				property: 'og:description',
				content: 'Marketing agents.yaml + content workflow. Brief to published in one pipeline.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/use-cases/agency' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/use-cases/agency' }],
	}),
	component: AgencyPage,
})

function AgencyPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">USE CASE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Marketing Agency
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						4 specialized agents. 1 content workflow. Per-client knowledge
						isolation — Client A's brand voice never bleeds into Client B.
					</p>
				</section>

				{/* AGENTS CONFIG */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">agents.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="company.yaml — marketing agency">
							{`agents:
  strategist:
    role: Content Strategist
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, search_web, browse]
    skills: [seo, audience-research, keyword-analysis]

  copywriter:
    role: Content Writer
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web]
    skills: [copywriting, brand-voice, email-marketing]
    fs_scope:
      read: ["./clients/\${client}/**", "./templates/**"]
      write: ["./output/\${client}/**"]

  seo-lead:
    role: SEO & Editorial Review
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [seo-audit, editing, brand-compliance]

  designer:
    role: Visual Content Creator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [social-media, graphics, landing-pages]`}
						</CodeBlock>
					</div>
					<p className="font-mono text-xs text-lp-muted mt-4 max-w-[560px]">
						fs_scope isolates client data. The copywriter working on Client A
						cannot read Client B's brand guidelines.
					</p>
				</section>

				{/* WORKFLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">marketing.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="workflows/marketing.yaml">
							{`workflow: marketing
steps:
  - name: brief
    agent: strategist
    action: decompose_client_brief
    inputs: [client_id, brief_doc]
    outputs: [content_plan, keywords, audience]

  - name: research
    agent: strategist
    action: competitor_analysis
    inputs: [keywords, audience]

  - name: draft
    agent: copywriter
    action: write_content
    inputs: [content_plan, brand_voice]
    outputs: [draft]

  - name: seo_review
    agent: seo-lead
    action: audit_and_edit
    inputs: [draft, keywords]
    outputs: [reviewed_draft, seo_score]

  - name: human_approve
    type: human_gate
    action: review_and_approve

  - name: visuals
    agent: designer
    action: create_assets
    inputs: [reviewed_draft]

  - name: publish
    agent: strategist
    action: distribute
    inputs: [reviewed_draft, visuals]
    platforms: [blog, social, email]`}
						</CodeBlock>
					</div>
				</section>

				{/* TERMINAL FLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Full flow</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal">
							{`$ autopilot chat strategist "New blog post for client acme-corp: Q1 product launch"

[strategist] Loading client knowledge: ./clients/acme-corp/
[strategist] Competitor analysis: 3 similar launches found
[strategist] Content plan ready: 1 blog + 3 social + 1 email
[copywriter]  Drafting blog post in ACME brand voice...
[copywriter]  1,200 words. Tone: professional-casual (per brand guide)
[seo-lead]   SEO score: 87/100. Added 2 keyword variations.
[seo-lead]   Approved.

  HUMAN GATE: Review final draft
  $ autopilot approve content draft-acme-q1

[designer]   Social assets created: 3 variants
[strategist] Published: blog, twitter, linkedin, email campaign

# brief -> content -> review -> publish
# 1 human approval. Everything else automated.`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
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
