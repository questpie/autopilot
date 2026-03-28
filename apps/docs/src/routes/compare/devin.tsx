import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/compare/devin')({
	head: () => ({
		meta: [
			{ title: 'Autopilot vs Devin — QuestPie Autopilot' },
			{
				name: 'description',
				content: 'Full company vs single coder. Devin writes code. Autopilot runs your company.',
			},
			{ property: 'og:title', content: 'Autopilot vs Devin — QuestPie Autopilot' },
			{ property: 'og:description', content: 'Full company vs single coder. Feature comparison.' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/compare/devin' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/compare/devin' }],
	}),
	component: DevinPage,
})

function DevinPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">COMPARE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Autopilot vs Devin
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						Devin is an excellent coding agent. It writes code. But who
						reviews it? Who deploys it? Who writes the release notes?
						Autopilot covers every role you define in YAML.
					</p>
				</section>

				{/* COMPARISON TABLE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="diff autopilot devin">
							{`FEATURE              AUTOPILOT             DEVIN
─────────────────────────────────────────────────────────
scope                full company           coding only
agents               YAML-configurable      1 coding agent
code review          built-in (riley)       not included
devops               built-in (ops)         not included
marketing            built-in (morgan)      not included
dashboard            26 pages, real-time    web IDE
CLI                  60+ commands           none
self-hosted          yes                    no (cloud only)
open source          MIT                    proprietary
price                free (self-host)       ~$500/mo
data sovereignty     full (your servers)    cloud (their servers)`}
						</CodeBlock>
					</div>
					<p className="font-mono text-[11px] text-lp-ghost mt-3">
						Based on public docs, March 2026. Verify on each product's site.
					</p>
				</section>

				{/* KEY DIFFERENCES */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">3 key differences</h2>
					<div className="space-y-4 max-w-[720px]">
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Full team vs 1 coder</p>
							<p className="font-mono text-xs text-lp-muted">
								Devin handles the implementation step. Autopilot handles strategy,
								planning, implementation, review, deployment, and marketing. All
								configurable.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Self-hosted + open source</p>
							<p className="font-mono text-xs text-lp-muted">
								Your code stays on your machine. AI calls go to provider APIs but
								source files never leave your server. MIT license. Devin is
								cloud-only — source code uploaded to their servers.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">$0 vs $500/mo</p>
							<p className="font-mono text-xs text-lp-muted">
								Autopilot self-hosted: $0. BYOK. Devin: ~$500/mo ($6,000/year)
								for a single coding agent. Every dollar saved on platform cost is
								a dollar available for AI API usage.
							</p>
						</div>
					</div>
				</section>

				{/* CHOOSE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Choose them if</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="when-to-use.yaml">
							{`choose_devin:
  - you only need a coding agent, not strategy/marketing/devops
  - you prefer cloud-hosted, someone else manages infra
  - no data sovereignty requirements
  - budget is not a constraint

choose_autopilot:
  - you need a full company OS, not just a coder
  - you want self-hosted with complete data sovereignty
  - you are solo/small team that needs every role covered
  - you want open source with MIT license`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
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
