import type { z } from 'zod'
import type { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'

export type Task = z.output<typeof TaskSchema>
export type Message = z.output<typeof MessageSchema>

export interface TaskFilter {
	status?: string
	assigned_to?: string
	project?: string
	workflow?: string
	workflow_step?: string
	parent?: string
	priority?: string
	milestone?: string
	limit?: number
	offset?: number
	order_by?: 'created_at' | 'updated_at' | 'priority'
	order_dir?: 'asc' | 'desc'
}

export interface MessageFilter {
	channel?: string
	from_id?: string
	to_id?: string
	thread?: string
	limit?: number
	offset?: number
}

export interface ActivityEntry {
	at: string
	agent: string
	type: string
	summary: string
	details?: Record<string, unknown>
}

export interface ActivityFilter {
	agent?: string
	type?: string
	date?: string
	limit?: number
}

export interface StorageBackend {
	// Lifecycle
	initialize(): Promise<void>
	close(): Promise<void>

	// Tasks
	createTask(task: Task): Promise<Task>
	readTask(id: string): Promise<Task | null>
	updateTask(id: string, updates: Partial<Task>, updatedBy: string): Promise<Task>
	moveTask(id: string, newStatus: string, movedBy: string, blocker?: { reason: string; assigned_to?: string }): Promise<Task>
	listTasks(filter?: TaskFilter): Promise<Task[]>
	countTasks(filter?: TaskFilter): Promise<number>
	deleteTask(id: string): Promise<void>

	// Messages
	sendMessage(msg: Message): Promise<Message>
	readMessages(filter: MessageFilter): Promise<Message[]>
	searchMessages(query: string, limit?: number): Promise<Message[]>

	// Activity
	appendActivity(entry: ActivityEntry): Promise<void>
	readActivity(filter?: ActivityFilter): Promise<ActivityEntry[]>
}
