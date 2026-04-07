import { createFileRoute, notFound } from '@tanstack/react-router'
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
		const { title, description } = loaderData
		return {
			meta: [
				{ title: `${title} — Autopilot Docs` },
				{ name: 'description', content: description },
			],
		}
	},
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
		const description = page.data.description ?? ''

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
