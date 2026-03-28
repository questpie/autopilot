import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/compare/openclaw')({
	head: () => ({
		meta: [
			{ title: 'Autopilot vs OpenClaw — QuestPie Autopilot' },
			{
				name: 'description',
				content: 'Company OS vs personal assistant. Multi-agent workflows vs single agent chat.',
			},
			{ property: 'og:title', content: 'Autopilot vs OpenClaw — QuestPie Autopilot' },
			{ property: 'og:description', content: 'Company OS vs personal assistant. Feature comparison.' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/compare/openclaw' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/compare/openclaw' }],
	}),
	component: OpenClawPage,
})

function OpenClawPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">COMPARE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Autopilot vs OpenClaw
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						OpenClaw is a single personal assistant. Autopilot is a multi-agent
						company OS. One agent that helps you vs a configurable team that
						runs your company.
					</p>
				</section>

				{/* COMPARISON TABLE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="diff autopilot openclaw">
							{`FEATURE              AUTOPILOT             OPENCLAW
─────────────────────────────────────────────────────────
architecture         multi-agent (YAML)    single agent
roles                strategy, dev, review general assistant
                     devops, marketing,
                     design, planning
workflows            YAML state machines   task-based
human gates          configurable points   manual interaction
dashboard            26 pages, real-time   basic UI
CLI                  60+ commands          limited
agent memory         persistent, per-agent conversation history
security             14 layers             basic
coordination         orchestrated multi    single agent
self-hosted          yes (single process)  yes
open source          MIT                   open source`}
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
							<p className="font-mono text-sm text-white mb-1">Specialized team vs generalist</p>
							<p className="font-mono text-xs text-lp-muted">
								"Build a pricing page" through Autopilot: CEO decomposes, Sam
								strategizes, Alex plans, Max implements, Riley reviews, Ops
								deploys, Morgan writes release notes. Each step handled by a
								specialist.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Defined workflows vs ad-hoc</p>
							<p className="font-mono text-xs text-lp-muted">
								YAML state machines with human gates at consistent decision
								points. Quality is consistent because the process is defined.
								Single-agent assistants execute ad-hoc — each request starts
								fresh.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Full visibility</p>
							<p className="font-mono text-xs text-lp-muted">
								26-page dashboard: agent status, task boards, chat, file browser,
								session replay. Non-technical stakeholders see what the AI team
								is doing. A personal assistant is a chat interface — process is
								a black box.
							</p>
						</div>
					</div>
				</section>

				{/* CHOOSE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Choose them if</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="when-to-use.yaml">
							{`choose_openclaw:
  - you need a personal assistant for individual productivity
  - your work is primarily ad-hoc tasks and one-off requests
  - you prefer simplicity of a single agent
  - you do not need workflows, coordination, or dashboard

choose_autopilot:
  - you need to run business processes, not just tasks
  - you want YAML-configurable specialized agents
  - you need human approval gates at critical points
  - you want full visibility into what the AI team is doing`}
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
