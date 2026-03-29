#!/usr/bin/env bun
/**
 * QuestPie Autopilot MCP Server
 *
 * D32: MCP server scaffold with @modelcontextprotocol/sdk
 * D37: Supports stdio (default) and SSE transport
 *
 * Usage:
 *   autopilot-mcp                       # stdio transport (for Claude Desktop)
 *   autopilot-mcp --transport=sse       # SSE transport (for remote clients)
 *   autopilot-mcp --transport=sse --port=3100
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { createServer } from 'node:http'
import { registerTools } from './tools.js'

const args = process.argv.slice(2)
const transportArg = args.find(a => a.startsWith('--transport='))?.split('=')[1]
	?? (args.includes('--sse') ? 'sse' : 'stdio')

const portArg = args.find(a => a.startsWith('--port='))?.split('=')[1]
const port = portArg ? Number.parseInt(portArg, 10) : 3100

const server = new McpServer({
	name: 'questpie-autopilot',
	version: '1.0.0',
})

registerTools(server)

if (transportArg === 'sse') {
	startSSE(server, port)
} else {
	startStdio(server)
}

async function startStdio(server: McpServer): Promise<void> {
	const transport = new StdioServerTransport()
	await server.connect(transport)
}

async function startSSE(mcpServer: McpServer, port: number): Promise<void> {
	const sessions = new Map<string, SSEServerTransport>()

	const httpServer = createServer(async (req, res) => {
		const url = new URL(req.url ?? '/', `http://localhost:${port}`)

		if (url.pathname === '/sse' && req.method === 'GET') {
			const transport = new SSEServerTransport('/messages', res)
			sessions.set(transport.sessionId, transport)
			await mcpServer.connect(transport)
			return
		}

		if (url.pathname === '/messages' && req.method === 'POST') {
			const sessionId = url.searchParams.get('sessionId')
			if (!sessionId || !sessions.has(sessionId)) {
				res.writeHead(404)
				res.end('Session not found')
				return
			}
			await sessions.get(sessionId)!.handlePostMessage(req, res)
			return
		}

		res.writeHead(200)
		res.end('QuestPie Autopilot MCP Server (SSE)')
	})

	httpServer.listen(port, () => {
		console.error(`MCP SSE server listening on port ${port}`)
	})
}
