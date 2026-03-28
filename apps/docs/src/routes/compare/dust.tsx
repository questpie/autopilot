import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/compare/dust')({
	head: () => ({
		meta: [
			{
				title:
					'QuestPie Autopilot vs Dust — Open Source vs Enterprise-Only',
			},
			{
				name: 'description',
				content:
					'Dust starts at $500/mo. Autopilot is MIT licensed and free to self-host. Same capabilities, your data stays yours.',
			},
			{
				property: 'og:title',
				content:
					'QuestPie Autopilot vs Dust — Open Source vs Enterprise-Only',
			},
			{
				property: 'og:description',
				content:
					'Dust starts at $500/mo. Autopilot is MIT licensed and free to self-host. Same capabilities, your data stays yours.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/compare/dust',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content:
					'QuestPie Autopilot vs Dust — Open Source vs Enterprise-Only',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/compare/dust',
			},
		],
	}),
	component: CompareDustPage,
})

function CompareDustPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>COMPARE</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Open Source vs Enterprise-Only
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Dust starts at $500/month. Autopilot is MIT licensed and free to
						self-host. Same multi-agent capabilities. Your data stays yours.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Dust is a strong enterprise AI agent platform. Well-designed,
						well-funded, and capable. For companies with $500+/month budgets who
						prefer fully managed cloud services, Dust is a legitimate option.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Autopilot delivers similar multi-agent capabilities at a fraction of
						the cost. The core difference: open source vs proprietary,
						self-hosted vs cloud-only, $0 vs $500.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try Autopilot Free
						</a>
					</div>
				</section>

				{/* ========== COMPARISON TABLE ========== */}
				<Section id="comparison">
					<SectionHeader
						num="01"
						sub="Enterprise features at open source pricing."
					>
						Feature-by-Feature Comparison
					</SectionHeader>

					<div className="overflow-x-auto lp-scrollbar">
						<table className="w-full border-collapse min-w-[600px]">
							<thead>
								<tr className="border-b border-lp-border">
									<th className="font-mono text-[10px] text-lp-muted tracking-[0.15em] uppercase text-left p-3">
										Feature
									</th>
									<th className="font-mono text-[10px] text-lp-purple tracking-[0.15em] uppercase text-left p-3">
										QuestPie Autopilot
									</th>
									<th className="font-mono text-[10px] text-lp-muted tracking-[0.15em] uppercase text-left p-3">
										Dust
									</th>
								</tr>
							</thead>
							<tbody>
								{[
									['Multi-agent', 'YAML-configurable agents, orchestrated', 'Multi-agent'],
									['Dashboard', '26 pages, real-time', 'Chat-style UI'],
									['CLI', '60+ commands', 'None'],
									['Workflows', 'YAML state machines', 'Custom workflows'],
									['Self-hosted', 'Yes (single process)', 'No (cloud only)'],
									['Open source', 'MIT', 'Proprietary'],
									['Security', '14 layers', 'Enterprise (cloud-managed)'],
									['Data sovereignty', 'Full (your servers)', "Cloud (Dust's servers)"],
									['Price (self-host)', 'Free', 'Not available'],
									['Price (cloud)', 'EUR 49/mo', '$500+/mo'],
									['Setup', '5 minutes', 'Onboarding process'],
								].map(([feature, autopilot, competitor]) => (
									<tr
										key={feature}
										className="border-b border-lp-border/30 hover:bg-lp-surface/50"
									>
										<td className="font-mono text-[11px] text-lp-fg p-3">
											{feature}
										</td>
										<td className="font-sans text-[12px] text-lp-fg p-3 font-medium">
											{autopilot}
										</td>
										<td className="font-sans text-[12px] text-lp-muted p-3">
											{competitor}
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<p className="font-sans text-[11px] text-lp-ghost mt-3 italic">
							Based on public documentation as of March 2026. Verify current
							capabilities on each product's website.
						</p>
					</div>
				</Section>

				{/* ========== KEY DIFFERENCES ========== */}
				<Section id="differences">
					<SectionHeader
						num="02"
						sub="Same capabilities. Open source pricing."
					>
						Price, Data Sovereignty, and Freedom
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Price
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Dust starts at $500/month &mdash; $6,000+ per year. Autopilot
								self-hosted is free. Cloud hosting starts at EUR 49/month. Annual
								cost comparison: Dust at $6,000+, Autopilot cloud at EUR 588,
								Autopilot self-hosted at $0. Every dollar saved is a dollar
								available for AI API usage.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Data Sovereignty
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Dust is cloud-only. Your company data lives on their servers.
								Autopilot is self-hosted by default. Your data lives on your
								server, behind your firewall. No data transits through QuestPie
								servers. MIT license lets you audit the source code. GDPR
								compliance is straightforward when data never leaves your control.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Open Source
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot is MIT licensed. No vendor lock-in, no surprise pricing
								changes, no service discontinuation risk. If QuestPie disappears,
								you still have the complete product running on your
								infrastructure. Dust is proprietary &mdash; you depend on their
								pricing, availability, and roadmap.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== WHEN TO CHOOSE ========== */}
				<Section id="choose">
					<SectionHeader
						num="03"
						sub="Dust is a quality product. Here is when it makes more sense than Autopilot."
					>
						Honest Guidance
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Dust if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									You want a fully managed cloud service with zero
									infrastructure management
								</li>
								<li>
									You prefer not to self-host and are willing to pay for the
									convenience
								</li>
								<li>
									You need Dust's specific enterprise integrations or have an
									existing relationship with their team
								</li>
								<li>
									Your budget allows $500+/month and the cost is not a concern
								</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Autopilot if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									You want self-hosted deployment with full data sovereignty
								</li>
								<li>You need open source with MIT license and no vendor lock-in</li>
								<li>You want to pay 10x less for similar capabilities</li>
								<li>
									You are in a regulated industry that requires on-premise
									deployment
								</li>
							</ul>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Enterprise Capabilities. Open Source Price.
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						Free forever. Self-hosted. MIT license.
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
