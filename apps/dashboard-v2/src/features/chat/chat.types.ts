import { api } from '@/lib/api'
import type { InferResponseType } from 'hono/client'

export type Message = InferResponseType<
	(typeof api.api)['chat-sessions'][':id']['messages']['$get'],
	200
>[number]

export type MessageAttachment = NonNullable<Message['attachments']>[number]

export interface ToolCallState {
	id: string
	tool: string
	toolCallId?: string
	params?: Record<string, unknown>
	displayLabel?: string
	displayMeta?: string
	status: 'running' | 'completed' | 'error'
	result?: string
	startedAt: number
	completedAt?: number
}
