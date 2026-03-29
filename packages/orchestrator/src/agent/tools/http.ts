import { join } from 'path'
import { z } from 'zod'
import { PATHS } from '@questpie/autopilot-spec'
import { readYamlUnsafe } from '../../fs/yaml'
import type { ToolDefinition, AutopilotToolOptions } from '../tools'
import { checkSsrf } from './shared'

/** Zod schema for secret YAML files used by the fetch tool. */
const SecretSchema = z.object({
	allowed_agents: z.array(z.string()).optional(),
	api_key: z.string().optional(),
}).passthrough()

export function createHttpTool(companyRoot: string, options?: AutopilotToolOptions): ToolDefinition {
	return {
		name: 'fetch',
		description: 'Fetch a URL or call an external API. Supports GET, POST, PUT, PATCH, DELETE with custom headers and body.',
		schema: z.object({
			method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
			url: z.string().describe('Full URL'),
			headers: z.record(z.string()).optional(),
			body: z.unknown().optional(),
			secret_ref: z.string().optional().describe('Secret name from /secrets/ for auth injection'),
		}),
		execute: async (args, ctx) => {
			const headers: Record<string, string> = { ...args.headers }

			if (args.secret_ref) {
				const secretPath = join(
					companyRoot,
					PATHS.SECRETS_DIR.replace(/^\/company/, ''),
					`${args.secret_ref}.yaml`,
				)
				try {
					const secret = SecretSchema.parse(await readYamlUnsafe(secretPath))
					if (secret.allowed_agents && !secret.allowed_agents.includes(ctx.agentId)) {
						return {
							content: [{ type: 'text' as const, text: `Agent ${ctx.agentId} not allowed to use secret ${args.secret_ref}` }],
							isError: true,
						}
					}
					if (secret.api_key) {
						headers['Authorization'] = `Bearer ${secret.api_key}`
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					return {
						content: [{ type: 'text' as const, text: `Failed to load secret ${args.secret_ref}: ${msg}` }],
						isError: true,
					}
				}
			}

			try {
				// ── Allowlist check ──────────────────────────────────────────
				if (options?.httpAllowlist && options.httpAllowlist.length > 0) {
					let requestHostname: string
					try {
						requestHostname = new URL(args.url).hostname
					} catch {
						return {
							content: [{ type: 'text' as const, text: 'Blocked: invalid URL' }],
							isError: true,
						}
					}
					if (!options.httpAllowlist.includes(requestHostname)) {
						return {
							content: [{ type: 'text' as const, text: `Blocked: hostname "${requestHostname}" is not in the allowed list` }],
							isError: true,
						}
					}
				}

				// ── SSRF protection ──────────────────────────────────────────
				const ssrfError = await checkSsrf(args.url)
				if (ssrfError) {
					return {
						content: [{ type: 'text' as const, text: ssrfError }],
						isError: true,
					}
				}

				const fetchOptions: RequestInit = {
					method: args.method,
					headers,
				}
				if (args.body !== undefined && args.method !== 'GET') {
					fetchOptions.body = JSON.stringify(args.body)
					headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
				}
				fetchOptions.signal = AbortSignal.timeout(30_000)
				const response = await fetch(args.url, fetchOptions)
				const responseText = await response.text()
				return {
					content: [{ type: 'text' as const, text: `HTTP ${response.status}\n${responseText}` }],
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				return {
					content: [{ type: 'text' as const, text: `HTTP request failed: ${msg}` }],
					isError: true,
				}
			}
		},
	}
}
