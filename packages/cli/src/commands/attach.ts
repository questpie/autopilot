import { Command } from 'commander'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, error, success, warning } from '../utils/format'

const API_BASE = 'http://localhost:7778'
const POLL_INTERVAL = 2000

interface ActivityEntry {
	at: string
	agent: string
	type: string
	summary: string
	details?: Record<string, unknown>
}

const EVENT_ICONS: Record<string, string> = {
	tool_call: '\u{1F4DD}',
	tool_result: '\u{1F4CB}',
	thinking: '\u{1F914}',
	text: '\u{1F4AC}',
	error: '\u{274C}',
	status: '\u{2705}',
}

function formatTime(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}

function formatEntry(entry: ActivityEntry, compact: boolean): string {
	const time = formatTime(entry.at)
	const icon = EVENT_ICONS[entry.type] ?? '\u{25CF}'

	if (compact) {
		return `[${time}] ${icon} ${entry.agent}  ${entry.summary}`
	}

	switch (entry.type) {
		case 'thinking':
			return dim(`[${time}] ${icon} ${entry.agent}  [thinking] ${entry.summary}`)
		case 'tool_call': {
			const tool = entry.details?.tool as string | undefined
			const target = entry.details?.target as string | undefined
			const toolText = tool ? badge(tool, 'cyan') : ''
			const targetText = target ? ` \u2192 ${target}` : ''
			return `[${time}] ${icon} ${entry.agent}  ${toolText}${targetText} ${entry.summary}`
		}
		case 'tool_result':
			return `[${time}] ${icon} ${entry.agent}  ${dim(entry.summary)}`
		case 'text':
			return `[${time}] ${icon} ${entry.agent}  \u2192 ${entry.summary}`
		case 'error':
			return `[${time}] ${icon} ${entry.agent}  ${error(entry.summary)}`
		case 'status':
			return dim(`[${time}] ${icon} ${entry.agent}  ${entry.summary}`)
		default:
			return `[${time}] ${icon} ${entry.agent}  ${entry.summary}`
	}
}

async function checkOrchestrator(): Promise<boolean> {
	try {
		const res = await fetch(`${API_BASE}/api/status`)
		return res.ok
	} catch {
		return false
	}
}

async function fetchActivity(agentId: string, limit: number): Promise<ActivityEntry[]> {
	const res = await fetch(`${API_BASE}/api/activity?agent=${encodeURIComponent(agentId)}&limit=${limit}`)
	if (!res.ok) {
		throw new Error(`API returned ${res.status}`)
	}
	return (await res.json()) as ActivityEntry[]
}

function printSeparator(): void {
	console.log('\u2500'.repeat(45))
}

function shouldShow(entry: ActivityEntry, toolsOnly: boolean): boolean {
	if (!toolsOnly) return true
	return entry.type === 'tool_call' || entry.type === 'tool_result'
}

program.addCommand(
	new Command('attach')
		.description('Attach to a live agent session and stream activity in real-time')
		.argument('<agent>', 'Agent ID to attach to')
		.option('--compact', 'One line per event (time + agent + summary)')
		.option('--tools-only', 'Only show tool_call and tool_result events')
		.action(async (agentId: string, opts: { compact?: boolean; toolsOnly?: boolean }) => {
			try {
				await findCompanyRoot()
			} catch {
				console.error(error('No company directory found.'))
				console.error(dim('Run "autopilot init" to create one first.'))
				process.exit(1)
			}

			const running = await checkOrchestrator()
			if (!running) {
				console.error(error('No orchestrator running.'))
				console.error(dim('Start with: autopilot start'))
				process.exit(1)
			}

			const compact = opts.compact ?? false
			const toolsOnly = opts.toolsOnly ?? false

			console.log('')
			console.log(`${header(`Attached to ${agentId}`)} ${dim('(polling every 2s)')}`)
			console.log(dim('   Press Ctrl+C to detach'))
			console.log('')
			printSeparator()

			let lastSeen: string | null = null
			let stopped = false

			const detach = () => {
				if (stopped) return
				stopped = true
				console.log('')
				printSeparator()
				console.log(success('Detached.'))
				process.exit(0)
			}

			process.on('SIGINT', detach)
			process.on('SIGTERM', detach)

			// Initial fetch — show recent activity
			try {
				const initial = await fetchActivity(agentId, 20)
				for (const entry of initial) {
					if (shouldShow(entry, toolsOnly)) {
						console.log(formatEntry(entry, compact))
					}
				}
				if (initial.length > 0) {
					lastSeen = initial[initial.length - 1]!.at
				}
			} catch {
				console.log(warning('Could not fetch initial activity, will keep polling...'))
			}

			// Poll loop
			const poll = async () => {
				if (stopped) return

				try {
					const entries = await fetchActivity(agentId, 50)
					const newEntries = lastSeen
						? entries.filter((e) => e.at > lastSeen!)
						: entries

					for (const entry of newEntries) {
						if (shouldShow(entry, toolsOnly)) {
							console.log(formatEntry(entry, compact))
						}
					}

					if (newEntries.length > 0) {
						lastSeen = newEntries[newEntries.length - 1]!.at
					}
				} catch {
					// orchestrator may have stopped
					console.log(warning('Connection lost. Retrying...'))
				}
			}

			const interval = setInterval(poll, POLL_INTERVAL)

			// Keep process alive
			await new Promise<void>((resolve) => {
				const cleanup = () => {
					clearInterval(interval)
					resolve()
				}
				process.on('SIGINT', cleanup)
				process.on('SIGTERM', cleanup)
			})
		}),
)

program.addCommand(
	new Command('replay')
		.description('Replay a recorded agent activity log')
		.argument('<agent>', 'Agent ID to replay activity for')
		.option('--limit <n>', 'Maximum number of entries to show', '50')
		.option('--compact', 'One line per event')
		.option('--tools-only', 'Only show tool_call and tool_result events')
		.action(async (agentId: string, opts: { limit?: string; compact?: boolean; toolsOnly?: boolean }) => {
			try {
				await findCompanyRoot()
			} catch {
				console.error(error('No company directory found.'))
				console.error(dim('Run "autopilot init" to create one first.'))
				process.exit(1)
			}

			const running = await checkOrchestrator()
			if (!running) {
				console.error(error('No orchestrator running.'))
				console.error(dim('Start with: autopilot start'))
				process.exit(1)
			}

			const limit = parseInt(opts.limit ?? '50', 10)
			const compact = opts.compact ?? false
			const toolsOnly = opts.toolsOnly ?? false

			console.log('')
			console.log(`${header(`Replay for ${agentId}`)} ${dim(`(last ${limit} entries)`)}`)
			console.log('')
			printSeparator()

			try {
				const entries = await fetchActivity(agentId, limit)

				if (entries.length === 0) {
					console.log(dim('  No activity found for this agent.'))
				} else {
					for (const entry of entries) {
						if (shouldShow(entry, toolsOnly)) {
							console.log(formatEntry(entry, compact))
						}
					}
				}

				printSeparator()
				console.log(dim(`${entries.length} entries`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
