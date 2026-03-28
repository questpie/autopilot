import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/use-cases/ecommerce')({
	head: () => ({
		meta: [
			{ title: 'E-commerce — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Product management, pricing, support, and inventory agents. Supplier data to published listing in one workflow.',
			},
			{ property: 'og:title', content: 'E-commerce — QuestPie Autopilot' },
			{
				property: 'og:description',
				content: 'Product management, pricing, support, and inventory agents in YAML.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/use-cases/ecommerce' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/use-cases/ecommerce' }],
	}),
	component: EcommercePage,
})

function EcommercePage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">USE CASE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						E-commerce
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						4 agents handle product listings, competitive pricing, customer
						support triage, and inventory monitoring. Raw supplier CSV to
						published listing with SEO descriptions — one workflow.
					</p>
				</section>

				{/* AGENTS CONFIG */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">agents.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="company.yaml — e-commerce agents">
							{`agents:
  product-mgr:
    role: Product Manager & Catalog
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web]
    skills: [product-listing, seo, catalog-management]
    fs_scope:
      read: ["./catalog/**", "./templates/**"]
      write: ["./catalog/listings/**"]

  pricing:
    role: Pricing Analyst
    provider: codex-sdk
    model: gpt-4o
    tools: [task, message, search, search_web, browse]
    skills: [pricing, market-analysis, margins]

  support:
    role: Customer Support Triage
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [customer-service, triage, escalation]

  inventory:
    role: Inventory & Fulfillment
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [inventory, fulfillment, reorder-alerts]`}
						</CodeBlock>
					</div>
				</section>

				{/* WORKFLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">product-listing.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="workflows/product-listing.yaml">
							{`workflow: product-listing
steps:
  - name: import
    agent: product-mgr
    action: parse_supplier_data
    inputs: [csv_path, supplier_id]
    outputs: [raw_products]

  - name: enrich
    agent: product-mgr
    action: generate_listings
    inputs: [raw_products, brand_voice, templates]
    outputs: [listings_draft]

  - name: price
    agent: pricing
    action: set_initial_pricing
    inputs: [listings_draft, margin_rules, competitor_data]
    outputs: [priced_listings]

  - name: review
    agent: product-mgr
    action: quality_check
    inputs: [priced_listings]

  - name: human_approve
    type: human_gate
    action: review_listings

  - name: publish
    agent: product-mgr
    action: push_to_storefront
    inputs: [priced_listings]

  - name: monitor
    agent: inventory
    action: set_reorder_thresholds
    inputs: [priced_listings]`}
						</CodeBlock>
					</div>
				</section>

				{/* TERMINAL FLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Full flow</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal">
							{`$ autopilot chat product-mgr "Import new supplier batch: ./data/supplier-q1.csv"

[product-mgr] Parsing CSV: 47 products found
[product-mgr] Generating listings with brand voice...
[product-mgr] 47 SEO descriptions written. Categories assigned.
[pricing]     Competitor scan: 38/47 have market comps
[pricing]     Pricing set: avg margin 34%, range 22-48%
[product-mgr] Quality check: 47/47 pass

  HUMAN GATE: Review 47 listings
  $ autopilot approve listings batch-q1

[product-mgr] Published to storefront: 47 products live
[inventory]   Reorder thresholds set for 47 SKUs

# 47 products: CSV -> listed -> priced -> live
# 1 human approval`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
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
