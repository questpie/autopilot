import { z } from 'zod'
import type { StorageBackend } from '../../fs/storage'
import { createPin } from '../../fs/pins'
import { container } from '../../container'
import { dbFactory } from '../../db'
import type { ToolDefinition } from '../tools'
import { getIndexer } from './shared'

export function createMessageTool(storage: StorageBackend, _companyRoot: string): ToolDefinition {
	return {
		name: 'message',
		description: 'Send a message. Channel conventions: "dm-{agentId}" for DMs, "task-{id}" for task threads, "project-{name}" for project channels, or any existing channel name.',
		schema: z.object({
			channel: z.string().describe('Channel: "general", "task-052", "project-studio", "dm-max"'),
			content: z.string(),
			references: z.array(z.string()).optional().describe('Referenced file paths or task IDs'),
		}),
		execute: async (args, ctx) => {
			const isDmChannel = args.channel.startsWith('dm-')
			const isTaskOrProjectChannel = args.channel.startsWith('task-') || args.channel.startsWith('project-')

			// dm-{agentId} → auto-create DM channel
			if (isDmChannel) {
				const targetAgentId = args.channel.slice(3) // strip "dm-"
				const channel = await storage.getOrCreateDirectChannel(ctx.agentId, targetAgentId)

				const dmMsgId = `msg-${Date.now().toString(36)}`
				await storage.sendMessage({
					id: dmMsgId,
					from: ctx.agentId,
					channel: channel.id,
					at: new Date().toISOString(),
					content: args.content,
					mentions: [targetAgentId],
					references: args.references ?? [],
					reactions: [],
					thread: null,
					external: false,
				})

				getIndexer().then(idx => idx?.indexOne('message', dmMsgId, `DM to ${targetAgentId}`, args.content)).catch(() => {})

				ctx.eventBus.emit({ type: 'message', channel: channel.id, from: ctx.agentId, content: args.content })

				try {
					const { db } = await container.resolveAsync([dbFactory])
					await createPin(db.db, {
						type: 'info',
						title: `Message from ${ctx.agentId}`,
						content: args.content,
						group: 'agents',
						created_by: ctx.agentId,
						metadata: { agent_id: targetAgentId, task_id: undefined },
					})
				} catch { /* pin creation is best-effort */ }

				return { content: [{ type: 'text' as const, text: `Direct message sent to ${targetAgentId} in channel ${channel.id}` }] }
			}

			// Auto-create task/project channels on first message
			const existingChannel = await storage.readChannel(args.channel)
			if (!existingChannel) {
				if (isTaskOrProjectChannel) {
					const taskMatch = args.channel.match(/^task-(.+)$/)
					const projectMatch = args.channel.match(/^project-(.+)$/)
					const name = taskMatch
						? `Task ${taskMatch[1]}`
						: `Project ${projectMatch![1]}`

					await storage.createChannel({
						id: args.channel,
						name,
						type: 'group',
						description: taskMatch
							? `Discussion thread for task ${taskMatch[1]}`
							: `Discussion channel for project ${projectMatch![1]}`,
						created_by: ctx.agentId,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						metadata: {},
					})

					await storage.addChannelMember(args.channel, ctx.agentId, 'agent', 'member')
					ctx.eventBus.emit({ type: 'channel_created', channelId: args.channel, name })
				} else {
					return { content: [{ type: 'text' as const, text: `Channel "${args.channel}" not found.` }] }
				}
			}

			// Auto-join task/project channels
			const isMember = await storage.isChannelMember(args.channel, ctx.agentId)
			if (!isMember) {
				if (isTaskOrProjectChannel) {
					await storage.addChannelMember(args.channel, ctx.agentId, 'agent', 'member')
				} else {
					return { content: [{ type: 'text' as const, text: `Not a member of channel "${args.channel}".` }] }
				}
			}

			const msgId = `msg-${Date.now().toString(36)}`
			await storage.sendMessage({
				id: msgId,
				from: ctx.agentId,
				channel: args.channel,
				at: new Date().toISOString(),
				content: args.content,
				mentions: [],
				references: args.references ?? [],
				reactions: [],
				thread: null,
				external: false,
			})

			ctx.eventBus.emit({ type: 'message', channel: args.channel, from: ctx.agentId, content: args.content })
			// Real-time index
			getIndexer().then((idx) => idx?.indexOne('message', msgId, `#${args.channel}`, args.content)).catch(() => {})

			return { content: [{ type: 'text' as const, text: `Message sent to #${args.channel}` }] }
		},
	}
}
