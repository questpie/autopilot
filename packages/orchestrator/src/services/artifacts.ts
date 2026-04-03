import { eq } from 'drizzle-orm'
import { artifacts } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type ArtifactRow = typeof artifacts.$inferSelect

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
	}): Promise<ArtifactRow | undefined> {
		await this.db.insert(artifacts).values({
			...input,
			created_at: new Date().toISOString(),
		})
		return this.get(input.id)
	}

	async get(id: string): Promise<ArtifactRow | undefined> {
		return this.db.select().from(artifacts).where(eq(artifacts.id, id)).get()
	}

	async listForRun(runId: string): Promise<ArtifactRow[]> {
		return this.db.select().from(artifacts).where(eq(artifacts.run_id, runId)).all()
	}

	async listForTask(taskId: string): Promise<ArtifactRow[]> {
		return this.db.select().from(artifacts).where(eq(artifacts.task_id, taskId)).all()
	}
}
