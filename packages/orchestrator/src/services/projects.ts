import { randomBytes } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import type { CompanyDb } from '../db'
import { projects } from '../db/company-schema'

function _getProject(db: CompanyDb, id: string) {
	return db.select().from(projects).where(eq(projects.id, id)).get()
}

export type ProjectRow = NonNullable<Awaited<ReturnType<typeof _getProject>>>

export class ProjectService {
	constructor(private db: CompanyDb) {}

	async register(input: {
		name?: string
		path: string
		git_remote?: string | null
		default_branch?: string | null
		metadata?: Record<string, unknown>
	}): Promise<ProjectRow> {
		const now = new Date().toISOString()
		const normalizedPath = input.path.trim()
		const existing = await this.findByPath(normalizedPath)
		const name = input.name?.trim() || basenameFromPath(normalizedPath)
		const metadata = JSON.stringify(input.metadata ?? {})

		if (existing) {
			await this.db
				.update(projects)
				.set({
					name,
					path: normalizedPath,
					git_remote: input.git_remote ?? null,
					default_branch: input.default_branch ?? null,
					metadata,
					registered_at: now,
				})
				.where(eq(projects.id, existing.id))

			const row = await this.get(existing.id)
			if (!row) throw new Error(`Failed to read back project ${existing.id}`)
			return row
		}

		const id = `proj-${Date.now()}-${randomBytes(6).toString('hex')}`
		await this.db.insert(projects).values({
			id,
			name,
			path: normalizedPath,
			git_remote: input.git_remote ?? null,
			default_branch: input.default_branch ?? null,
			registered_at: now,
			metadata,
		})

		const row = await this.get(id)
		if (!row) throw new Error(`Failed to read back project ${id}`)
		return row
	}

	async unregister(id: string): Promise<boolean> {
		const result = await this.db.delete(projects).where(eq(projects.id, id)).returning()
		return result.length > 0
	}

	async list(): Promise<ProjectRow[]> {
		return this.db.select().from(projects).orderBy(desc(projects.registered_at)).all()
	}

	async get(id: string): Promise<ProjectRow | undefined> {
		return _getProject(this.db, id)
	}

	async findByPath(path: string): Promise<ProjectRow | undefined> {
		return this.db.select().from(projects).where(eq(projects.path, path)).get()
	}
}

function basenameFromPath(path: string): string {
	const trimmed = path.replace(/[\\/]+$/, '')
	const parts = trimmed.split(/[\\/]/)
	return parts[parts.length - 1] || path
}
