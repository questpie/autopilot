import { eq, and, sql, desc, asc } from 'drizzle-orm'
import { Database } from 'bun:sqlite'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'
import { createDb, initFts, type AutopilotDb } from '../db'
import { schema } from '../db'
import type { StorageBackend, Task, Message, TaskFilter, MessageFilter, ActivityEntry, ActivityFilter } from './storage'

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
		this.db = await createDb(this.companyRoot)

		// Push schema — create tables if they do not exist
		// Using raw SQL for table creation since we need IF NOT EXISTS
		const raw = this.getRawDb()
		this.ensureTables(raw)

		// Init FTS5 for messages
		initFts(this.db)
	}

	private getRawDb(): Database {
		return (this.db as unknown as { $client: Database }).$client
	}

	private ensureTables(raw: Database): void {
		raw.exec(`
			CREATE TABLE IF NOT EXISTS tasks (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT DEFAULT '',
				type TEXT NOT NULL,
				status TEXT NOT NULL,
				priority TEXT DEFAULT 'medium',
				created_by TEXT NOT NULL,
				assigned_to TEXT,
				reviewers TEXT DEFAULT '[]',
				approver TEXT,
				project TEXT,
				parent TEXT,
				depends_on TEXT DEFAULT '[]',
				blocks TEXT DEFAULT '[]',
				related TEXT DEFAULT '[]',
				workflow TEXT,
				workflow_step TEXT,
				context TEXT DEFAULT '{}',
				blockers TEXT DEFAULT '[]',
				resources TEXT DEFAULT '[]',
				labels TEXT DEFAULT '[]',
				milestone TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				started_at TEXT,
				completed_at TEXT,
				deadline TEXT,
				history TEXT DEFAULT '[]',
				metadata TEXT DEFAULT '{}'
			)
		`)
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_workflow ON tasks(workflow, workflow_step)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority, status)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone)')

		raw.exec(`
			CREATE TABLE IF NOT EXISTS messages (
				id TEXT PRIMARY KEY,
				channel TEXT,
				from_id TEXT NOT NULL,
				to_id TEXT,
				content TEXT NOT NULL,
				created_at TEXT NOT NULL,
				mentions TEXT DEFAULT '[]',
				references_ids TEXT DEFAULT '[]',
				reactions TEXT DEFAULT '[]',
				thread TEXT,
				transport TEXT,
				external INTEGER DEFAULT 0
			)
		`)
		raw.exec('CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)')

		raw.exec(`
			CREATE TABLE IF NOT EXISTS activity (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				agent TEXT NOT NULL,
				type TEXT NOT NULL,
				summary TEXT NOT NULL,
				details TEXT,
				created_at TEXT NOT NULL
			)
		`)
		raw.exec('CREATE INDEX IF NOT EXISTS idx_activity_agent_time ON activity(agent, created_at)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_activity_type ON activity(type)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_activity_time ON activity(created_at)')

		raw.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				agent_id TEXT NOT NULL,
				task_id TEXT,
				trigger_type TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'running',
				started_at TEXT NOT NULL,
				ended_at TEXT,
				tool_calls INTEGER DEFAULT 0,
				tokens_used INTEGER DEFAULT 0,
				error TEXT,
				log_path TEXT
			)
		`)
		raw.exec('CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)')
		raw.exec('CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)')
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
			created_at: task.created_at,
			updated_at: task.updated_at,
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

	async moveTask(id: string, newStatus: string, movedBy: string): Promise<Task> {
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

		const validated = TaskSchema.parse({
			...existing,
			status: newStatus,
			updated_at: timestamp,
			started_at: newStatus === 'in_progress'
				? (existing.started_at ?? timestamp)
				: existing.started_at,
			completed_at: newStatus === 'done' ? timestamp : existing.completed_at,
			history: [...existing.history, historyEntry],
		})

		await this.db.update(schema.tasks).set({
			status: validated.status,
			updated_at: validated.updated_at,
			started_at: validated.started_at ?? null,
			completed_at: validated.completed_at ?? null,
			history: JSON.stringify(validated.history),
		}).where(eq(schema.tasks.id, id))

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
