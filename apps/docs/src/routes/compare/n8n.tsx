import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/compare/n8n')({
	head: () => ({
		meta: [
			{ title: 'Autopilot vs n8n — QuestPie Autopilot' },
			{
				name: 'description',
				content: 'AI reasoning vs rule-based flows. Agents think. Rules don\'t.',
			},
			{ property: 'og:title', content: 'Autopilot vs n8n — QuestPie Autopilot' },
			{ property: 'og:description', content: 'AI reasoning vs rule-based flows. Feature comparison.' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/compare/n8n' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/compare/n8n' }],
	}),
	component: N8nPage,
})

function N8nPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">COMPARE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Autopilot vs n8n
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						n8n connects APIs with if/then rules. Autopilot orchestrates AI
						agents that reason. Different paradigms for different problems.
					</p>
				</section>

				{/* COMPARISON TABLE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="diff autopilot n8n">
							{`FEATURE              AUTOPILOT             N8N / ZAPIER
─────────────────────────────────────────────────────────
paradigm             AI agents + reasoning rule-based triggers
decisions            AI reasoning per task fixed conditions
adaptability         handles ambiguity     breaks on unexpected
agents               YAML w/ memory        none
dashboard            26 pages, real-time   flow editor
CLI                  60+ commands          basic CLI (n8n)
integrations         http + browse (any)   400+ native connectors
self-hosted          yes (single process)  yes (complex setup)
open source          MIT                   sustainable use license
price                free (self-host)      free tier / $20+/mo`}
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
							<p className="font-mono text-sm text-white mb-1">Reasoning vs rules</p>
							<p className="font-mono text-xs text-lp-muted">
								n8n: "if subject contains 'invoice', forward to accounting."
								Email arrives: "Q3 financial documents for review." Rule misses.
								Autopilot's agent reads, understands, routes correctly.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Memory vs stateless</p>
							<p className="font-mono text-xs text-lp-muted">
								Autopilot agents build persistent memory across sessions. After
								6 months of blog posts, Morgan knows your brand voice. n8n flows
								are stateless — same input, same output, forever.
							</p>
						</div>
						<div className="border border-lp-border p-4">
							<p className="font-mono text-sm text-white mb-1">Integrations tradeoff</p>
							<p className="font-mono text-xs text-lp-muted">
								n8n has 400+ native connectors with pre-built UI. Autopilot's
								http tool calls any API, browse reads any page. For your first
								50 integrations, n8n saves time. For custom APIs, Autopilot's
								flexibility wins.
							</p>
						</div>
					</div>
				</section>

				{/* CHOOSE */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Choose them if</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="when-to-use.yaml">
							{`choose_n8n:
  - your workflows are predictable with structured inputs
  - you need 400+ native integrations without connectors
  - you prefer visual flow editors
  - your use case is simple trigger-action automation

choose_autopilot:
  - your work requires reasoning, not if/then rules
  - you need agents that learn and adapt over time
  - you want a full company OS, not just automation
  - you need multi-agent coordination with human gates`}
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
