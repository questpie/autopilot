import { randomBytes } from 'node:crypto'
import { eq, and, desc } from 'drizzle-orm'
import { queries } from '../db/company-schema'
import type { CompanyDb } from '../db'

function _getQuery(db: CompanyDb, id: string) {
	return db.select().from(queries).where(eq(queries.id, id)).get()
}

export type QueryRow = NonNullable<Awaited<ReturnType<typeof _getQuery>>>

export class QueryService {
	constructor(private db: CompanyDb) {}

	/** Create a new query record. Does NOT create a task. */
	async create(input: {
		prompt: string
		agent_id: string
		allow_repo_mutation: boolean
		continue_from?: string
		carryover_summary?: string
		created_by: string
		metadata?: string
	}): Promise<QueryRow> {
		const id = `query-${Date.now()}-${randomBytes(6).toString('hex')}`
		const now = new Date().toISOString()

		await this.db.insert(queries).values({
			id,
			prompt: input.prompt,
			agent_id: input.agent_id,
			status: 'pending',
			allow_repo_mutation: input.allow_repo_mutation,
			mutated_repo: false,
			continue_from: input.continue_from ?? null,
			carryover_summary: input.carryover_summary ?? null,
			runtime_session_ref: null,
			created_by: input.created_by,
			created_at: now,
			metadata: input.metadata ?? '{}',
		})

		return this.get(id) as Promise<QueryRow>
	}

	async get(id: string): Promise<QueryRow | undefined> {
		return _getQuery(this.db, id)
	}

	async list(filter?: { status?: string; agent_id?: string }): Promise<QueryRow[]> {
		const conditions = []
		if (filter?.status) conditions.push(eq(queries.status, filter.status))
		if (filter?.agent_id) conditions.push(eq(queries.agent_id, filter.agent_id))

		if (conditions.length === 0) {
			return this.db.select().from(queries).orderBy(desc(queries.created_at)).all()
		}
		if (conditions.length === 1) {
			return this.db.select().from(queries).where(conditions[0]!).orderBy(desc(queries.created_at)).all()
		}
		return this.db
			.select()
			.from(queries)
			.where(and(...conditions))
			.orderBy(desc(queries.created_at))
			.all()
	}

	/** Link a run to a query and mark it as running. */
	async linkRun(queryId: string, runId: string): Promise<QueryRow | undefined> {
		await this.db
			.update(queries)
			.set({ run_id: runId, status: 'running' })
			.where(eq(queries.id, queryId))
		return this.get(queryId)
	}

	/** Find a running query by its associated run ID. */
	async getByRunId(runId: string): Promise<QueryRow | undefined> {
		return this.db
			.select()
			.from(queries)
			.where(and(eq(queries.run_id, runId), eq(queries.status, 'running')))
			.get()
	}

	/** Complete a query with results from its run. */
	async complete(
		queryId: string,
		result: {
			status: 'completed' | 'failed'
			summary?: string
			mutated_repo?: boolean
			runtime_session_ref?: string
			error?: string
		},
	): Promise<QueryRow | undefined> {
		await this.db
			.update(queries)
			.set({
				status: result.status,
				summary: result.summary ?? result.error ?? null,
				mutated_repo: result.mutated_repo ?? false,
				runtime_session_ref: result.runtime_session_ref ?? null,
				ended_at: new Date().toISOString(),
			})
			.where(eq(queries.id, queryId))
		return this.get(queryId)
	}
}
