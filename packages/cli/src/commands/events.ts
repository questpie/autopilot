import { Command } from 'commander'
import { program } from '../program'
import { badge, dim, error } from '../utils/format'
import { getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

const eventsCmd = new Command('event')
	.alias('events')
	.description('Stream real-time events from the orchestrator (SSE)')
	.option('-f, --filter <types>', 'Comma-separated event types to show (e.g. task_changed,run_completed)')
	.action(async (opts: { filter?: string }) => {
		const filterTypes = opts.filter ? new Set(opts.filter.split(',').map((t) => t.trim())) : null

		console.log(dim(`Connecting to ${getBaseUrl()}/api/events ...`))
		console.log(dim('Press Ctrl+C to stop.\n'))

		try {
			const headers: Record<string, string> = { ...getAuthHeaders() }
			if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'
			const res = await fetch(`${getBaseUrl()}/api/events`, { headers })

			if (!res.ok) {
				console.error(error(`Failed to connect (${res.status})`))
				process.exit(1)
			}

			const reader = res.body?.getReader()
			if (!reader) {
				console.error(error('No response body'))
				process.exit(1)
			}

			const decoder = new TextDecoder()
			let buffer = ''

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split('\n')
				buffer = lines.pop()!

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue
					const json = line.slice(6)
					try {
						const event = JSON.parse(json) as { type: string; [key: string]: unknown }
						if (event.type === 'heartbeat') continue
						if (filterTypes && !filterTypes.has(event.type)) continue

						const ts = new Date().toISOString().slice(11, 19)
						const details = Object.entries(event)
							.filter(([k]) => k !== 'type')
							.map(([k, v]) => `${k}=${v}`)
							.join(' ')
						console.log(`${dim(ts)} ${badge(event.type, 'cyan')} ${details}`)
					} catch (err) {
						console.debug('[events] malformed SSE data:', err instanceof Error ? err.message : String(err))
					}
				}
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

program.addCommand(eventsCmd)
