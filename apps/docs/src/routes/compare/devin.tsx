import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/compare/devin')({
	head: () => ({
		meta: [
			{ title: 'QuestPie Autopilot vs Devin — Full Company vs Single Coder' },
			{
				name: 'description',
				content:
					'Devin writes code. Autopilot runs your company. Configurable multi-agent team vs single coder. Strategy, marketing, DevOps, design — not just development.',
			},
			{
				property: 'og:title',
				content: 'QuestPie Autopilot vs Devin — Full Company vs Single Coder',
			},
			{
				property: 'og:description',
				content:
					'Devin writes code. Autopilot runs your company. Configurable multi-agent team vs single coder. Strategy, marketing, DevOps, design — not just development.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/compare/devin',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'QuestPie Autopilot vs Devin — Full Company vs Single Coder',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/compare/devin',
			},
		],
	}),
	component: CompareDevinPage,
})

function CompareDevinPage() {
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
						Full Company vs Single Coder
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Devin writes code. Autopilot runs your company. A configurable
						multi-agent team vs a single coder. Strategy, marketing, DevOps,
						design &mdash; not just development.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Devin is an excellent AI coding agent. It excels at writing
						functions, fixing bugs, and building features. For pure software
						development tasks, Devin is strong.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Autopilot covers every role you define in YAML: strategy, planning,
						development, code review, DevOps, marketing, design, and
						orchestration. Devin is cloud-only and proprietary. Autopilot is
						self-hosted, open source, and MIT licensed. Your code never leaves
						your machine.
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
						sub="Different tools for different problems."
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
										Devin
									</th>
								</tr>
							</thead>
							<tbody>
								{[
									['Scope', 'Full company (configurable roles)', 'Coding only'],
									['Agents', 'YAML-configurable team', '1 coding agent'],
									['Code review', 'Built-in (Riley agent)', 'Not included'],
									['DevOps', 'Built-in (Ops agent)', 'Not included'],
									['Marketing', 'Built-in (Morgan agent)', 'Not included'],
									['Design', 'Built-in (Jordan agent)', 'Not included'],
									['Dashboard', '26 pages, real-time', 'Web IDE'],
									['CLI', '60+ commands', 'None'],
									['Self-hosted', 'Yes', 'No (cloud only)'],
									['Open source', 'MIT', 'Proprietary'],
									['Price', 'Free (self-host)', '~$500/mo'],
									['Data sovereignty', 'Full (your servers)', "Cloud (Devin's servers)"],
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
						sub="Devin writes code. Who reviews it? Who deploys it? Who markets it?"
					>
						Full Team vs 1 Coder
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Multi-Role Coverage
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot covers the full lifecycle. Sam defines the strategy.
								Alex creates the plan. Max writes the code. Riley reviews it. You
								approve the merge. Ops deploys. Morgan writes the blog post.
								Jordan creates the landing page. Devin handles the implementation
								step &mdash; Autopilot handles all of them.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Self-Hosted & Open Source
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot runs as a single Bun process on your machine. Your code
								stays in your filesystem. AI model calls go to the provider API,
								but your source files never leave your server. MIT license means
								you audit the code to verify this claim. Devin is cloud-only
								&mdash; your source code is uploaded to their servers.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 md:col-span-2">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Price
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Devin costs approximately $500 per month &mdash; $6,000 per year
								for a single coding agent. Autopilot self-hosted costs $0 per
								month. You bring your own API keys and pay your provider directly.
								Autopilot cloud hosting starts at EUR 49 per month. The cost
								difference is significant: every dollar saved on platform cost is
								a dollar available for AI API usage.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== WHEN TO CHOOSE ========== */}
				<Section id="choose">
					<SectionHeader
						num="03"
						sub="Both are good tools. Here is when each makes sense."
					>
						Honest Guidance
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Devin if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									You only need a coding agent and do not need strategy,
									marketing, design, or DevOps roles
								</li>
								<li>
									You prefer a cloud-hosted solution where someone else manages
									infrastructure
								</li>
								<li>Your codebase has no data sovereignty requirements</li>
								<li>Budget is not a primary constraint</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Autopilot if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									You need a full company operating system, not just a coder
								</li>
								<li>
									You want self-hosted deployment with complete data sovereignty
								</li>
								<li>
									You are a solo developer or small team that needs every role
									covered
								</li>
								<li>You want open source with MIT license and full source access</li>
							</ul>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Run Your Whole Company. Not Just Code.
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						Free. Open source. Configurable AI team. 5 minutes to start.
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
