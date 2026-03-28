import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/compare/dust')({
	head: () => ({
		meta: [
			{ title: 'Autopilot vs Dust — QuestPie Autopilot' },
			{
				name: 'description',
				content: 'Open source vs enterprise-only. Same capabilities. $0 vs $500/mo.',
			},
			{ property: 'og:title', content: 'Autopilot vs Dust — QuestPie Autopilot' },
			{ property: 'og:description', content: 'Open source vs enterprise-only. Feature comparison.' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/compare/dust' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/compare/dust' }],
	}),
	component: DustPage,
})

function DustPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">COMPARE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Autopilot vs Dust
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						Dust is a strong enterprise platform. Well-designed, well-funded.
						Starts at $500/mo. Autopilot is MIT licensed, self-hosted, free.
						Similar multi-agent capabilities.
					</p>
				</section>

				{/* COMPARISON TABLE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="diff autopilot dust">
							{`FEATURE              AUTOPILOT             DUST
─────────────────────────────────────────────────────────
multi-agent          YAML-configurable     multi-agent
dashboard            26 pages, real-time   chat-style UI
CLI                  60+ commands          none
workflows            YAML state machines   custom workflows
self-hosted          yes (single process)  no (cloud only)
open source          MIT                   proprietary
security             14 layers built-in    enterprise (cloud)
data sovereignty     full (your servers)   cloud (their servers)
price (self-host)    free                  not available
price (cloud)        EUR 49/mo             $500+/mo
setup                5 minutes             onboarding process`}
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
							<p className="font-mono text-sm text-white mb-1">$0 vs $500/mo</p>
							<p className="font-mono text-xs text-lp-muted">
								Dust: $6,000+/year. Autopilot cloud: EUR 588/year. Autopilot
								self-hosted: $0. BYOK. Every dollar saved on platform = a dollar
								for AI API usage.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Data sovereignty</p>
							<p className="font-mono text-xs text-lp-muted">
								Dust is cloud-only. Your data lives on their servers. Autopilot
								runs on your server, behind your firewall. No data transits
								through QuestPie. GDPR straightforward when data never leaves
								your control.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">MIT vs proprietary</p>
							<p className="font-mono text-xs text-lp-muted">
								No vendor lock-in, no surprise pricing, no discontinuation risk.
								If QuestPie disappears, you still have the complete product
								running on your infra. Dust is proprietary — you depend on their
								roadmap.
							</p>
						</div>
					</div>
				</section>

				{/* CHOOSE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Choose them if</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="when-to-use.yaml">
							{`choose_dust:
  - you want fully managed cloud, zero infra management
  - you prefer not to self-host, willing to pay for convenience
  - you need Dust's specific enterprise integrations
  - budget allows $500+/mo and cost is not a concern

choose_autopilot:
  - you want self-hosted with full data sovereignty
  - you need open source with MIT license, no vendor lock-in
  - you want to pay 10x less for similar capabilities
  - you are in a regulated industry requiring on-premise`}
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
