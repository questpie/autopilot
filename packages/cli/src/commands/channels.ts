import { Command } from 'commander'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, badge, dim, success, error, warning, separator } from '../utils/format'
import { getClient } from '../utils/client'

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
			await findCompanyRoot()
			const client = getClient()

			const res = await client.api.channels.$get()
			if (!res.ok) {
				console.error(error('Failed to fetch channels'))
				process.exit(1)
			}

			const channels = (await res.json()) as Array<{
				id: string
				name: string
				type: string
				description?: string
			}>

			console.log(section('Channels'))
			if (channels.length === 0) {
				console.log(dim('  No channels found'))
				return
			}

			for (const ch of channels) {
				const typeLabel = ch.type === 'direct' ? '@' : '#'
				console.log(
					`  ${badge(`${typeLabel}${ch.name}`, 'cyan')}  ${dim(ch.type)}${ch.description ? `  ${dim(ch.description)}` : ''}`,
				)
			}
			console.log('')
			console.log(separator())
			console.log(dim(`${channels.length} channel(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

// ─── create ─────────────────────────────────────────────────────────────────

channelsCmd.addCommand(
	new Command('create')
		.description('Create a new channel')
		.argument('<name>', 'Channel name')
		.option('-t, --type <type>', 'Channel type (group, direct, broadcast)', 'group')
		.option('-d, --description <desc>', 'Channel description')
		.action(async (name: string, opts: { type?: string; description?: string }) => {
			try {
				await findCompanyRoot()
				const client = getClient()

				const res = await client.api.channels.$post({
					json: {
						name,
						type: (opts.type as 'group' | 'direct' | 'broadcast') ?? 'group',
						description: opts.description,
					},
				})

				if (!res.ok) {
					console.error(error(`Failed to create channel "${name}"`))
					process.exit(1)
				}

				const channel = (await res.json()) as { id: string; name: string }
				console.log(success(`Channel #${channel.name} created`))
				console.log(dim(`  ID: ${channel.id}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── show ───────────────────────────────────────────────────────────────────

channelsCmd.addCommand(
	new Command('show')
		.description('Show messages in a channel')
		.argument('<channel>', 'Channel name')
		.option('-n, --limit <n>', 'Number of messages to show', '20')
		.option('-f, --follow', 'Live follow (poll every 2s)')
		.action(async (channel: string, opts: { limit?: string; follow?: boolean }) => {
			try {
				await findCompanyRoot()
				const client = getClient()
				const limit = parseInt(opts.limit ?? '20', 10)

				console.log(section(`#${channel}`))
				console.log('')

				type Msg = { from: string; at: string; content: string }

				const fetchMessages = async (n: number): Promise<Msg[]> => {
					const res = await client.api.channels[':id'].messages.$get({
						param: { id: channel },
						query: { limit: String(n) },
					})
					if (!res.ok) return []
					return (await res.json()) as Msg[]
				}

				const printMessages = (messages: Msg[]) => {
					for (const msg of messages) {
						const time = formatTime(msg.at)
						console.log(`  ${dim(time)} ${badge(msg.from, 'cyan')} ${msg.content}`)
					}
				}

				const messages = await fetchMessages(limit)
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
						const all = await fetchMessages(50)
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
				process.exit(1)
			}
		}),
)

// ─── send ───────────────────────────────────────────────────────────────────

channelsCmd.addCommand(
	new Command('send')
		.description('Send a message to a channel')
		.argument('<channel>', 'Channel name')
		.argument('<message>', 'Message content')
		.action(async (channel: string, message: string) => {
			try {
				await findCompanyRoot()
				const client = getClient()

				const res = await client.api.channels[':id'].messages.$post({
					param: { id: channel },
					json: { content: message },
				})

				if (!res.ok) {
					console.error(error(`Failed to send message to #${channel}`))
					process.exit(1)
				}

				const msg = (await res.json()) as { id: string; routed_to?: string; route_reason?: string }
				console.log(success(`Message sent to #${channel}`))
				console.log(dim(`  ID: ${msg.id}`))
				if (msg.routed_to) {
					console.log(dim(`  Routed to: ${msg.routed_to} (${msg.route_reason})`))
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── members ────────────────────────────────────────────────────────────────

const membersCmd = new Command('members')
	.description('Manage channel membership')
	.argument('<channel>', 'Channel name')
	.action(async (channel: string) => {
		try {
			await findCompanyRoot()
			const client = getClient()

			const res = await client.api.channels[':id'].members.$get({
				param: { id: channel },
			})

			if (!res.ok) {
				console.error(error(`Failed to fetch members for #${channel}`))
				process.exit(1)
			}

			const members = (await res.json()) as Array<{
				actor_id: string
				actor_type: string
				role: string
				joined_at: string
			}>

			console.log(section(`#${channel} members`))
			if (members.length === 0) {
				console.log(dim('  No members'))
				return
			}

			for (const m of members) {
				const prefix = m.actor_type === 'agent' ? '🤖' : '👤'
				console.log(`  ${prefix} ${badge(m.actor_id, 'cyan')}  ${dim(m.role)}  ${dim(`joined ${formatTime(m.joined_at)}`)}`)
			}
			console.log('')
			console.log(dim(`${members.length} member(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

membersCmd.addCommand(
	new Command('add')
		.description('Add a member to a channel')
		.argument('<channel>', 'Channel name')
		.argument('<actor>', 'Actor ID (agent or human)')
		.option('-t, --type <type>', 'Actor type (human, agent)', 'agent')
		.option('-r, --role <role>', 'Member role (owner, member, readonly)', 'member')
		.action(async (channel: string, actor: string, opts: { type?: string; role?: string }) => {
			try {
				await findCompanyRoot()
				const client = getClient()

				const res = await client.api.channels[':id'].members.$put({
					param: { id: channel },
					json: {
						add: [{
							actor_id: actor,
							actor_type: (opts.type as 'human' | 'agent') ?? 'agent',
							role: (opts.role as 'owner' | 'member' | 'readonly') ?? 'member',
						}],
					},
				})

				if (!res.ok) {
					console.error(error(`Failed to add ${actor} to #${channel}`))
					process.exit(1)
				}

				console.log(success(`Added ${actor} to #${channel}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

membersCmd.addCommand(
	new Command('remove')
		.description('Remove a member from a channel')
		.argument('<channel>', 'Channel name')
		.argument('<actor>', 'Actor ID to remove')
		.action(async (channel: string, actor: string) => {
			try {
				await findCompanyRoot()
				const client = getClient()

				const res = await client.api.channels[':id'].members.$put({
					param: { id: channel },
					json: { remove: [actor] },
				})

				if (!res.ok) {
					console.error(error(`Failed to remove ${actor} from #${channel}`))
					process.exit(1)
				}

				console.log(success(`Removed ${actor} from #${channel}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

channelsCmd.addCommand(membersCmd)

program.addCommand(channelsCmd)
