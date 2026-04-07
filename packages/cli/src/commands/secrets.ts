/**
 * `autopilot secrets` — manage orchestrator-managed shared secrets.
 *
 * Commands:
 *   set <name>    — create or update a shared secret
 *   list          — list all shared secrets (metadata only)
 *   delete <name> — delete a shared secret
 */
import { Command } from 'commander'
import { program } from '../program'
import { getBaseUrl } from '../utils/client'
import { header, dim, success, error, badge, table, dot } from '../utils/format'
import { getAuthHeaders } from './auth'

const secretsCmd = new Command('secret').alias('secrets').description('Manage orchestrator-managed shared secrets')

// ─── set ─────────────────────────────────────────────────────────────────

secretsCmd.addCommand(
	new Command('set')
		.description('Create or update a shared secret')
		.argument('<name>', 'Secret name (e.g. TELEGRAM_BOT_TOKEN)')
		.option('--scope <scope>', 'Delivery scope: worker, provider, or orchestrator_only', 'provider')
		.option('--value <value>', 'Secret value (plaintext)')
		.option('--from-env <var>', 'Read value from an environment variable')
		.option('--stdin', 'Read value from stdin')
		.option('--description <desc>', 'Human-readable description')
		.action(async (name: string, opts: {
			scope: string
			value?: string
			fromEnv?: string
			stdin?: boolean
			description?: string
		}) => {
			try {
				// Resolve value
				let value: string | undefined = opts.value

				if (opts.fromEnv) {
					value = process.env[opts.fromEnv]
					if (value === undefined) {
						console.error(error(`Environment variable "${opts.fromEnv}" is not set`))
						process.exit(1)
					}
				}

				if (opts.stdin) {
					value = await readStdin()
				}

				if (!value) {
					// Interactive prompt
					value = prompt('Secret value: ') ?? undefined
					if (!value) {
						console.error(error('No value provided'))
						process.exit(1)
					}
				}

				const scope = opts.scope
				if (!['worker', 'provider', 'orchestrator_only'].includes(scope)) {
					console.error(error(`Invalid scope "${scope}". Must be: worker, provider, or orchestrator_only`))
					process.exit(1)
				}

				const baseUrl = getBaseUrl()
				const headers = {
					...getAuthHeaders(),
					'Content-Type': 'application/json',
				}

				const res = await fetch(`${baseUrl}/api/secrets`, {
					method: 'POST',
					headers,
					body: JSON.stringify({
						name,
						scope,
						value,
						description: opts.description,
					}),
				})

				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Failed to set secret: ${body.error}`))
					process.exit(1)
				}

				const meta = await res.json() as { name: string; scope: string }
				console.log(success(`Secret "${meta.name}" set (scope: ${meta.scope})`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── list ────────────────────────────────────────────────────────────────

secretsCmd.addCommand(
	new Command('list')
		.description('List all shared secrets (metadata only — no values)')
		.action(async () => {
			try {
				const baseUrl = getBaseUrl()
				const headers = getAuthHeaders()

				const res = await fetch(`${baseUrl}/api/secrets`, { headers })

				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Failed to list secrets: ${body.error}`))
					process.exit(1)
				}

				const secrets = await res.json() as Array<{
					name: string
					scope: string
					description: string | null
					created_at: string
					updated_at: string
				}>

				if (secrets.length === 0) {
					console.log(dim('  No shared secrets configured.'))
					return
				}

				console.log(header('Shared Secrets'))
				console.log('')

				const rows: string[][] = [
					[badge('Name', 'cyan'), badge('Scope', 'cyan'), badge('Description', 'cyan'), badge('Updated', 'cyan')],
				]

				for (const s of secrets) {
					const scopeColor = s.scope === 'orchestrator_only' ? 'yellow' : 'green'
					rows.push([
						s.name,
						`${dot(scopeColor)} ${s.scope}`,
						s.description ?? dim('—'),
						s.updated_at.slice(0, 10),
					])
				}

				console.log(table(rows))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── delete ──────────────────────────────────────────────────────────────

secretsCmd.addCommand(
	new Command('delete')
		.description('Delete a shared secret')
		.argument('<name>', 'Secret name to delete')
		.action(async (name: string) => {
			try {
				const baseUrl = getBaseUrl()
				const headers = getAuthHeaders()

				const res = await fetch(`${baseUrl}/api/secrets/${encodeURIComponent(name)}`, {
					method: 'DELETE',
					headers,
				})

				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Failed to delete secret: ${body.error}`))
					process.exit(1)
				}

				console.log(success(`Secret "${name}" deleted`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(secretsCmd)

// ─── Helpers ─────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	const reader = Bun.stdin.stream().getReader()
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		chunks.push(Buffer.from(value))
	}
	return Buffer.concat(chunks).toString('utf-8').trim()
}
