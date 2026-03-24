import { createFileRoute } from '@tanstack/react-router'

import { getLLMText } from '@/lib/get-llm-text'

export const Route = createFileRoute('/llms-full.txt')({
	server: {
		handlers: {
			GET: async () => {
				const { source } = await import('@/lib/source')
				const scan = source.getPages().map(getLLMText)
				const scanned = await Promise.all(scan)
				const intro = `# QUESTPIE Autopilot Documentation (Full Corpus)

> AI-native company operating system

QUESTPIE Autopilot lets you define a company as a filesystem, staff it with AI agents, and give high-level intents. Agents decompose, plan, implement, review, and deploy -- you approve at human gates.`

				return new Response(`${intro}\n\n${scanned.join('\n\n')}`, {
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
