import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { DocsRouteContent } from '@/components/docs/DocsRouteContent'

export const Route = createFileRoute('/docs/$')({
	component: Page,
	loader: async ({ params }) => {
		const slugs = params._splat?.split('/') ?? []
		return serverLoader({ data: slugs })
	},
	head: ({ loaderData }) => {
		if (!loaderData) return {}

		const { title, description, url } = loaderData

		return {
			meta: [
				{ title: `${title} | QUESTPIE Autopilot Docs` },
				{ name: 'description', content: description },
				{ property: 'og:title', content: title },
				{ property: 'og:description', content: description },
				{ property: 'og:url', content: `https://autopilot.questpie.com${url}` },
				{ property: 'og:type', content: 'article' },
				{ name: 'twitter:card', content: 'summary_large_image' },
				{ name: 'twitter:title', content: title },
				{ name: 'twitter:description', content: description },
			],
		}
	},
	headers: () => ({
		'Cache-Control':
			'public, max-age=3600, s-maxage=3600, stale-while-revalidate=604800',
	}),
	staleTime: 5 * 60_000,
	gcTime: 10 * 60_000,
})

const serverLoader = createServerFn({ method: 'GET' })
	.inputValidator((slugs: string[]) => slugs)
	.handler(async ({ data: slugs }) => {
		const { source } = await import('@/lib/source')
		const page = source.getPage(slugs)
		if (!page) throw notFound()

		const title = page.data.title ?? 'Documentation'
		const description =
			page.data.description ??
			'QUESTPIE Autopilot documentation — AI-native company operating system.'

		return {
			path: page.path,
			url: page.url,
			title,
			description,
			slugs,
			pageTree: await source.serializePageTree(source.getPageTree()),
		}
	})

function Page() {
	const data = Route.useLoaderData()

	return <DocsRouteContent data={data} />
}
