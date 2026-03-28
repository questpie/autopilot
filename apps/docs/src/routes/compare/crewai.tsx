import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/compare/crewai')({
	head: () => ({
		meta: [
			{ title: 'Autopilot vs CrewAI — QuestPie Autopilot' },
			{
				name: 'description',
				content: 'Product vs framework. Autopilot ships running. CrewAI ships building blocks.',
			},
			{ property: 'og:title', content: 'Autopilot vs CrewAI — QuestPie Autopilot' },
			{ property: 'og:description', content: 'Product vs framework. Feature comparison.' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/compare/crewai' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/compare/crewai' }],
	}),
	component: CrewAIPage,
})

function CrewAIPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">COMPARE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Autopilot vs CrewAI
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						Product vs framework. CrewAI gives you Python primitives to build
						your own system. Autopilot gives you a running system configured
						in YAML.
					</p>
				</section>

				{/* COMPARISON TABLE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="diff autopilot crewai">
							{`FEATURE              AUTOPILOT             CREWAI
─────────────────────────────────────────────────────────
type                 product (ready)       framework (build)
language             TypeScript / Bun      Python
agents               YAML config           code-defined
dashboard            26 pages, real-time   none (build it)
CLI                  60+ commands          Python API
workflows            YAML state machines   custom code
security             14 layers built-in    DIY
memory               persistent, per-agent configurable
tools                7 unified + SDK       custom (build)
setup                5 minutes             hours to days
license              MIT                   Apache 2.0
self-hosted          yes (single process)  yes`}
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
							<p className="font-mono text-sm text-white mb-1">Dashboard + CLI included</p>
							<p className="font-mono text-xs text-lp-muted">
								26-page dashboard with kanban, chat, session replay. 60+ CLI
								subcommands. CrewAI has no UI — you build your own.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Security out of the box</p>
							<p className="font-mono text-xs text-lp-muted">
								2FA, RBAC, AES-256-GCM secrets, SSRF protection, filesystem
								sandbox per agent, audit logs. CrewAI relies on your implementation.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">YAML config vs Python code</p>
							<p className="font-mono text-xs text-lp-muted">
								Autopilot: edit YAML, restart. CrewAI: write Python, deploy.
								Both valid. CrewAI gives maximum control. Autopilot gives maximum
								speed to production.
							</p>
						</div>
					</div>
				</section>

				{/* CHOOSE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Choose them if</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="when-to-use.yaml">
							{`choose_crewai:
  - you need Python-native with maximum control
  - you are building a highly custom multi-agent system
  - you already have your own dashboard and CLI
  - your team has Python expertise and engineering time

choose_autopilot:
  - you want a working product in 5 minutes
  - you need dashboard + CLI without building them
  - you need enterprise security without implementing it
  - you are solo or small team, cannot afford weeks of infra`}
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
