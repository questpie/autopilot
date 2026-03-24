import { createFileRoute } from '@tanstack/react-router'

let searchServerPromise: Promise<{
	GET: (request: Request) => Promise<Response>
}> | null = null

async function getSearchServer() {
	if (!searchServerPromise) {
		searchServerPromise = (async () => {
			const [{ source }, { createFromSource }] = await Promise.all([
				import('@/lib/source'),
				import('fumadocs-core/search/server'),
			])

			return createFromSource(source, {
				language: 'english',
			})
		})()
	}

	return searchServerPromise
}

export const Route = createFileRoute('/api/search')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const server = await getSearchServer()
				const response = await server.GET(request)
				const headers = new Headers(response.headers)
				headers.set(
					'Cache-Control',
					'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
				)
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers,
				})
			},
		},
	},
})
