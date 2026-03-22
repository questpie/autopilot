import server from './dist/server/server.js'

const port = Number(process.env.PORT) || 3000

Bun.serve({
	port,
	fetch: server.fetch,
})

console.log(`Server running at http://localhost:${port}`)
