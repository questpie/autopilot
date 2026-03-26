import { join } from 'node:path'
import server from './dist/server/server.js'

const clientDir = join(import.meta.dir, 'dist', 'client')

export default {
	port: process.env.PORT ? Number(process.env.PORT) : 3001,
	async fetch(req: Request) {
		const url = new URL(req.url)
		const filePath = join(clientDir, url.pathname)

		// Serve static assets from dist/client/
		if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.ico') {
			const file = Bun.file(filePath)
			if (await file.exists()) return new Response(file)
		}

		// SSR handler for everything else
		return server.fetch(req)
	},
}
