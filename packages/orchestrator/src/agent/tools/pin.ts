import { z } from 'zod'
import { createPin, removePin } from '../../fs/pins'
import { container } from '../../container'
import { dbFactory } from '../../db'
import type { ToolDefinition } from '../tools'
import { getIndexer } from './shared'

export function createPinTool(_companyRoot: string): ToolDefinition {
	return {
		name: 'pin',
		description: 'Pin or unpin items on the dashboard. Use action "create" to pin, "remove" to unpin.',
		schema: z.object({
			action: z.enum(['create', 'remove']),
			pin_id: z.string().optional().describe('Required for remove'),
			group: z.string().optional().describe('For create: "alerts", "overview", "agents", "recent"'),
			title: z.string().optional().describe('For create'),
			content: z.string().optional().describe('For create'),
			type: z.enum(['info', 'warning', 'success', 'error', 'progress']).optional().describe('For create'),
			metadata: z.record(z.unknown()).optional().describe('For create'),
		}),
		execute: async (args, ctx) => {
			const { db } = await container.resolveAsync([dbFactory])

			if (args.action === 'create') {
				if (!args.title || !args.type) {
					return { content: [{ type: 'text' as const, text: 'Error: title and type are required for pin create' }], isError: true }
				}
				const pinId = `pin-${Date.now().toString(36)}`
				await createPin(db.db, {
					id: pinId,
					group: args.group ?? 'recent',
					title: args.title,
					content: args.content ?? '',
					type: args.type,
					created_by: ctx.agentId,
					created_at: new Date().toISOString(),
					metadata: args.metadata ?? {},
				})
				// Real-time index
				getIndexer().then((idx) => idx?.indexOne('pin', pinId, args.title!, `${args.title} ${args.content ?? ''}`)).catch(() => {})
				return { content: [{ type: 'text' as const, text: `Pinned: ${args.title}` }] }
			}

			// remove
			if (!args.pin_id) {
				return { content: [{ type: 'text' as const, text: 'Error: pin_id is required for remove' }], isError: true }
			}
			await removePin(db.db, args.pin_id)
			return { content: [{ type: 'text' as const, text: `Unpinned: ${args.pin_id}` }] }
		},
	}
}
