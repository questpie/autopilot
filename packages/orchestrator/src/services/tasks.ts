import { randomBytes } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { tasks } from '../db/company-schema'
import type { CompanyDb } from '../db'

/**
 * Slugify a title into a kebab-case ID suitable for git branches and filesystem paths.
 * Handles unicode, special chars, collapses dashes, and truncates to a reasonable length.
 * Appends a short random suffix to prevent collisions.
 */
export function slugifyTaskId(title: string, maxLength = 60): string {
	const slug = title
		.normalize('NFKD')
		// Strip combining diacritics (accents)
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		// Replace non-alphanumeric chars with dashes
		.replace(/[^a-z0-9]+/g, '-')
		// Collapse multiple dashes
		.replace(/-{2,}/g, '-')
		// Trim leading/trailing dashes
		.replace(/^-|-$/g, '')

	const suffix = randomBytes(2).toString('hex') // 4 hex chars
	const maxSlugLen = maxLength - suffix.length - 1 // -1 for the dash separator

	const trimmed = slug.slice(0, maxSlugLen).replace(/-$/, '')
	return trimmed ? `${trimmed}-${suffix}` : suffix
}

function _getTask(db: CompanyDb, id: string) {
	return db.select().from(tasks).where(eq(tasks.id, id)).get()
}

export type TaskRow = NonNullable<Awaited<ReturnType<typeof _getTask>>>

export class TaskService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		title: string
		description?: string
		type: string
		status?: string
		priority?: string
		assigned_to?: string
		workflow_id?: string
		workflow_step?: string
		context?: string
		metadata?: string
		created_by: string
	}) {
		const now = new Date().toISOString()
		await this.db.insert(tasks).values({
			...input,
			status: input.status ?? 'backlog',
			priority: input.priority ?? 'medium',
			context: input.context ?? '{}',
			metadata: input.metadata ?? '{}',
			created_at: now,
			updated_at: now,
		})
		return this.get(input.id)
	}

	async get(id: string) {
		return _getTask(this.db, id)
	}

	async list(filter?: {
		status?: string
		assigned_to?: string
		workflow_id?: string
	}) {
		const conditions = []
		if (filter?.status) conditions.push(eq(tasks.status, filter.status))
		if (filter?.assigned_to) conditions.push(eq(tasks.assigned_to, filter.assigned_to))
		if (filter?.workflow_id) conditions.push(eq(tasks.workflow_id, filter.workflow_id))

		if (conditions.length === 0) {
			return this.db.select().from(tasks).all()
		}
		if (conditions.length === 1) {
			return this.db.select().from(tasks).where(conditions[0]!).all()
		}
		return this.db
			.select()
			.from(tasks)
			.where(and(...conditions))
			.all()
	}

	async update(
		id: string,
		updates: Partial<{
			title: string
			description: string
			status: string
			priority: string
			assigned_to: string
			workflow_id: string
			workflow_step: string
			context: string
			metadata: string
		}>,
	) {
		await this.db
			.update(tasks)
			.set({ ...updates, updated_at: new Date().toISOString() })
			.where(eq(tasks.id, id))
		return this.get(id)
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(tasks).where(eq(tasks.id, id))
	}
}
