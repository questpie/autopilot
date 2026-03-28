import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/compare/n8n')({
	head: () => ({
		meta: [
			{
				title:
					'QuestPie Autopilot vs n8n — AI Reasoning vs Rule-Based Flows',
			},
			{
				name: 'description',
				content:
					'n8n connects APIs with rules. Autopilot orchestrates AI agents that think. When you need intelligence, not just integration.',
			},
			{
				property: 'og:title',
				content:
					'QuestPie Autopilot vs n8n — AI Reasoning vs Rule-Based Flows',
			},
			{
				property: 'og:description',
				content:
					'n8n connects APIs with rules. Autopilot orchestrates AI agents that think. When you need intelligence, not just integration.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/compare/n8n',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content:
					'QuestPie Autopilot vs n8n — AI Reasoning vs Rule-Based Flows',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/compare/n8n',
			},
		],
	}),
	component: CompareN8nPage,
})

function CompareN8nPage() {
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
						AI Reasoning vs Rule-Based Flows
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						n8n connects APIs with rules. Autopilot orchestrates AI agents that
						think. When you need intelligence, not just integration.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						n8n and Zapier excel at connecting APIs with triggers and rules.
						&ldquo;If this, then that.&rdquo; For predictable, structured data
						flowing between known services, they are proven and reliable.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Autopilot agents use AI reasoning to make decisions, handle
						ambiguity, and adapt to new situations. When the input is messy, the
						requirements are vague, or the process needs judgment &mdash; agents
						reason through it instead of following a static flow that breaks on
						unexpected input.
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
						sub="Automation vs Intelligence — different paradigms."
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
										n8n / Zapier
									</th>
								</tr>
							</thead>
							<tbody>
								{[
									['Paradigm', 'AI agents with reasoning', 'Rule-based triggers and actions'],
									['Decision making', 'AI reasoning per task', 'Fixed rules and conditions'],
									['Adaptability', 'Handles ambiguity and new situations', 'Breaks on unexpected inputs'],
									['Agents', 'YAML-configurable with memory', 'None'],
									['Dashboard', '26 pages, real-time', 'Flow editor'],
									['CLI', '60+ commands', 'None (n8n has basic CLI)'],
									['Integrations', 'HTTP tool + browse (any API)', '400+ native integrations'],
									['Self-hosted', 'Yes (single process)', 'Yes (complex setup for n8n)'],
									['Open source', 'MIT', 'Partial (sustainable use license)'],
									['Price', 'Free (self-host)', 'Free tier / $20+/mo'],
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
						sub="When the input is ambiguous, rules break. Agents adapt."
					>
						Agents Think. Rules Don't.
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Reasoning vs Rules
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								An n8n flow checks: &ldquo;If email subject contains
								'invoice', forward to accounting.&rdquo; An email arrives with
								subject &ldquo;Q3 financial documents for review.&rdquo; The
								rule does not match. Autopilot's CEO agent reads the email,
								understands it is financial documentation, and routes it
								correctly on the first attempt.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Integrations
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								n8n has 400+ native connectors &mdash; pre-built UI for each
								service. Autopilot takes a different approach: the{' '}
								<code className="text-lp-purple">http</code> tool calls any API
								endpoint, and the{' '}
								<code className="text-lp-purple">browse</code> tool reads any web
								page. For your first 50 integrations, n8n saves time. For custom
								APIs, Autopilot's flexibility means you are never waiting for a
								connector.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 md:col-span-2">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Memory and Learning
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot agents build persistent memory across sessions. When
								Morgan writes blog posts for 6 months, she remembers your brand
								voice and preferred structure. n8n flows are stateless &mdash;
								same input, same output, every time, forever. For processes that
								evolve, learning matters. Agents that get better at their job over
								time produce compounding value that stateless flows cannot match.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== WHEN TO CHOOSE ========== */}
				<Section id="choose">
					<SectionHeader
						num="03"
						sub="Rule-based automation is proven. For the right problems, it is the correct choice."
					>
						Honest Guidance
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose n8n / Zapier if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									Your workflows are predictable and rule-based with structured
									inputs and defined outputs
								</li>
								<li>
									You need 400+ native integrations without building connectors
								</li>
								<li>
									You prefer visual flow editors for building automations
								</li>
								<li>
									Your use case is simple trigger-action automation &mdash;
									webhook received, data transformed, API called
								</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Autopilot if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									Your work requires reasoning and judgment that cannot be
									expressed as if/then rules
								</li>
								<li>You need AI agents that learn and adapt over time</li>
								<li>
									You want a full company operating system, not just an
									automation platform
								</li>
								<li>
									You need multi-agent coordination with human approval gates at
									decision points
								</li>
							</ul>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						When You Need Intelligence, Not Just Automation
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						Free. Open source. AI agents that reason.
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
