import { eq } from 'drizzle-orm'
import { artifacts } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getArtifact(db: CompanyDb, id: string) {
	return db.select().from(artifacts).where(eq(artifacts.id, id)).get()
}

export type ArtifactRow = NonNullable<Awaited<ReturnType<typeof _getArtifact>>>

export class ArtifactService {
	constructor(private db: CompanyDb) {}

	async create(input: {
		id: string
		run_id: string
		task_id?: string | null
		kind: string
		title: string
		ref_kind: string
		ref_value: string
		mime_type?: string
		metadata?: string
	}) {
		await this.db.insert(artifacts).values({
			...input,
			created_at: new Date().toISOString(),
		})
		return this.get(input.id)
	}

	async get(id: string) {
		return _getArtifact(this.db, id)
	}

	async listForRun(runId: string) {
		return this.db.select().from(artifacts).where(eq(artifacts.run_id, runId)).all()
	}

	async listForTask(taskId: string) {
		return this.db.select().from(artifacts).where(eq(artifacts.task_id, taskId)).all()
	}
}
