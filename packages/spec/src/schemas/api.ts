import { z } from 'zod'
import { PinSchema } from './pin'
import { TaskSchema } from './task'

export const StatusResponseSchema = z.object({
	company: z.string(),
	userCount: z.number(),
	setupCompleted: z.boolean(),
	onboardingChatCompleted: z.boolean(),
	agentCount: z.number(),
	activeTasks: z.number(),
	runningSessions: z.number(),
	pendingApprovals: z.number(),
})

export const InboxResponseSchema = z.object({
	tasks: z.array(TaskSchema),
	pins: z.array(PinSchema),
})

export const ChatRequestSchema = z.object({
	message: z.string(),
	channel: z.string().optional(),
})

export const SearchResultSchema = z.object({
	entityType: z.string(),
	entityId: z.string(),
	title: z.string().nullable(),
	snippet: z.string().nullable(),
	score: z.number(),
})

export const SearchResponseSchema = z.object({
	results: z.array(SearchResultSchema),
	query: z.string(),
	mode: z.string(),
	total: z.number(),
})

export const FsEntrySchema = z.object({
	name: z.string(),
	type: z.enum(['file', 'directory']),
	size: z.number(),
})

export const TaskQuerySchema = z.object({
	status: z.string().optional(),
	agent: z.string().optional(),
	project: z.string().optional(),
})

export const ActivityQuerySchema = z.object({
	agent: z.string().optional(),
	limit: z.coerce.number().optional(),
})

export const SearchQuerySchema = z.object({
	q: z.string(),
	type: z.string().optional(),
	mode: z.enum(['fts', 'hybrid']).optional().default('hybrid'),
	limit: z.coerce.number().optional().default(20),
})

export const TaskRejectRequestSchema = z.object({
	reason: z.string().optional(),
})

export const FileWriteRequestSchema = z.object({
	content: z.string(),
})

export const OkResponseSchema = z.object({
	ok: z.literal(true),
})
