import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/compare/crewai')({
	head: () => ({
		meta: [
			{ title: 'QuestPie Autopilot vs CrewAI — Product vs Framework' },
			{
				name: 'description',
				content:
					'CrewAI gives you building blocks. Autopilot gives you a running company. Compare features, setup time, and out-of-box capabilities.',
			},
			{
				property: 'og:title',
				content: 'QuestPie Autopilot vs CrewAI — Product vs Framework',
			},
			{
				property: 'og:description',
				content:
					'CrewAI gives you building blocks. Autopilot gives you a running company. Compare features, setup time, and out-of-box capabilities.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/compare/crewai',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'QuestPie Autopilot vs CrewAI — Product vs Framework',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/compare/crewai',
			},
		],
	}),
	component: CompareCrewAIPage,
})

function CompareCrewAIPage() {
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
						Product vs Framework
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						CrewAI gives you building blocks. Autopilot gives you a running
						company. Compare what you get out of the box.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						CrewAI is an excellent multi-agent framework for developers who want
						to build custom AI systems in Python. It provides the primitives
						&mdash; agent definitions, tool interfaces, task orchestration
						&mdash; and lets you assemble them into whatever you need.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Autopilot is a complete product. Agents, dashboard, CLI, workflows,
						security, notifications &mdash; all included, all configured, all
						running in 5 minutes. The question is not which is better. It is
						whether you want to build or to use.
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
						sub="An honest look at what each platform provides out of the box."
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
										CrewAI
									</th>
								</tr>
							</thead>
							<tbody>
								{[
									['Type', 'Product (ready to run)', 'Framework (build it yourself)'],
									['Language', 'TypeScript / Bun', 'Python'],
									['Agents', 'YAML-configurable, template included', 'Define your own (no defaults)'],
									['Dashboard', '26 pages, real-time', 'None (build your own)'],
									['CLI', '60+ commands', 'Python API'],
									['Workflows', 'YAML state machines, 3 built-in', 'Custom code'],
									['Security', '14 layers, enterprise-grade', 'DIY'],
									['Memory', 'Persistent, structured, per-agent', 'Configurable (manual setup)'],
									['Tools', '7 unified primitives + SDK built-ins', 'Custom tools (build your own)'],
									['Setup time', '5 minutes', 'Hours to days'],
									['License', 'MIT', 'Apache 2.0'],
									['Self-hosted', 'Yes (single process)', 'Yes (your infrastructure)'],
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
						sub="Autopilot is ready to run. CrewAI requires you to build everything around it."
					>
						5 Minutes vs 5 Weeks
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Dashboard & CLI
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot includes a 26-page real-time dashboard with kanban
								boards, multi-channel chat, session replay, and 13 settings
								pages. Plus a kubectl-style CLI with 60+ subcommands. CrewAI has
								no built-in UI or CLI &mdash; you build your own.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Security
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot ships with 14 security layers: 2FA with TOTP, RBAC
								with 4 roles, AES-256-GCM encrypted secrets, SSRF protection, IP
								allowlist, rate limiting, filesystem sandbox per agent, and
								append-only audit logs. CrewAI relies on your implementation.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 md:col-span-2">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Workflows
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot ships 3 built-in workflows as YAML state machines with
								human approval gates. The development workflow handles the full
								lifecycle from strategy through deployment. CrewAI provides
								orchestration primitives that you wire together with custom Python
								code. Both approaches are valid &mdash; CrewAI gives you maximum
								control, Autopilot gives you maximum speed to production.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== WHEN TO CHOOSE ========== */}
				<Section id="choose">
					<SectionHeader
						num="03"
						sub="We respect CrewAI. Here is when it makes more sense than Autopilot."
					>
						Honest Guidance
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose CrewAI if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>You need a Python-native framework with maximum control</li>
								<li>
									You are building a highly custom multi-agent system with
									specialized requirements no product can anticipate
								</li>
								<li>
									You already have your own dashboard, CLI, and deployment
									infrastructure
								</li>
								<li>
									Your team has the Python expertise and engineering time to
									build around a framework
								</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Autopilot if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>You want a working product in 5 minutes</li>
								<li>You need a dashboard and CLI without building them</li>
								<li>
									You need enterprise security out of the box without
									implementing 14 layers yourself
								</li>
								<li>
									You are a solo developer or small team that cannot afford weeks
									of infrastructure work
								</li>
							</ul>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Ready to Try the Product?
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						Free. Open source. Running in 5 minutes.
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
