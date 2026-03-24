import { createFileRoute } from '@tanstack/react-router'
import { renderPng } from '@questpie/avatar'

/**
 * Construct avatar API — deterministic pixel-art PNG from a seed string.
 *
 * Usage:  GET /api/avatar?seed=my-agent&size=120&style=solid&theme=dark
 *   seed   — any string (agent ID, name, etc.) — default 'default'
 *   size   — pixel width/height 16-512 — default 80
 *   style  — 'solid' | 'wireframe' — default 'solid'
 *   theme  — 'dark' | 'light' — default 'dark'
 *
 * Returns image/png with nearest-neighbor scaling intent, cacheable for 7 days.
 */

export const Route = createFileRoute('/api/avatar')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const seed = url.searchParams.get('seed') || 'default'
				const sizeParam = Number.parseInt(url.searchParams.get('size') || '80', 10)
				const size = Math.max(16, Math.min(512, Number.isNaN(sizeParam) ? 80 : sizeParam))
				const styleParam = url.searchParams.get('style')
				const style: 'solid' | 'wireframe' = styleParam === 'wireframe' ? 'wireframe' : 'solid'
				const themeParam = url.searchParams.get('theme')
				const theme: 'dark' | 'light' = themeParam === 'light' ? 'light' : 'dark'

				const png = renderPng({ seed, style, theme })

				return new Response(png, {
					headers: {
						'Content-Type': 'image/png',
						'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
						'Access-Control-Allow-Origin': '*',
					},
				})
			},
		},
	},
})
