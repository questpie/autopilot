import { container, companyRootFactory } from '../container'
import { eq, and, sql, desc, asc } from 'drizzle-orm'
import { Database } from 'bun:sqlite'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'
import { createDb, initFts, type AutopilotDb } from '../db'
import { schema } from '../db'
import type { StorageBackend, Task, Message, Channel, ChannelMember, TaskFilter, MessageFilter, ActivityEntry, ActivityFilter, ChannelFilter } from './storage'

/**
 * Convert all `null` values in an object to `undefined`.
 * SQLite returns NULL for missing optional columns, but Zod .optional()
 * does not accept null — only undefined.
 */
function nullsToUndefined(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(obj)) {
		result[key] = value === null ? undefined : value
	}
	return result
}

/**
 * SQLite-backed storage using Drizzle ORM over bun:sqlite.
 *
 * All tables live in a single `autopilot.db` file at `<companyRoot>/.data/`.
 * FTS5 virtual tables provide full-text search on messages.
 */
export class SqliteBackend implements StorageBackend {
	private db!: AutopilotDb

	constructor(private companyRoot: string) {}

	async initialize(): Promise<void> {
		const { db } = await createDb(this.companyRoot)
		this.db = db

		// Drizzle migrations handle all table creation (see drizzle/ folder).
		// FTS5 virtual tables + triggers are initialized separately since
		// Drizzle ORM does not support virtual tables.
		initFts(this.db)
	}

	private getRawDb(): Database {
		return (this.db as unknown as { $client: Database }).$client
	}

	async close(): Promise<void> {
		this.getRawDb().close()
	}

	/** Expose the Drizzle DB instance for external use (e.g. knowledge index). */
	getDb(): AutopilotDb {
		return this.db
	}

	// ─── Tasks ──────────────────────────────────────────────────────────

	async createTask(task: Task): Promise<Task> {
		await this.db.insert(schema.tasks).values({
			id: task.id,
			title: task.title,
			description: task.description,
			type: task.type,
			status: task.status,
			priority: task.priority,
			created_by: task.created_by,
			assigned_to: task.assigned_to ?? null,
			reviewers: JSON.stringify(task.reviewers),
			approver: task.approver ?? null,
			project: task.project ?? null,
			parent: task.parent ?? null,
			depends_on: JSON.stringify(task.depends_on),
			blocks: JSON.stringify(task.blocks),
			related: JSON.stringify(task.related),
			workflow: task.workflow ?? null,
			workflow_step: task.workflow_step ?? null,
			context: JSON.stringify(task.context),
			blockers: JSON.stringify(task.blockers),
			resources: JSON.stringify((task as Record<string, unknown>).resources ?? []),
			labels: JSON.stringify((task as Record<string, unknown>).labels ?? []),
			milestone: (task as Record<string, unknown>).milestone as string ?? null,
			created_at: task.created_at ?? new Date().toISOString(),
			updated_at: task.updated_at ?? new Date().toISOString(),
			started_at: task.started_at ?? null,
			completed_at: task.completed_at ?? null,
			deadline: task.deadline ?? null,
			history: JSON.stringify(task.history),
			metadata: JSON.stringify(task.metadata ?? {}),
		})

		return task
	}

	async readTask(id: string): Promise<Task | null> {
		const rows = await this.db
			.select()
			.from(schema.tasks)
			.where(eq(schema.tasks.id, id))
			.limit(1)

		if (rows.length === 0) return null
		return this.rowToTask(rows[0]!)
	}

