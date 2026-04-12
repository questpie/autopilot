/**
 * `autopilot script` — manage standalone scripts.
 */
import { Command } from 'commander'
import { program } from '../program'
import { createApiClient } from '../utils/client'
import { dim, error, section, table } from '../utils/format'

interface ScriptSummary {
	id: string
	name: string
	description: string
	entry_point: string
	runner: string
	tags: string[]
}

const scriptCmd = new Command('script').description('Manage standalone scripts')

scriptCmd.addCommand(
	new Command('list').description('List all standalone scripts').action(async () => {
		try {
			const client = createApiClient()
			const res = await client.api.scripts.$get()

			if (!res.ok) {
				console.error(error('Failed to fetch scripts'))
				process.exit(1)
			}

			const items = (await res.json()) as ScriptSummary[]

			console.log(section('Scripts'))
			if (items.length === 0) {
				console.log(dim('  No scripts found'))
				return
			}

			console.log(
				table(
					items.map((s) => [
						dim(s.id),
						s.name,
						dim(s.runner),
						dim(s.entry_point),
						dim(s.tags.join(', ') || '—'),
					]),
				),
			)
			console.log('')
			console.log(dim(`${items.length} script(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	}),
)

scriptCmd.addCommand(
	new Command('show')
		.description('Show script details')
		.argument('<id>', 'Script ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()
				const res = await client.api.scripts[':id'].$get({ param: { id } })

				if (!res.ok) {
					console.error(error(`Script not found: ${id}`))
					process.exit(1)
				}

				const s = (await res.json()) as ScriptSummary & {
					inputs?: Array<{ name: string; description?: string; type: string; required: boolean }>
					outputs?: Array<{ name: string; description?: string; type: string }>
					sandbox?: {
						fs_scope?: { read: string[]; write: string[] }
						network?: string
						timeout_ms?: number
						max_memory_mb?: number
					}
					env?: Record<string, string>
					secret_env?: Record<string, string>
				}

				console.log(section(s.name))
				console.log('')
				console.log(`  ${dim('ID:')}          ${s.id}`)
				console.log(`  ${dim('Runner:')}      ${s.runner}`)
				console.log(`  ${dim('Entry:')}       ${s.entry_point}`)
				if (s.description) console.log(`  ${dim('Description:')} ${s.description}`)
				if (s.tags.length > 0) console.log(`  ${dim('Tags:')}        ${s.tags.join(', ')}`)

				if (s.sandbox) {
					console.log('')
					console.log(dim('Sandbox:'))
					if (s.sandbox.network) console.log(`  ${dim('Network:')}    ${s.sandbox.network}`)
					if (s.sandbox.timeout_ms) console.log(`  ${dim('Timeout:')}    ${s.sandbox.timeout_ms}ms`)
					if (s.sandbox.max_memory_mb) {
						console.log(`  ${dim('Max memory:')} ${s.sandbox.max_memory_mb}MB`)
					}
					if (s.sandbox.fs_scope) {
						console.log(`  ${dim('FS read:')}    ${s.sandbox.fs_scope.read.join(', ') || '—'}`)
						console.log(`  ${dim('FS write:')}   ${s.sandbox.fs_scope.write.join(', ') || '—'}`)
					}
				}

				if (s.inputs && s.inputs.length > 0) {
					console.log('')
					console.log(dim('Inputs:'))
					for (const inp of s.inputs) {
						const req = inp.required ? ' (required)' : ''
						console.log(`  ${inp.name}: ${inp.type}${req}`)
						if (inp.description) console.log(`    ${dim(inp.description)}`)
					}
				}

				if (s.outputs && s.outputs.length > 0) {
					console.log('')
					console.log(dim('Outputs:'))
					for (const out of s.outputs) {
						console.log(`  ${out.name}: ${out.type}`)
						if (out.description) console.log(`    ${dim(out.description)}`)
					}
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(scriptCmd)
