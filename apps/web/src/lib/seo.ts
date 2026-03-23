const SITE_URL = 'https://autopilot.questpie.com'
const SITE_NAME = 'QUESTPIE Autopilot'
const DEFAULT_DESCRIPTION =
	'AI-native company operating system. Your company is a container. Your employees are agents. CLI-first, open source, powered by Claude.'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`

export interface SeoConfig {
	title: string
	description?: string
	path?: string
	ogImage?: string
	type?: 'website' | 'article'
	noindex?: boolean
}

export function seoHead(config: SeoConfig) {
	const description = config.description ?? DEFAULT_DESCRIPTION
	const url = config.path ? `${SITE_URL}${config.path}` : SITE_URL
	const ogImage = config.ogImage ?? DEFAULT_OG_IMAGE
	const fullTitle =
		config.title === SITE_NAME
			? `${config.title} — AI-Native Company Operating System`
			: `${config.title} — ${SITE_NAME}`

	const meta: Array<Record<string, string>> = [
		{ title: fullTitle },
		{ name: 'description', content: description },

		// Open Graph
		{ property: 'og:title', content: fullTitle },
		{ property: 'og:description', content: description },
		{ property: 'og:type', content: config.type ?? 'website' },
		{ property: 'og:url', content: url },
		{ property: 'og:image', content: ogImage },
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ property: 'og:image:alt', content: fullTitle },
		{ property: 'og:site_name', content: SITE_NAME },
		{ property: 'og:locale', content: 'en_US' },

		// Twitter Card
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: fullTitle },
		{ name: 'twitter:description', content: description },
		{ name: 'twitter:image', content: ogImage },
	]

	if (config.noindex) {
		meta.push({ name: 'robots', content: 'noindex, nofollow' })
	}

	const links: Array<Record<string, string>> = [
		{ rel: 'canonical', href: url },
	]

	return { meta, links }
}

export function jsonLd(data: Record<string, unknown>) {
	return JSON.stringify(data)
}

export const organizationSchema = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: 'QUESTPIE',
	url: 'https://questpie.com',
	logo: `${SITE_URL}/logo.png`,
	sameAs: ['https://github.com/questpie/autopilot'],
}

export const websiteSchema = {
	'@context': 'https://schema.org',
	'@type': 'WebSite',
	name: SITE_NAME,
	url: SITE_URL,
	description: DEFAULT_DESCRIPTION,
	publisher: {
		'@type': 'Organization',
		name: 'QUESTPIE',
	},
}

export const softwareSchema = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: SITE_NAME,
	applicationCategory: 'DeveloperApplication',
	operatingSystem: 'macOS, Linux',
	description: DEFAULT_DESCRIPTION,
	url: SITE_URL,
	offers: {
		'@type': 'Offer',
		price: '0',
		priceCurrency: 'USD',
	},
	author: {
		'@type': 'Organization',
		name: 'QUESTPIE',
	},
}
