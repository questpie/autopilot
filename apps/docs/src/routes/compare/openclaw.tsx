import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/compare/openclaw')({
	head: () => ({
		meta: [
			{
				title:
					'QuestPie Autopilot vs OpenClaw — Company OS vs Personal Assistant',
			},
			{
				name: 'description',
				content:
					'OpenClaw is a single personal assistant. Autopilot is a multi-agent company operating system. Configurable roles, workflows, dashboard, security.',
			},
			{
				property: 'og:title',
				content:
					'QuestPie Autopilot vs OpenClaw — Company OS vs Personal Assistant',
			},
			{
				property: 'og:description',
				content:
					'OpenClaw is a single personal assistant. Autopilot is a multi-agent company operating system. Configurable roles, workflows, dashboard, security.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/compare/openclaw',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content:
					'QuestPie Autopilot vs OpenClaw — Company OS vs Personal Assistant',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/compare/openclaw',
			},
		],
	}),
	component: CompareOpenClawPage,
})

function CompareOpenClawPage() {
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
						Company OS vs Personal Assistant
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						OpenClaw is a single personal assistant. Autopilot is a multi-agent
						company operating system. YAML-configurable roles, YAML workflows, a
						26-page dashboard, and 14 security layers.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Personal assistants handle individual tasks on demand. Company
						operating systems run entire business processes autonomously. The
						difference is scope: one agent that helps you versus a configurable
						team of agents that runs your company.
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
						sub="Single agent vs multi-agent company system."
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
										OpenClaw
									</th>
								</tr>
							</thead>
							<tbody>
								{[
									['Architecture', 'Multi-agent (YAML-configurable)', 'Single agent'],
									['Roles', 'Strategy, dev, review, DevOps, marketing, design, planning, orchestration', 'General assistant'],
									['Workflows', 'YAML state machines, 3 built-in', 'Task-based'],
									['Human gates', 'Configurable approval points', 'Manual interaction'],
									['Dashboard', '26 pages, real-time', 'Basic UI'],
									['CLI', '60+ commands', 'Limited'],
									['Agent memory', 'Persistent, structured, per-agent', 'Conversation history'],
									['Security', '14 layers', 'Basic'],
									['Agent coordination', 'Orchestrated multi-agent workflows', 'Single agent'],
									['Self-hosted', 'Yes (single process)', 'Yes'],
									['Open source', 'MIT', 'Open source'],
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
						sub="A single assistant handles whatever you ask. Specialized agents own their domains."
					>
						Multi-Agent vs Single Agent
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Specialized Team
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Give an intent and CEO decomposes it. Sam strategizes. Alex
								plans. Max implements. Riley reviews. You approve the merge. Ops
								deploys. Morgan writes the release notes. The agents know their
								roles, remember past work, and improve over time. &ldquo;Build a
								pricing page&rdquo; through Autopilot means each step is handled
								by a specialist.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Workflows vs Ad-Hoc Tasks
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot workflows define repeatable processes as YAML state
								machines with human gates at consistent decision points. Quality
								is consistent because the process is defined. Single-agent
								assistants execute tasks ad-hoc &mdash; each request starts
								fresh, no enforced quality gates, no guaranteed steps.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 md:col-span-2">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Dashboard and Visibility
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Autopilot's dashboard shows agent status, task boards, chat
								channels, file browsers, session replay, activity feeds, and 13
								settings pages. Non-technical stakeholders can see what the AI
								team is doing without reading chat logs. A personal assistant
								typically provides a chat interface &mdash; the process between
								input and output is a black box unless you ask for details.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== WHEN TO CHOOSE ========== */}
				<Section id="choose">
					<SectionHeader
						num="03"
						sub="Personal assistants and company operating systems solve different problems."
					>
						Honest Guidance
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose OpenClaw if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									You need a personal AI assistant for individual productivity
								</li>
								<li>
									Your work is primarily ad-hoc tasks and one-off requests
								</li>
								<li>
									You prefer the simplicity of a single agent you interact with
									directly
								</li>
								<li>
									You do not need defined workflows, multi-agent coordination,
									or an observability dashboard
								</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								Choose Autopilot if
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>
									You need to run business processes, not just complete tasks
								</li>
								<li>
									You want YAML-configurable specialized agents that coordinate
									through defined workflows
								</li>
								<li>
									You need human approval gates at critical decision points
								</li>
								<li>
									You want a 26-page dashboard for full visibility into what
									your AI team is doing
								</li>
							</ul>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Run a Company, Not a Chat Session
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						Free. Open source. Configurable agents. Workflows. Dashboard. 5
						minutes.
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
