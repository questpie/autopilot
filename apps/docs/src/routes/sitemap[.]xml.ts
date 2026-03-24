import { createFileRoute } from '@tanstack/react-router'

type DocsPage = {
	slugs: string[]
	url: string
	data: {
		title?: string
		description?: string
	}
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

async function generateSitemap(
	baseUrl: string,
	pages: DocsPage[],
): Promise<string> {
	const now = new Date().toISOString()
	const urlEntries: string[] = []

	urlEntries.push(`  <url>
    <loc>${baseUrl}/docs</loc>
    <lastmod>${now.split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`)

	for (const page of pages) {
		const loc = `${baseUrl}${page.url}`
		urlEntries.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`
}

function getBaseUrl(request: Request): string {
	const url = new URL(request.url)
	const isLocalhost =
		url.hostname === 'localhost' || url.hostname === '127.0.0.1'
	const protocol = isLocalhost
		? 'http'
		: request.headers.get('x-forwarded-proto') || 'https'
	const host = request.headers.get('x-forwarded-host') || url.host
	return `${protocol}://${host}`
}

export const Route = createFileRoute('/sitemap.xml')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { source } = await import('@/lib/source')
				const baseUrl = getBaseUrl(request)
				const pages = source.getPages() as DocsPage[]

				const sitemap = await generateSitemap(baseUrl, pages)

				return new Response(sitemap, {
					headers: {
						'Content-Type': 'application/xml; charset=utf-8',
						'Cache-Control':
							'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
					},
				})
			},
		},
	},
})
