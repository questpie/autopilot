import { Command } from 'commander'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, badge, dim, success, error, warning, separator } from '../utils/format'
import { getAuthHeaders } from './auth'
import { getBaseUrl } from '../utils/client'

const POLL_INTERVAL = 2000

function formatTime(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}

async function fetchChannelMessages(channel: string, limit?: number): Promise<Array<{ id: string; from: string; at: string; content: string }>> {
	const baseUrl = getBaseUrl()
	const url = new URL(`${baseUrl}/api/channels/${encodeURIComponent(channel)}/messages`)
	if (limit) url.searchParams.set('limit', String(limit))
	try {
		const res = await fetch(url.toString(), { headers: getAuthHeaders() })
		if (!res.ok) return []
		return (await res.json()) as Array<{ id: string; from: string; at: string; content: string }>
	} catch {
		return []
	}
}

async function postChannelMessage(channel: string, content: string): Promise<{ id: string } | null> {
	try {
		const baseUrl = getBaseUrl()
		const res = await fetch(`${baseUrl}/api/channels/${encodeURIComponent(channel)}/messages`, {
			method: 'POST',
			headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: 'human:owner', content }),
		})
		if (!res.ok) return null
		return (await res.json()) as { id: string }
	} catch {
		return null
	}
}

const channelsCmd = new Command('channels')
	.description('List and interact with communication channels')
	.action(async () => {
		try {
			const root = await findCompanyRoot()
			const dir = join(root, PATHS.CHANNELS_DIR.slice(1))

			let entries: string[]
			try {
				entries = await readdir(dir, { withFileTypes: true }).then(
					(e) => e.filter((d) => d.isDirectory()).map((d) => d.name),
				)
			} catch {
				entries = []
			}

			console.log(section('Channels'))
			if (entries.length === 0) {
				console.log(dim('  No channels found'))
				return
			}

			for (const name of entries.sort()) {
				const messages = await fetchChannelMessages(name)
				const count = messages.length
				const last = count > 0 ? messages[count - 1]! : null
				console.log(
					`  ${badge(name, 'cyan')}  ${dim(`${count} messages`)}${last ? `  ${dim(`last: ${formatTime(last.at)}`)}` : ''}`,
				)
			}
			console.log('')
			console.log(separator())
			console.log(dim(`${entries.length} channel(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

channelsCmd.addCommand(
	new Command('show')
		.description('Show messages in a channel')
		.argument('<channel>', 'Channel name')
		.option('-n, --limit <n>', 'Number of messages to show', '20')
		.option('-f, --follow', 'Live follow (poll every 2s)')
		.action(async (channel: string, opts: { limit?: string; follow?: boolean }) => {
			try {
				await findCompanyRoot()
				const limit = parseInt(opts.limit ?? '20', 10)

				console.log(section(`#${channel}`))
				console.log('')

				const printMessages = (messages: Array<{ from: string; at: string; content: string }>) => {
					for (const msg of messages) {
						const time = formatTime(msg.at)
						console.log(`  ${dim(time)} ${badge(msg.from, 'cyan')} ${msg.content}`)
					}
				}

				const messages = await fetchChannelMessages(channel, limit)
				if (messages.length === 0) {
					console.log(dim('  No messages yet'))
				} else {
					printMessages(messages)
				}

				if (!opts.follow) {
					console.log('')
					console.log(dim(`${messages.length} message(s)`))
					return
				}

				console.log('')
				console.log(dim('Following... (Ctrl+C to stop)'))

				let lastSeen = messages.length > 0 ? messages[messages.length - 1]!.at : null
				let stopped = false

				const stop = () => {
					if (stopped) return
					stopped = true
					console.log('')
					console.log(success('Stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', stop)
				process.on('SIGTERM', stop)

				const poll = async () => {
					if (stopped) return
					try {
						const all = await fetchChannelMessages(channel, 50)
						const fresh = lastSeen ? all.filter((m) => m.at > lastSeen!) : all
						if (fresh.length > 0) {
							printMessages(fresh)
							lastSeen = fresh[fresh.length - 1]!.at
						}
					} catch {
						console.log(warning('Poll error, retrying...'))
					}
				}

				const interval = setInterval(poll, POLL_INTERVAL)

				await new Promise<void>((resolve) => {
					const cleanup = () => {
						clearInterval(interval)
						resolve()
					}
					process.on('SIGINT', cleanup)
					process.on('SIGTERM', cleanup)
				})
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

channelsCmd.addCommand(
	new Command('send')
		.description('Send a message to a channel')
		.argument('<channel>', 'Channel name')
		.argument('<message>', 'Message content')
		.action(async (channel: string, message: string) => {
			try {
				await findCompanyRoot()

				const msg = await postChannelMessage(channel, message)

				if (!msg) {
					console.error(error(`Failed to send message to #${channel}`))
					process.exit(1)
				}

				console.log(success(`Message sent to #${channel}`))
				console.log(dim(`  ID: ${msg.id}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(channelsCmd)