	async updateTask(id: string, updates: Partial<Task>, updatedBy: string): Promise<Task> {
		const existing = await this.readTask(id)
		if (!existing) throw new Error(`Task not found: ${id}`)

		const timestamp = new Date().toISOString()
		const historyEntry = {
			at: timestamp,
			by: updatedBy,
			action: 'updated',
			note: Object.keys(updates).join(', '),
		}

		const merged = {
			...existing,
			...updates,
			id: existing.id,
			created_at: existing.created_at,
			updated_at: timestamp,
			history: [...existing.history, historyEntry],
		}

		const validated = TaskSchema.parse(merged)

		await this.db.update(schema.tasks).set({
			title: validated.title,
			description: validated.description,
			type: validated.type,
			status: validated.status,
			priority: validated.priority,
			assigned_to: validated.assigned_to ?? null,
			reviewers: JSON.stringify(validated.reviewers),
			approver: validated.approver ?? null,
			project: validated.project ?? null,
			parent: validated.parent ?? null,
			depends_on: JSON.stringify(validated.depends_on),
			blocks: JSON.stringify(validated.blocks),
			related: JSON.stringify(validated.related),
			workflow: validated.workflow ?? null,
			workflow_step: validated.workflow_step ?? null,
			context: JSON.stringify(validated.context),
			blockers: JSON.stringify(validated.blockers),
			updated_at: validated.updated_at,
			started_at: validated.started_at ?? null,
			completed_at: validated.completed_at ?? null,
			deadline: validated.deadline ?? null,
			history: JSON.stringify(validated.history),
			metadata: JSON.stringify(validated.metadata ?? {}),
		}).where(eq(schema.tasks.id, id))

		return validated
	}

	async moveTask(id: string, newStatus: string, movedBy: string, blocker?: { reason: string; assigned_to?: string }): Promise<Task> {
		const existing = await this.readTask(id)
		if (!existing) throw new Error(`Task not found: ${id}`)

		const timestamp = new Date().toISOString()
		const historyEntry = {
			at: timestamp,
			by: movedBy,
			action: 'status_changed',
			from: existing.status,
			to: newStatus,
		}

		const newBlockers = blocker && newStatus === 'blocked'
			? [...existing.blockers, { type: 'human_required', reason: blocker.reason, assigned_to: blocker.assigned_to ?? movedBy, resolved: false }]
			: existing.blockers

		const validated = TaskSchema.parse({
			...existing,
			status: newStatus,
			updated_at: timestamp,
			started_at: newStatus === 'in_progress'
				? (existing.started_at ?? timestamp)
				: existing.started_at,
			completed_at: newStatus === 'done' ? timestamp : existing.completed_at,
			history: [...existing.history, historyEntry],
			blockers: newBlockers,
		})

		await this.db.update(schema.tasks).set({
			status: validated.status,
			updated_at: validated.updated_at,
			started_at: validated.started_at ?? null,
			completed_at: validated.completed_at ?? null,
			history: JSON.stringify(validated.history),
			blockers: JSON.stringify(validated.blockers),
		}).where(eq(schema.tasks.id, id))

		await this.appendActivity({
			agent: movedBy,
			type: 'task_status_changed',
			summary: `Task "${existing.title}" moved from ${existing.status} to ${newStatus}`,
			details: { taskId: id, from: existing.status, to: newStatus, by: movedBy },
		})

		return validated
	}

	async listTasks(filter?: TaskFilter): Promise<Task[]> {
		const conditions: ReturnType<typeof eq>[] = []

		if (filter?.status) conditions.push(eq(schema.tasks.status, filter.status))
		if (filter?.assigned_to) conditions.push(eq(schema.tasks.assigned_to, filter.assigned_to))
		if (filter?.project) conditions.push(eq(schema.tasks.project, filter.project))
		if (filter?.workflow) conditions.push(eq(schema.tasks.workflow, filter.workflow))
		if (filter?.workflow_step) conditions.push(eq(schema.tasks.workflow_step, filter.workflow_step))
		if (filter?.parent) conditions.push(eq(schema.tasks.parent, filter.parent))
		if (filter?.priority) conditions.push(eq(schema.tasks.priority, filter.priority))
		if (filter?.milestone) conditions.push(eq(schema.tasks.milestone, filter.milestone))

		const orderCol = filter?.order_by === 'updated_at'
			? schema.tasks.updated_at
			: filter?.order_by === 'priority'
				? schema.tasks.priority
				: schema.tasks.created_at

		const orderFn = filter?.order_dir === 'asc' ? asc : desc

		const query = this.db
			.select()
			.from(schema.tasks)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(orderFn(orderCol))
			.limit(filter?.limit ?? 1000)
			.offset(filter?.offset ?? 0)

		const rows = await query
		return rows.map((row) => this.rowToTask(row))
	}

