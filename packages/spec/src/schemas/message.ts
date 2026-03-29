import { z } from 'zod'

export const AttachmentSchema = z.object({
	id: z.string(),
	filename: z.string(),
	size: z.number(),
	mime_type: z.string(),
	url: z.string(),
})

export const MessageSchema = z.object({
	id: z.string(),
	from: z.string(),
	to: z.string().optional(),
	channel: z.string().optional(),
	at: z.string().datetime(),
	content: z.string(),
	mentions: z.array(z.string()).default([]),
	references: z.array(z.string()).default([]),
	reactions: z.array(z.string()).default([]),
	thread: z.string().nullable().default(null),
	transport: z.string().optional(),
	external: z.boolean().default(false),
	metadata: z.record(z.string(), z.unknown()).optional(),
	attachments: z.array(AttachmentSchema).optional(),
	thread_id: z.string().optional(),
	edited_at: z.string().optional(),
})

// ─── Reactions ─────────────────────────────────────────────────────────────

export const ReactionSchema = z.object({
	id: z.string(),
	message_id: z.string(),
	emoji: z.string(),
	user_id: z.string(),
	created_at: z.string(),
})

// ─── Pinned Messages ──────────────────────────────────────────────────────

export const PinnedMessageSchema = z.object({
	id: z.string(),
	channel_id: z.string(),
	message_id: z.string(),
	pinned_by: z.string(),
	pinned_at: z.string(),
})

// ─── Bookmarks ────────────────────────────────────────────────────────────

export const BookmarkSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	message_id: z.string(),
	channel_id: z.string(),
	created_at: z.string(),
})
