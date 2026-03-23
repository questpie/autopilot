import { Command } from 'commander'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readChannelMessages, sendChannelMessage } from '@questpie/autopilot-orchestrator'
import { PATHS } from '@questpie/autopilot-spec'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, success, error, warning } from '../utils/format'

const POLL_INTERVAL = 2000

function formatTime(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
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

			console.log(header('Channels'))
			if (entries.length === 0) {
				console.log(dim('  No channels found'))
				return
			}

			for (const name of entries.sort()) {
				const messages = await readChannelMessages(root, name)
				const count = messages.length
				const last = count > 0 ? messages[count - 1]! : null
				console.log(
					`  ${badge(name, 'cyan')}  ${dim(`${count} messages`)}${last ? `  ${dim(`last: ${formatTime(last.at)}`)}` : ''}`,
				)
			}
			console.log('')
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
				const root = await findCompanyRoot()
				const limit = parseInt(opts.limit ?? '20', 10)

				console.log(header(`#${channel}`))
				console.log('')

				const printMessages = (messages: Array<{ from: string; at: string; content: string }>) => {
					for (const msg of messages) {
						const time = formatTime(msg.at)
						console.log(`  ${dim(time)} ${badge(msg.from, 'cyan')} ${msg.content}`)
					}
				}

				const messages = await readChannelMessages(root, channel, limit)
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
						const all = await readChannelMessages(root, channel, 50)
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
				const root = await findCompanyRoot()

				const msg = await sendChannelMessage(root, channel, {
					from: 'human:owner',
					content: message,
				})

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
