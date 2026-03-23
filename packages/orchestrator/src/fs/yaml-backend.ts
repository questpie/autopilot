import type { StorageBackend, Task, Message, TaskFilter, MessageFilter, ActivityEntry, ActivityFilter } from './storage'
import * as taskOps from './tasks'
import * as messageOps from './messages'
import * as activityOps from './activity'

/**
 * Wraps the existing YAML-based file operations behind StorageBackend.
 * Zero changes to existing behavior — this is just an adapter.
 */
export class YamlFsBackend implements StorageBackend {
	constructor(private companyRoot: string) {}

	async initialize(): Promise<void> {
		// No-op — directories already exist from template
	}

	async close(): Promise<void> {
		// No-op — no connections to close
	}

	// ─── Tasks ──────────────────────────────────────────────────────────

	async createTask(task: Task): Promise<Task> {
		return taskOps.createTask(this.companyRoot, task)
	}

	async readTask(id: string): Promise<Task | null> {
		return taskOps.readTask(this.companyRoot, id)
	}

	async updateTask(id: string, updates: Partial<Task>, updatedBy: string): Promise<Task> {
		return taskOps.updateTask(this.companyRoot, id, updates, updatedBy)
	}

	async moveTask(id: string, newStatus: string, movedBy: string): Promise<Task> {
		return taskOps.moveTask(
			this.companyRoot,
			id,
			newStatus as Parameters<typeof taskOps.moveTask>[2],
			movedBy,
		)
	}

	async listTasks(filter?: TaskFilter): Promise<Task[]> {
		return taskOps.listTasks(this.companyRoot, {
			status: filter?.status,
			agent: filter?.assigned_to,
			project: filter?.project,
		})
	}

	async countTasks(filter?: TaskFilter): Promise<number> {
		const tasks = await this.listTasks(filter)
		return tasks.length
	}

	async deleteTask(_id: string): Promise<void> {
		const found = await taskOps.findTask(this.companyRoot, _id)
		if (found) {
			const { rm } = await import('node:fs/promises')
			await rm(found.path)
		}
	}

	// ─── Messages ───────────────────────────────────────────────────────

	async sendMessage(msg: Message): Promise<Message> {
		if (msg.channel) {
			return messageOps.sendChannelMessage(this.companyRoot, msg.channel, {
				id: msg.id,
				from: msg.from,
				at: msg.at,
				content: msg.content,
				mentions: msg.mentions,
				references: msg.references,
				thread: msg.thread,
				transport: msg.transport,
				external: msg.external,
			})
		}
		if (msg.to) {
			return messageOps.sendDirectMessage(this.companyRoot, msg.from, msg.to, {
				id: msg.id,
				at: msg.at,
				content: msg.content,
				mentions: msg.mentions,
				references: msg.references,
				thread: msg.thread,
				transport: msg.transport,
				external: msg.external,
			})
		}
		throw new Error('Message must have either channel or to')
	}

	async readMessages(filter: MessageFilter): Promise<Message[]> {
		if (filter.channel) {
			return messageOps.readChannelMessages(
				this.companyRoot,
				filter.channel,
				filter.limit,
			)
		}
		return []
	}

	async searchMessages(_query: string): Promise<Message[]> {
		// YAML backend does not support full-text search
		console.warn('[yaml-backend] searchMessages not supported — use sqlite backend')
		return []
	}

	// ─── Activity ───────────────────────────────────────────────────────

	async appendActivity(entry: ActivityEntry): Promise<void> {
		await activityOps.appendActivity(this.companyRoot, entry)
	}

	async readActivity(filter?: ActivityFilter): Promise<ActivityEntry[]> {
		return activityOps.readActivity(this.companyRoot, {
			date: filter?.date,
			limit: filter?.limit,
			agent: filter?.agent,
			type: filter?.type,
		})
	}
}
