import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/pricing')({
	head: () => ({
		meta: [
			{ title: 'Pricing — QuestPie Autopilot' },
			{
				name: 'description',
				content: 'Free self-hosted. Cloud from EUR 49/mo. Full product at every tier. BYOK, zero markup.',
			},
			{ property: 'og:title', content: 'Pricing — QuestPie Autopilot' },
			{
				property: 'og:description',
				content: 'Free self-hosted. Cloud from EUR 49/mo. Full product at every tier.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/pricing' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/pricing' }],
	}),
	component: PricingPage,
})

function PricingPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">PRICING</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						cat pricing.yaml
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						Every feature at every tier. Cloud adds hosting and support, not
						capability. Self-hosted = BYOK, zero markup.
					</p>
					<p className="font-mono text-[11px] text-lp-ghost mt-3">
						Pricing subject to change. Current as of March 2026.
					</p>
				</section>

				{/* TIERS */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="cat pricing.yaml">
							{`tiers:
  free:
    label: Self-Hosted
    price: $0/month forever
    includes:
      - all YAML-configurable agents
      - all 7 custom tools + SDK access
      - all 26 dashboard pages
      - all 60+ CLI commands
      - all 14 security layers
      - all 3 built-in workflows
      - custom agents and workflows
      - BYOK: bring your own API keys
      - zero markup on AI costs
    note: "the full product. no feature gating."

  pro:
    label: Cloud
    price: EUR 49/month
    includes:
      - everything in free
      - managed cloud hosting
      - automatic daily backups
      - automatic updates
      - included AI credits
      - 1 company instance
      - email support (48h response)
    trial: "14 days, no credit card"

  growth:
    label: Cloud
    price: EUR 149/month
    includes:
      - everything in pro
      - 3 company instances
      - custom domain
      - advanced analytics
      - priority support (24h response)
      - included AI credits

  scale:
    label: Cloud
    price: EUR 299/month
    includes:
      - everything in growth
      - 10 company instances
      - SSO via SAML/OIDC
      - dedicated infrastructure
      - priority support (4h response)
      - included AI credits

  enterprise:
    label: Cloud
    price: EUR 499+/month
    includes:
      - everything in scale
      - unlimited company instances
      - dedicated support engineer
      - custom SLA
      - on-premise deployment assistance
      - security review + compliance
      - included AI credits

annual_billing: "2 months free (pay 10, get 12)"`}
						</CodeBlock>
					</div>
				</section>

				{/* FEATURE MATRIX */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Feature matrix</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="cat features.yaml">
							{`#                     FREE   PRO    GROWTH  SCALE   ENTERPRISE
configurable_agents:  yes    yes    yes     yes     yes
custom_tools_+_sdk:   yes    yes    yes     yes     yes
dashboard_26_pages:   yes    yes    yes     yes     yes
cli_60+_commands:     yes    yes    yes     yes     yes
security_14_layers:   yes    yes    yes     yes     yes
built_in_workflows:   yes    yes    yes     yes     yes
custom_agents:        yes    yes    yes     yes     yes
custom_workflows:     yes    yes    yes     yes     yes
managed_hosting:      --     yes    yes     yes     yes
automatic_backups:    --     daily  daily   daily   custom
support:              community  48h  24h   4h      dedicated
company_instances:    1      1      3       10      unlimited
custom_domain:        --     --     yes     yes     yes
sso_saml_oidc:        --     --     --      yes     yes
dedicated_infra:      --     --     --      yes     yes
custom_sla:           --     --     --      --      yes`}
						</CodeBlock>
					</div>
					<p className="font-mono text-xs text-lp-muted mt-4 max-w-[560px]">
						Every product feature is in the Free tier. Cloud adds infrastructure
						and support — not capability.
					</p>
				</section>

				{/* FAQ */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">FAQ</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal — faq">
							{`$ Is the self-hosted version really free?
> Yes. MIT license. Full product. Forever. BYOK, pay provider
> directly. No feature gating, no usage limits, no time limits.

$ What AI API costs should I expect?
> Depends on model choice and task volume. Claude Haiku for
> classification, Sonnet for most agent work, Opus for complex
> reasoning. We never mark up AI costs. Cloud includes credits.

$ Can I switch from self-hosted to cloud?
> Yes. Export data directory, import into cloud instance. Config,
> knowledge, memory, workflows all transfer. No reconfiguration.

$ What if I cancel cloud?
> Export data, continue self-hosted. Same product. You lose managed
> hosting, backups, support. You keep every feature.

$ Annual billing?
> 2 months free. Pay for 10, get 12.

$ What AI providers?
> Claude via Agent SDK or direct API. GPT-4o, o3, o4-mini via
> Codex SDK. BYOK for self-hosted. More providers on roadmap.

$ Free trial for cloud?
> 14 days on Pro and Growth. No credit card required.

$ Enterprise pricing?
> Starts at EUR 499/mo. Scales with instances, SLA, deployment
> complexity. Contact us for a custom quote.`}
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
						Get Started Free
					</a>
				</section>
			</main>
		</div>
	)
}
