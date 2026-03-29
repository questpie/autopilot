import { z } from 'zod'

// ─── Channel Entity ────────────────────────────────────────────────────────

export const ChannelSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(['group', 'direct', 'broadcast']),
	description: z.string().optional(),
	created_by: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
	metadata: z.record(z.unknown()).default({}),
})

export const ChannelMemberSchema = z.object({
	channel_id: z.string(),
	actor_id: z.string(),
	actor_type: z.enum(['human', 'agent']),
	role: z.enum(['owner', 'member', 'readonly']).default('member'),
	joined_at: z.string(),
})

// ─── API Request Schemas ───────────────────────────────────────────────────

export const CreateChannelRequestSchema = z.object({
	name: z.string().min(1).max(50),
	type: z.enum(['group', 'direct', 'broadcast']).default('group'),
	description: z.string().optional(),
	members: z.array(z.object({
		actor_id: z.string(),
		actor_type: z.enum(['human', 'agent']),
	})).optional(),
})

export const ChannelMessagesQuerySchema = z.object({
	limit: z.coerce.number().optional().default(50),
	thread_id: z.string().optional(),
})

export const SendChannelMessageRequestSchema = z.object({
	content: z.string().min(1),
	thread: z.string().optional(),
	thread_id: z.string().optional(),
	mentions: z.array(z.string()).optional(),
	references: z.array(z.string()).optional(),
})

export const ManageMembersRequestSchema = z.object({
	add: z.array(z.object({
		actor_id: z.string(),
		actor_type: z.enum(['human', 'agent']),
		role: z.enum(['owner', 'member', 'readonly']).optional(),
	})).optional(),
	remove: z.array(z.string()).optional(),
})
