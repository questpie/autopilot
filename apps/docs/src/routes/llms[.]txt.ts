import { createFileRoute } from '@tanstack/react-router'

type LLMSPage = {
	slugs: string[]
	url: string
	data: {
		title?: string
	}
}

function generateLLMSTxt(baseUrl: string, pages: LLMSPage[]) {
	const sections: string[] = []

	const sectionOrder: Array<{ key: string; title: string }> = [
		{ key: 'getting-started', title: 'Getting Started' },
		{ key: 'architecture', title: 'Architecture' },
		{ key: 'agents', title: 'Agents' },
		{ key: 'workflows', title: 'Workflows' },
		{ key: 'memory', title: 'Context & Memory' },
		{ key: 'primitives', title: 'Primitives' },
		{ key: 'features', title: 'Features' },
		{ key: 'skills', title: 'Skills' },
		{ key: 'artifacts', title: 'Artifacts' },
		{ key: 'living-dashboard', title: 'Living Dashboard' },
		{ key: 'cli', title: 'CLI Reference' },
		{ key: 'integrations', title: 'Integrations' },
		{ key: 'use-cases', title: 'Use Cases' },
	]

	for (const page of pages) {
		const slug = page.slugs[0] ?? 'root'
		const section = sectionOrder.find((s) => s.key === slug)
		if (section) {
			sections.push(`- ${page.data.title}: ${baseUrl}${page.url}.mdx`)
		}
	}

	return `# QUESTPIE Autopilot Documentation

> AI-native company operating system

QUESTPIE Autopilot lets you define a company as a filesystem, staff it with AI agents backed by Claude, and give high-level intents. Agents decompose, plan, implement, review, and deploy -- you approve at human gates.

## Documentation Surfaces

- Full documentation corpus: ${baseUrl}/llms-full.txt
- Individual docs pages: ${baseUrl}/docs/{path}.mdx

## Pages

${sections.join('\n')}

## Architecture Notes

- Company is a filesystem. YAML for data, Markdown for docs, SQLite for indexes.
- Orchestrator is a single Bun process: watcher, workflow engine, agent spawner, scheduler, webhook server.
- Agents are ephemeral Claude sessions with persistent memory.
- 4-layer context assembly: identity, company state, memory, task context.
- Workflows are YAML state machines, not code.
`
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

export const Route = createFileRoute('/llms.txt')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { source } = await import('@/lib/source')
				const baseUrl = getBaseUrl(request)
				const pages = source.getPages() as LLMSPage[]

				return new Response(generateLLMSTxt(baseUrl, pages), {
					headers: {
						'Content-Type': 'text/plain; charset=utf-8',
						'Cache-Control':
							'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
					},
				})
			},
		},
	},
})
