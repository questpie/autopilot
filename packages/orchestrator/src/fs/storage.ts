import type { z } from 'zod'
import type { TaskSchema, MessageSchema, ChannelSchema, ChannelMemberSchema, ReactionSchema, PinnedMessageSchema, BookmarkSchema } from '@questpie/autopilot-spec'

export type Task = z.output<typeof TaskSchema>
export type Message = z.output<typeof MessageSchema>
export type Channel = z.output<typeof ChannelSchema>
export type ChannelMember = z.output<typeof ChannelMemberSchema>
export type Reaction = z.output<typeof ReactionSchema>
export type PinnedMessage = z.output<typeof PinnedMessageSchema>
export type Bookmark = z.output<typeof BookmarkSchema>

/** Input type for creating a task — `id` is optional (auto-generated if omitted). */
export type TaskCreateInput = Omit<z.input<typeof TaskSchema>, 'id'> & { id?: string }

/** Input type for sending a message — mirrors the schema output (all fields provided). */
export type MessageCreateInput = z.input<typeof MessageSchema>

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
	thread_id?: string
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

export interface ChannelFilter {
	type?: string
	actor_id?: string
}

export interface StorageBackend {
	// Lifecycle
	initialize(): Promise<void>
	close(): Promise<void>

	// Tasks
	createTask(task: TaskCreateInput): Promise<Task>
	readTask(id: string): Promise<Task | null>
	updateTask(id: string, updates: Partial<Task>, updatedBy: string): Promise<Task>
	moveTask(id: string, newStatus: string, movedBy: string, blocker?: { reason: string; assigned_to?: string }): Promise<Task>
	listTasks(filter?: TaskFilter): Promise<Task[]>
	countTasks(filter?: TaskFilter): Promise<number>
	deleteTask(id: string): Promise<void>

	// Messages
	sendMessage(msg: MessageCreateInput): Promise<Message>
	readMessages(filter: MessageFilter): Promise<Message[]>
	readMessage(id: string): Promise<Message | null>
	updateMessage(id: string, content: string): Promise<Message>
	deleteMessage(id: string): Promise<void>
	searchMessages(query: string, limit?: number): Promise<Message[]>

	// Activity
	appendActivity(entry: ActivityEntry): Promise<void>
	readActivity(filter?: ActivityFilter): Promise<ActivityEntry[]>

	// Channels
	createChannel(channel: Channel): Promise<Channel>
	readChannel(id: string): Promise<(Channel & { members: ChannelMember[] }) | null>
	listChannels(filter?: ChannelFilter): Promise<Channel[]>
	deleteChannel(id: string): Promise<void>

	// Channel Members
	addChannelMember(channelId: string, actorId: string, actorType: string, role?: string): Promise<void>
	removeChannelMember(channelId: string, actorId: string): Promise<void>
	getChannelMembers(channelId: string): Promise<ChannelMember[]>
	isChannelMember(channelId: string, actorId: string): Promise<boolean>
	getOrCreateDirectChannel(actorA: string, actorB: string): Promise<Channel>

	// Reactions
	addReaction(messageId: string, emoji: string, userId: string): Promise<Reaction>
	removeReaction(messageId: string, emoji: string, userId: string): Promise<void>
	getReactions(messageId: string): Promise<Reaction[]>

	// Pinned Messages
	pinMessage(channelId: string, messageId: string, pinnedBy: string): Promise<PinnedMessage>
	unpinMessage(channelId: string, messageId: string): Promise<void>
	getPinnedMessages(channelId: string): Promise<PinnedMessage[]>

	// Bookmarks
	addBookmark(userId: string, messageId: string, channelId: string): Promise<Bookmark>
	removeBookmark(userId: string, messageId: string): Promise<void>
	getBookmarks(userId: string): Promise<Bookmark[]>
}
