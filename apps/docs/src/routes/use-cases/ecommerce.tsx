import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/use-cases/ecommerce')({
	head: () => ({
		meta: [
			{ title: 'E-commerce — Automated Listings, Pricing, Support — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'AI agents manage product listings, monitor pricing, handle customer support, and optimize inventory. From catalog to checkout.',
			},
			{
				property: 'og:title',
				content: 'E-commerce — Automated Listings, Pricing, Support — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'AI agents manage product listings, monitor pricing, handle customer support, and optimize inventory. From catalog to checkout.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/use-cases/ecommerce',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'E-commerce — Automated Listings, Pricing, Support — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/use-cases/ecommerce',
			},
		],
	}),
	component: UseCaseEcommercePage,
})

function UseCaseEcommercePage() {
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
						E-commerce.
						<br />
						Automated Listings,
						<br />
						Pricing, Support.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						AI agents manage product listings, monitor pricing, handle customer
						support, and optimize inventory. From catalog to checkout.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Automated product listing creation turns raw supplier data into
						formatted, SEO-optimized listings with consistent brand voice.
						Competitive pricing monitoring checks daily and queues adjustment
						recommendations for your approval. Customer support triage reads
						incoming inquiries and prepares draft responses before your team
						opens the email.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try the E-commerce Template
						</a>
					</div>
				</section>

				{/* ========== BEFORE / AFTER ========== */}
				<Section id="before-after">
					<SectionHeader
						num="01"
						sub="Stop processing listings by hand. Start approving AI-prepared work."
					>
						From Manual to Automatic
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-red-400 mb-3">
								BEFORE AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Product listings created one by one from spreadsheets</li>
								<li>Pricing checked against competitors when you remember</li>
								<li>Customer emails pile up — response time in days</li>
								<li>Inventory surprises when products run out</li>
								<li>Description quality varies wildly by writer</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								AFTER AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Bulk listings generated with consistent formatting</li>
								<li>Pricing monitored daily, adjustments queued for approval</li>
								<li>Customer inquiries triaged in minutes, drafts ready</li>
								<li>Inventory monitored with automatic reorder alerts</li>
								<li>Every description follows brand voice from knowledge</li>
							</ul>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						The shift is from producing work to reviewing work. You approve
						listings instead of writing them. You approve pricing changes
						instead of researching them. You review draft responses instead
						of composing them from scratch.
					</p>
				</Section>

				{/* ========== PRODUCT AGENTS ========== */}
				<Section id="agents">
					<SectionHeader
						num="02"
						sub="Reconfigure agents for e-commerce: catalog, pricing, support, and fulfillment."
					>
						Your AI Operations Team
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								CEO
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Routes incoming work. New products to catalog, complaints to
								support, pricing alerts to the analyst. One agent coordinates
								the entire operation.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Product Manager (Sam)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates and optimizes product listings. Writes descriptions
								that follow brand voice, manages categories, ensures quality.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Pricing Analyst (Alex)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Monitors competitor pricing using browse and search_web tools.
								Calculates margins, identifies opportunities, queues
								recommendations with supporting data.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Support Agent (Morgan)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Drafts customer responses, triages issues by category and
								urgency, escalates complex cases for human handling.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Inventory Manager (Ops)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Monitors stock levels, triggers reorder alerts at configured
								thresholds, tracks fulfillment status.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Content Creator (Jordan)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates product photography briefs, social media promotional
								posts, and seasonal campaign materials.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Developer (Max)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Maintains the store frontend, builds custom integrations
								between platforms, fixes bugs reported by customers.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								QA (Riley)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Reviews product listings for accuracy, validates pricing
								calculations, checks content quality before publication.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — e-commerce agents">
							{`agents:
  ceo:
    name: CEO
    role: Operations Coordinator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http, search_web, browse]

  sam:
    name: Sam
    role: Product Manager
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web]
    skills: [product-listing, seo, catalog-management]

  alex:
    name: Alex
    role: Pricing Analyst
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web, browse]
    skills: [pricing, market-analysis, margins]

  morgan:
    name: Morgan
    role: Customer Support Lead
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [customer-service, triage, escalation]

  ops:
    name: Ops
    role: Inventory & Fulfillment Manager
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [inventory, fulfillment, logistics]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== SUPPORT WORKFLOW ========== */}
				<Section id="workflow">
					<SectionHeader
						num="03"
						sub="New product workflow: import data, generate listing, review, publish."
					>
						Supplier to Storefront. Automated.
					</SectionHeader>

					<div className="space-y-3 max-w-[640px]">
						{[
							{ step: '01', agent: 'CEO', action: 'Import supplier data from CSV, API feed, or manual upload' },
							{ step: '02', agent: 'Sam', action: 'Generate listings with descriptions, specs, and categories' },
							{ step: '03', agent: 'Riley', action: 'Review listings for accuracy, completeness, brand voice' },
							{ step: '04', agent: 'YOU', action: 'Approve the listings — HUMAN GATE' },
							{ step: '05', agent: 'Max', action: 'Publish to your store platform' },
							{ step: '06', agent: 'Alex', action: 'Set initial pricing with margin targets' },
							{ step: '07', agent: 'Jordan', action: 'Generate social media promotional posts' },
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
						From raw supplier data to published listing with promotional
						materials in one automated pipeline. You approve once, the rest
						happens automatically.
					</p>
				</Section>

				{/* ========== KNOWLEDGE BASE ========== */}
				<Section id="knowledge">
					<SectionHeader
						num="04"
						sub="Upload product guidelines, pricing rules, and support scripts. Agents follow your standards."
					>
						Teach Your Store's Language
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Product Templates
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Description templates define structure and tone. Brand voice
								guidelines ensure consistency across thousands of listings.
								Category taxonomy and attribute requirements keep structure
								clean.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Pricing Rules
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Encode your margin targets, competitor response thresholds,
								and seasonal adjustment policies. Alex follows these rules
								for every pricing recommendation.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Support Scripts
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Response templates for common inquiries and escalation
								procedures for complex issues. Morgan drafts responses
								following your approved scripts.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Inventory Thresholds
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Reorder points, minimum stock levels, and supplier lead times.
								Ops monitors against these thresholds and alerts before
								stockouts.
							</p>
						</div>
					</div>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="company.yaml — e-commerce knowledge">
							{`knowledge:
  - path: ./catalog/product-templates.yaml
  - path: ./catalog/brand-voice.md
  - path: ./pricing/margin-rules.yaml
  - path: ./pricing/competitor-thresholds.yaml
  - path: ./support/response-templates.md
  - path: ./support/escalation-procedures.md
  - path: ./inventory/reorder-points.yaml`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Automate Your Store Operations
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-6 max-w-md mx-auto">
						Free. Open source. Running in 5 minutes.
					</p>
					<div className="max-w-md mx-auto mb-8">
						<CodeBlock title="terminal">
							{`bun add -g @questpie/autopilot
autopilot init my-store
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
