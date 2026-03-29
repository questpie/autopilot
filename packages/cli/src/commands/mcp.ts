/**
 * D36: CLI command `autopilot mcp`
 *
 * Starts the MCP server in stdio (default) or SSE mode.
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { program } from '../program'
import { brandHeader, success, dim } from '../utils/format'

const CLI_ROOT = resolve(import.meta.dir, '..', '..')

program
	.command('mcp')
	.description('Start the MCP server for Claude Desktop/Code integration')
	.option('--transport <type>', 'Transport type: stdio (default) or sse', 'stdio')
	.option('--port <number>', 'Port for SSE transport (default 3100)', '3100')
	.action(async (opts: { transport: string; port: string }) => {
		if (opts.transport === 'sse') {
			console.log(brandHeader())
			console.log(success('Starting MCP server (SSE mode)'))
			console.log(dim(`  Port: ${opts.port}`))
			console.log()
		}

		const mcpServerPath = resolve(CLI_ROOT, '..', 'mcp-server', 'src', 'index.ts')
		const args = ['run', mcpServerPath]

		if (opts.transport === 'sse') {
			args.push('--transport=sse', `--port=${opts.port}`)
		}

		const proc = spawn('bun', args, {
			stdio: opts.transport === 'stdio' ? 'inherit' : ['inherit', 'inherit', 'inherit'],
			env: { ...process.env },
		})

		proc.on('exit', (code) => {
			process.exit(code ?? 0)
		})

		// Forward signals
		process.on('SIGINT', () => proc.kill('SIGINT'))
		process.on('SIGTERM', () => proc.kill('SIGTERM'))
	})
