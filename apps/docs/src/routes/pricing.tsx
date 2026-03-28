import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/pricing')({
	head: () => ({
		meta: [
			{
				title:
					'Pricing — Free Self-Hosted, Cloud from EUR 49/mo | QuestPie Autopilot',
			},
			{
				name: 'description',
				content:
					'Full product free and open source. Cloud hosting adds managed infrastructure, backups, and support. Self-hosted = BYOK, zero markup.',
			},
			{
				property: 'og:title',
				content:
					'Pricing — Free Self-Hosted, Cloud from EUR 49/mo | QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Full product free and open source. Cloud hosting adds managed infrastructure, backups, and support.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/pricing',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Pricing — Free Self-Hosted, Cloud from EUR 49/mo',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/pricing',
			},
		],
	}),
	component: PricingPage,
})

const tiers = [
	{
		name: 'Free',
		label: 'Self-Hosted',
		price: '$0',
		period: '/month forever',
		description:
			'The full product. All YAML-configurable agents, all 7 custom tools + built-in SDK access, all 26 dashboard pages, all 60+ CLI commands, all 14 security layers, all 3 built-in workflows. Run on your own infrastructure. BYOK — bring your own API keys, pay your provider directly, zero markup.',
		cta: 'Get Started',
		ctaHref: '/docs/getting-started',
		highlighted: false,
	},
	{
		name: 'Pro',
		label: 'Cloud',
		price: 'EUR 49',
		period: '/month',
		description:
			'Everything in Free, plus managed cloud hosting with automatic daily backups. Email support with 48-hour response time. Automatic updates. Included AI credits. 1 company instance.',
		cta: 'Start Free Trial',
		ctaHref: '/docs/getting-started',
		highlighted: true,
	},
	{
		name: 'Growth',
		label: 'Cloud',
		price: 'EUR 149',
		period: '/month',
		description:
			'Everything in Pro, plus priority support with 24-hour response time. 3 company instances for multi-project setups. Custom domain support. Advanced analytics dashboard. Included AI credits.',
		cta: 'Start Free Trial',
		ctaHref: '/docs/getting-started',
		highlighted: false,
	},
	{
		name: 'Scale',
		label: 'Cloud',
		price: 'EUR 299',
		period: '/month',
		description:
			'Everything in Growth, plus priority support with 4-hour response time. 10 company instances. SSO via SAML/OIDC. Dedicated infrastructure for isolation and performance. Included AI credits.',
		cta: 'Contact Sales',
		ctaHref: '/docs/getting-started',
		highlighted: false,
	},
	{
		name: 'Enterprise',
		label: 'Cloud',
		price: 'EUR 499+',
		period: '/month',
		description:
			'Everything in Scale, plus a dedicated support engineer. Unlimited company instances. Custom SLA. On-premise deployment assistance. Security review and compliance support. Included AI credits.',
		cta: 'Contact Sales',
		ctaHref: '/docs/getting-started',
		highlighted: false,
	},
]

const matrixFeatures = [
	{ feature: 'Configurable agents', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: '7 custom tools + SDK access', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: '26-page dashboard', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: '60+ CLI commands', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: '14 security layers', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: '3 built-in workflows', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'Custom agents', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'Custom workflows', free: 'Yes', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'Managed hosting', free: '\u2014', pro: 'Yes', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'Automatic backups', free: '\u2014', pro: 'Daily', growth: 'Daily', scale: 'Daily', enterprise: 'Custom' },
	{ feature: 'Support', free: 'Community', pro: '48h email', growth: '24h priority', scale: '4h priority', enterprise: 'Dedicated' },
	{ feature: 'Company instances', free: '1', pro: '1', growth: '3', scale: '10', enterprise: 'Unlimited' },
	{ feature: 'Custom domain', free: '\u2014', pro: '\u2014', growth: 'Yes', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'SSO (SAML/OIDC)', free: '\u2014', pro: '\u2014', growth: '\u2014', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'Dedicated infra', free: '\u2014', pro: '\u2014', growth: '\u2014', scale: 'Yes', enterprise: 'Yes' },
	{ feature: 'Custom SLA', free: '\u2014', pro: '\u2014', growth: '\u2014', scale: '\u2014', enterprise: 'Yes' },
]

const faqs = [
	{
		q: 'Is the self-hosted version really free?',
		a: 'Yes. MIT license. Full product. Forever. You bring your own API keys and pay your provider directly. No feature gating, no usage limits, no time restrictions. The free version is the complete product.',
	},
	{
		q: 'What AI API costs should I expect?',
		a: 'Costs depend entirely on your model choice, task volume, and agent activity. Claude Haiku is cheap for classification tasks. Claude Sonnet is the sweet spot for most agent work. Claude Opus is premium for complex reasoning. You use your own API keys for self-hosted. We never mark up AI costs. Cloud tiers include AI credits.',
	},
	{
		q: 'Can I switch from self-hosted to cloud?',
		a: 'Yes. Export your data directory and import it into a cloud instance. Your company configuration, knowledge base, agent memory, and workflow definitions transfer. No data loss, no reconfiguration.',
	},
	{
		q: 'What happens if I cancel my cloud subscription?',
		a: 'You export your data and continue running self-hosted. The product is identical. You lose managed hosting, automatic backups, and priority support. You keep every feature, every agent, every workflow.',
	},
	{
		q: 'Do you offer annual billing?',
		a: 'Yes. Annual billing includes 2 months free. Pay for 10 months, get 12.',
	},
	{
		q: 'What AI providers are supported?',
		a: 'Claude via the Agent SDK or direct API. OpenAI GPT-4o, o3, and o4-mini via the Codex SDK. You bring your own API keys for self-hosted. Additional providers are on the roadmap.',
	},
	{
		q: 'Is there a free trial for cloud tiers?',
		a: 'Yes. 14-day free trial on Pro and Growth tiers. No credit card required.',
	},
	{
		q: 'How does enterprise pricing work?',
		a: 'Enterprise starts at EUR 499/month and scales based on the number of company instances, support SLA requirements, and deployment complexity. Contact us for a custom quote.',
	},
]

function PricingPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>PRICING</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Free Forever. Self-Hosted.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						The full product is free and open source. Cloud hosting adds managed
						infrastructure, backups, and support.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Every feature is available in the free self-hosted version. No
						feature gating, no usage limits, no time restrictions. Cloud tiers
						add hosting convenience, not product capability. Self-hosted = BYOK
						(bring your own API keys, pay provider directly, zero markup). Cloud
						= included AI credits.
					</p>
					<p className="font-sans text-[11px] text-lp-ghost mt-4 italic">
						Pricing subject to change. Current as of March 2026.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started Free
						</a>
					</div>
				</section>

				{/* ========== TIER CARDS ========== */}
				<Section id="tiers">
					<SectionHeader
						num="01"
						sub="All tiers include the complete product. Cloud adds infrastructure and support."
					>
						Choose Your Plan
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{tiers.map((tier) => (
							<div
								key={tier.name}
								className={`bg-lp-card border p-6 flex flex-col ${
									tier.highlighted
										? 'border-[#B700FF]'
										: 'border-lp-border'
								}`}
							>
								<div className="flex items-center gap-2 mb-3">
									<h3 className="font-mono text-sm font-bold text-white m-0">
										{tier.name}
									</h3>
									<span className="font-mono text-[10px] text-lp-muted tracking-[0.15em] uppercase">
										{tier.label}
									</span>
								</div>
								<div className="mb-4">
									<span className="font-mono text-2xl font-bold text-white">
										{tier.price}
									</span>
									<span className="font-sans text-xs text-lp-muted ml-1">
										{tier.period}
									</span>
								</div>
								<p className="font-sans text-xs text-lp-muted leading-relaxed flex-1">
									{tier.description}
								</p>
								<div className="mt-6">
									<a
										href={tier.ctaHref}
										className={`inline-block font-mono text-sm px-5 py-2.5 transition-colors no-underline ${
											tier.highlighted
												? 'bg-[#B700FF] text-white hover:bg-[#9200CC]'
												: 'border border-lp-border text-lp-fg hover:bg-lp-surface'
										}`}
									>
										{tier.cta}
									</a>
								</div>
							</div>
						))}
					</div>
				</Section>

				{/* ========== FEATURE COMPARISON MATRIX ========== */}
				<Section id="matrix">
					<SectionHeader
						num="02"
						sub="The product is the same everywhere. Cloud tiers add infrastructure and support."
					>
						What's Included in Every Tier
					</SectionHeader>

					<div className="overflow-x-auto lp-scrollbar">
						<table className="w-full border-collapse min-w-[800px]">
							<thead>
								<tr className="border-b border-lp-border">
									<th className="font-mono text-[10px] text-lp-muted tracking-[0.15em] uppercase text-left p-3">
										Feature
									</th>
									{['Free', 'Pro', 'Growth', 'Scale', 'Enterprise'].map(
										(tier) => (
											<th
												key={tier}
												className="font-mono text-[10px] text-lp-muted tracking-[0.15em] uppercase text-left p-3"
											>
												{tier}
											</th>
										)
									)}
								</tr>
							</thead>
							<tbody>
								{matrixFeatures.map((row) => (
									<tr
										key={row.feature}
										className="border-b border-lp-border/30 hover:bg-lp-surface/50"
									>
										<td className="font-mono text-[11px] text-lp-fg p-3">
											{row.feature}
										</td>
										<td className="font-sans text-[12px] text-lp-fg p-3">
											{row.free}
										</td>
										<td className="font-sans text-[12px] text-lp-fg p-3">
											{row.pro}
										</td>
										<td className="font-sans text-[12px] text-lp-fg p-3">
											{row.growth}
										</td>
										<td className="font-sans text-[12px] text-lp-fg p-3">
											{row.scale}
										</td>
										<td className="font-sans text-[12px] text-lp-fg p-3">
											{row.enterprise}
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<p className="font-sans text-xs text-lp-muted mt-4">
							Every product feature is available in the Free tier. Cloud adds
							infrastructure and support &mdash; not capability.
						</p>
					</div>
				</Section>

				{/* ========== FAQ ========== */}
				<Section id="faq">
					<SectionHeader
						num="03"
						sub="Common questions about pricing, hosting, and AI costs."
					>
						Frequently Asked Questions
					</SectionHeader>

					<div className="space-y-4">
						{faqs.map((faq) => (
							<div
								key={faq.q}
								className="bg-lp-card border border-lp-border p-6"
							>
								<h3 className="font-mono text-sm font-bold text-white mb-2">
									{faq.q}
								</h3>
								<p className="font-sans text-xs text-lp-muted leading-relaxed">
									{faq.a}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-[11px] text-lp-ghost mt-6 italic">
						Pricing subject to change. Current as of March 2026.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Start Free. Upgrade When You Need To.
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						Every feature. Every agent. Zero cost to start.
					</p>
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
