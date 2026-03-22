import { join } from 'node:path'
import server from './dist/server/server.js'

const port = Number(process.env.PORT) || 3000
const clientDir = join(import.meta.dir, 'dist', 'client')

Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url)

		// Serve static assets from dist/client/
		if (url.pathname.startsWith('/assets/')) {
			const filePath = join(clientDir, url.pathname)
			const file = Bun.file(filePath)
			if (await file.exists()) {
				return new Response(file, {
					headers: {
						'cache-control': 'public, max-age=31536000, immutable',
					},
				})
			}
		}

		// SSR for everything else
		return server.fetch(request)
	},
})

console.log(`Server running at http://localhost:${port}`)
