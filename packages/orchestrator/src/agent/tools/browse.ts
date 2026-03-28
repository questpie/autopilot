import { join } from 'path'
import { mkdirSync, existsSync } from 'node:fs'
import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../tools'
import { checkSsrf } from './shared'

export function createBrowseTool(companyRoot: string): ToolDefinition {
	return {
		name: 'browse',
		description: 'Browse a web page. Returns page content as text, optionally takes a screenshot.',
		schema: z.object({
			url: z.string().describe('URL to browse'),
			extract: z.string().optional().describe('What to look for on the page, e.g. "pricing tiers"'),
			screenshot: z.boolean().optional().describe('Save a screenshot (default false)'),
		}),
		execute: async (args, _ctx) => {
			// SSRF protection
			const ssrfError = await checkSsrf(args.url)
			if (ssrfError) {
				return { content: [{ type: 'text' as const, text: ssrfError }], isError: true }
			}

			// Try agent-browser CLI first, fall back to simple fetch
			let pageContent = ''
			let screenshotPath: string | undefined

			try {
				// Check if agent-browser binary is available
				const which = Bun.spawnSync(['which', 'agent-browser'])
				const hasBinary = which.exitCode === 0

				// Also check local node_modules bin
				const localBin = join(companyRoot, 'node_modules', '.bin', 'agent-browser')
				const hasLocalBin = existsSync(localBin)

				const browserCmd = hasBinary ? 'agent-browser' : hasLocalBin ? localBin : null

				if (browserCmd) {
					// Use agent-browser CLI for full JS rendering
					// Open URL, wait for load, take snapshot
					const openProc = Bun.spawnSync([browserCmd, 'open', args.url], {
						timeout: 15_000,
						stderr: 'pipe',
					})
					if (openProc.exitCode !== 0) {
						throw new Error(`agent-browser open failed: ${openProc.stderr.toString()}`)
					}

					// Wait for network idle
					Bun.spawnSync([browserCmd, 'wait', '--load', 'networkidle'], {
						timeout: 20_000,
						stderr: 'pipe',
					})

					// Take snapshot
					const snapshotProc = Bun.spawnSync([browserCmd, 'snapshot', '--compact'], {
						timeout: 10_000,
						stdout: 'pipe',
						stderr: 'pipe',
					})
					pageContent = snapshotProc.stdout.toString()

					// Screenshot if requested
					if (args.screenshot) {
						const screenshotsDir = join(companyRoot, 'uploads', 'screenshots')
						if (!existsSync(screenshotsDir)) {
							mkdirSync(screenshotsDir, { recursive: true })
						}
						const timestamp = Date.now()
						screenshotPath = join(screenshotsDir, `${timestamp}.png`)
						Bun.spawnSync([browserCmd, 'screenshot', screenshotPath], {
							timeout: 10_000,
							stderr: 'pipe',
						})
					}
				} else {
					// Fallback: simple fetch (no JS rendering)
					const controller = new AbortController()
					const timeoutId = setTimeout(() => controller.abort(), 30_000)
					try {
						const resp = await fetch(args.url, {
							signal: controller.signal,
							headers: {
								'User-Agent': 'QuestPie-Autopilot/1.0 (+https://autopilot.questpie.com)',
								'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
							},
						})
						const html = await resp.text()
						// Strip HTML tags for a basic text extraction
						pageContent = html
							.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
							.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
							.replace(/<[^>]+>/g, ' ')
							.replace(/\s+/g, ' ')
							.trim()
					} finally {
						clearTimeout(timeoutId)
					}

					if (args.screenshot) {
						screenshotPath = undefined // Not available without agent-browser
						pageContent += '\n\n[Note: screenshot requires agent-browser binary. Install with: bun add agent-browser]'
					}
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				// Fall back to simple fetch on any agent-browser error
				try {
					const controller = new AbortController()
					const timeoutId = setTimeout(() => controller.abort(), 30_000)
					try {
						const resp = await fetch(args.url, {
							signal: controller.signal,
							headers: {
								'User-Agent': 'QuestPie-Autopilot/1.0 (+https://autopilot.questpie.com)',
								'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
							},
						})
						const html = await resp.text()
						pageContent = html
							.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
							.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
							.replace(/<[^>]+>/g, ' ')
							.replace(/\s+/g, ' ')
							.trim()
					} finally {
						clearTimeout(timeoutId)
					}
				} catch (fetchErr) {
					const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
					return { content: [{ type: 'text' as const, text: `Browse failed: ${msg}. Fetch fallback also failed: ${fetchMsg}` }], isError: true }
				}
			}

			// Truncate very long pages
			const maxLen = 50_000
			if (pageContent.length > maxLen) {
				pageContent = `${pageContent.slice(0, maxLen)}\n\n[... truncated, ${pageContent.length} chars total ...]`
			}

			// Build response
			const parts: string[] = []
			parts.push(`## Page: ${args.url}\n`)

			if (args.extract) {
				parts.push(`*Extraction hint: "${args.extract}"*\n`)
			}

			parts.push(pageContent)

			if (screenshotPath) {
				parts.push(`\n**Screenshot saved:** ${screenshotPath}`)
			}

			return { content: [{ type: 'text' as const, text: parts.join('\n') }] }
		},
	}
}