	async countTasks(filter?: TaskFilter): Promise<number> {
		const conditions: ReturnType<typeof eq>[] = []

		if (filter?.status) conditions.push(eq(schema.tasks.status, filter.status))
		if (filter?.assigned_to) conditions.push(eq(schema.tasks.assigned_to, filter.assigned_to))
		if (filter?.project) conditions.push(eq(schema.tasks.project, filter.project))

		const result = await this.db
			.select({ count: sql<number>`COUNT(*)` })
			.from(schema.tasks)
			.where(conditions.length > 0 ? and(...conditions) : undefined)

		return result[0]?.count ?? 0
	}

	async deleteTask(id: string): Promise<void> {
		await this.db.delete(schema.tasks).where(eq(schema.tasks.id, id))
	}

	// ─── Messages ───────────────────────────────────────────────────────

	async sendMessage(msg: Message): Promise<Message> {
		await this.db.insert(schema.messages).values({
			id: msg.id,
			channel: msg.channel ?? null,
			from_id: msg.from,
			to_id: msg.to ?? null,
			content: msg.content,
			created_at: msg.at,
			mentions: JSON.stringify(msg.mentions),
			references_ids: JSON.stringify(msg.references),
			reactions: JSON.stringify(msg.reactions),
			thread: msg.thread ?? null,
			transport: msg.transport ?? null,
			external: msg.external,
		})

		return msg
	}

	async readMessages(filter: MessageFilter): Promise<Message[]> {
		const conditions: ReturnType<typeof eq>[] = []

		if (filter.channel) conditions.push(eq(schema.messages.channel, filter.channel))
		if (filter.from_id) conditions.push(eq(schema.messages.from_id, filter.from_id))
		if (filter.to_id) conditions.push(eq(schema.messages.to_id, filter.to_id))
		if (filter.thread) conditions.push(eq(schema.messages.thread, filter.thread))

		const rows = await this.db
			.select()
			.from(schema.messages)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(schema.messages.created_at))
			.limit(filter.limit ?? 100)
			.offset(filter.offset ?? 0)

		return rows.map((row) => this.rowToMessage(row))
	}

	async searchMessages(query: string, limit = 50): Promise<Message[]> {
		const raw = this.getRawDb()
		const rows = raw.prepare(`
			SELECT m.* FROM messages m
			JOIN messages_fts fts ON m.rowid = fts.rowid
			WHERE messages_fts MATCH ?
			ORDER BY rank
			LIMIT ?
		`).all(query, limit) as Record<string, unknown>[]

		return rows.map((row) => this.rowToMessage(row))
	}

	// ─── Activity ───────────────────────────────────────────────────────

	async appendActivity(entry: ActivityEntry): Promise<void> {
		const timestamp = entry.at ?? new Date().toISOString()

		await this.db.insert(schema.activity).values({
			agent: entry.agent,
			type: entry.type,
			summary: entry.summary,
			details: entry.details ? JSON.stringify(entry.details) : null,
			created_at: timestamp,
		})
	}

	async readActivity(filter?: ActivityFilter): Promise<ActivityEntry[]> {
		const conditions: ReturnType<typeof eq>[] = []

		if (filter?.agent) conditions.push(eq(schema.activity.agent, filter.agent))
		if (filter?.type) conditions.push(eq(schema.activity.type, filter.type))
		if (filter?.date) {
			conditions.push(
				sql`${schema.activity.created_at} >= ${filter.date + 'T00:00:00.000Z'}` as ReturnType<typeof eq>,
			)
			conditions.push(
				sql`${schema.activity.created_at} < ${filter.date + 'T23:59:59.999Z'}` as ReturnType<typeof eq>,
			)
		}

		const rows = await this.db
			.select()
			.from(schema.activity)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(schema.activity.created_at))
			.limit(filter?.limit ?? 100)

		return rows.map((row) => ({
			at: row.created_at,
			agent: row.agent,
			type: row.type,
			summary: row.summary,
			details: row.details ? JSON.parse(row.details) : undefined,
		}))
	}

	// ─── Channels ──────────────────────────────────────────────────────

	async createChannel(channel: Channel): Promise<Channel> {
		await this.db.insert(schema.channels).values({
			id: channel.id,
			name: channel.name,
			type: channel.type,
			description: channel.description ?? null,
			created_by: channel.created_by,
			created_at: channel.created_at,
			updated_at: channel.updated_at,
			metadata: JSON.stringify(channel.metadata ?? {}),
		})
		return channel
	}

	async readChannel(id: string): Promise<(Channel & { members: ChannelMember[] }) | null> {
		const rows = await this.db
			.select()
			.from(schema.channels)
			.where(eq(schema.channels.id, id))
			.limit(1)

		if (rows.length === 0) return null

		const row = rows[0]!
		const members = await this.getChannelMembers(id)

		return {
			id: row.id,
			name: row.name,
			type: row.type as Channel['type'],
			description: row.description ?? undefined,
			created_by: row.created_by,
			created_at: row.created_at,
			updated_at: row.updated_at,
			metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
			members,
		}
	}

	async listChannels(filter?: ChannelFilter): Promise<Channel[]> {
		if (filter?.actor_id) {
			// Join with channel_members to filter by membership
			const rows = await this.db
				.select({
					id: schema.channels.id,
					name: schema.channels.name,
					type: schema.channels.type,
					description: schema.channels.description,
					created_by: schema.channels.created_by,
					created_at: schema.channels.created_at,
					updated_at: schema.channels.updated_at,
					metadata: schema.channels.metadata,
				})
				.from(schema.channels)
				.innerJoin(schema.channelMembers, eq(schema.channels.id, schema.channelMembers.channel_id))
				.where(eq(schema.channelMembers.actor_id, filter.actor_id))
				.orderBy(asc(schema.channels.name))

			return rows.map((row) => this.rowToChannel(row))
		}

		const conditions: ReturnType<typeof eq>[] = []
		if (filter?.type) conditions.push(eq(schema.channels.type, filter.type))

		const rows = await this.db
			.select()
			.from(schema.channels)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(schema.channels.name))

		return rows.map((row) => this.rowToChannel(row))
	}

	async deleteChannel(id: string): Promise<void> {
		await this.db.delete(schema.channelMembers).where(eq(schema.channelMembers.channel_id, id))
		await this.db.delete(schema.channels).where(eq(schema.channels.id, id))
	}

	async addChannelMember(channelId: string, actorId: string, actorType: string, role?: string): Promise<void> {
		await this.db.insert(schema.channelMembers).values({
			channel_id: channelId,
			actor_id: actorId,
			actor_type: actorType,
			role: role ?? 'member',
			joined_at: new Date().toISOString(),
		}).onConflictDoNothing()
	}

	async removeChannelMember(channelId: string, actorId: string): Promise<void> {
		await this.db.delete(schema.channelMembers).where(
			and(
				eq(schema.channelMembers.channel_id, channelId),
				eq(schema.channelMembers.actor_id, actorId),
			),
		)
	}

	async getChannelMembers(channelId: string): Promise<ChannelMember[]> {
		const rows = await this.db
			.select()
			.from(schema.channelMembers)
			.where(eq(schema.channelMembers.channel_id, channelId))

		return rows.map((row) => ({
			channel_id: row.channel_id,
			actor_id: row.actor_id,
			actor_type: row.actor_type as ChannelMember['actor_type'],
			role: (row.role ?? 'member') as ChannelMember['role'],
			joined_at: row.joined_at,
		}))
	}

	async isChannelMember(channelId: string, actorId: string): Promise<boolean> {
		const result = await this.db
			.select({ count: sql<number>`COUNT(*)` })
			.from(schema.channelMembers)
			.where(
				and(
					eq(schema.channelMembers.channel_id, channelId),
					eq(schema.channelMembers.actor_id, actorId),
				),
			)
		return (result[0]?.count ?? 0) > 0
	}

	async getOrCreateDirectChannel(actorA: string, actorB: string): Promise<Channel> {
		const [idA, idB] = [actorA, actorB].sort()
		const candidateId = `dm-${idA}--${idB}`

		const existing = await this.readChannel(candidateId)
		if (existing) return existing

		const now = new Date().toISOString()
		const channel: Channel = {
			id: candidateId,
			name: `${idA} & ${idB}`,
			type: 'direct',
			created_by: actorA,
			created_at: now,
			updated_at: now,
			metadata: {},
		}

		// Use INSERT OR IGNORE to handle concurrent creation race condition
		await this.db.insert(schema.channels).values({
			id: channel.id,
			name: channel.name,
			type: channel.type,
			description: null,
			created_by: channel.created_by,
			created_at: channel.created_at,
			updated_at: channel.updated_at,
			metadata: JSON.stringify(channel.metadata ?? {}),
		}).onConflictDoNothing()

		await this.addChannelMember(candidateId, actorA, 'agent', 'member')
		await this.addChannelMember(candidateId, actorB, 'agent', 'member')

		return channel
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	private rowToTask(row: Record<string, unknown>): Task {
		return TaskSchema.parse({
			...nullsToUndefined(row),
			reviewers: typeof row.reviewers === 'string' ? JSON.parse(row.reviewers) : row.reviewers,
			depends_on: typeof row.depends_on === 'string' ? JSON.parse(row.depends_on) : row.depends_on,
			blocks: typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks,
			related: typeof row.related === 'string' ? JSON.parse(row.related) : row.related,
			context: typeof row.context === 'string' ? JSON.parse(row.context) : row.context,
			blockers: typeof row.blockers === 'string' ? JSON.parse(row.blockers) : row.blockers,
			history: typeof row.history === 'string' ? JSON.parse(row.history) : row.history,
			metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
		})
	}

	private rowToChannel(row: Record<string, unknown>): Channel {
		return {
			id: row.id as string,
			name: row.name as string,
			type: row.type as Channel['type'],
			description: (row.description as string) ?? undefined,
			created_by: row.created_by as string,
			created_at: row.created_at as string,
			updated_at: row.updated_at as string,
			metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
		}
	}

	private rowToMessage(row: Record<string, unknown>): Message {
		const clean = nullsToUndefined(row)
		return MessageSchema.parse({
			id: clean.id,
			from: clean.from_id,
			to: clean.to_id,
			channel: clean.channel,
			at: clean.created_at,
			content: clean.content,
			mentions: typeof row.mentions === 'string' ? JSON.parse(row.mentions as string) : (row.mentions ?? []),
			references: typeof row.references_ids === 'string' ? JSON.parse(row.references_ids as string) : (row.references_ids ?? []),
			reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions as string) : (row.reactions ?? []),
			thread: clean.thread,
			transport: clean.transport,
			external: row.external === 1 || row.external === true,
		})
	}
}

export const storageFactory = container.registerAsync('storage', async (c) => {
	const { companyRoot } = c.resolve([companyRootFactory])
	const backend = new SqliteBackend(companyRoot)
	await backend.initialize()
	return backend as StorageBackend
})
