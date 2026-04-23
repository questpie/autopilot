import {
	type Agent,
	AgentSchema,
	type CapabilityProfile,
	CapabilityProfileSchema,
	type CompanyScope,
	CompanyScopeSchema,
	type Environment,
	EnvironmentSchema,
	type ProjectScope,
	ProjectScopeSchema,
	type Provider,
	ProviderSchema,
	type SkillEntry,
	SkillEntrySchema,
	type StandaloneScript,
	StandaloneScriptSchema,
	type Workflow,
	WorkflowSchema,
} from '@questpie/autopilot-spec'
import { and, eq, isNull } from 'drizzle-orm'
import type { CompanyDb } from '../db'
import {
	configAgents,
	configCapabilities,
	configCompanyScopes,
	configContexts,
	configEnvironments,
	configProjectScopes,
	configProviders,
	configScripts,
	configSkills,
	configWorkflows,
} from '../db/company-schema'
import type { AuthoredConfig } from '../services/workflow-engine'

type JsonConfigType =
	| 'agents'
	| 'workflows'
	| 'environments'
	| 'providers'
	| 'capabilities'
	| 'skills'
	| 'scripts'

export type ConfigEntityType = JsonConfigType | 'context' | 'company' | 'project'

type JsonTable =
	| typeof configAgents
	| typeof configWorkflows
	| typeof configEnvironments
	| typeof configProviders
	| typeof configCapabilities
	| typeof configSkills
	| typeof configScripts

const JSON_TABLES: Record<JsonConfigType, JsonTable> = {
	agents: configAgents,
	workflows: configWorkflows,
	environments: configEnvironments,
	providers: configProviders,
	capabilities: configCapabilities,
	skills: configSkills,
	scripts: configScripts,
}

const JSON_SCHEMAS = {
	agents: AgentSchema,
	workflows: WorkflowSchema,
	environments: EnvironmentSchema,
	providers: ProviderSchema,
	capabilities: CapabilityProfileSchema,
	skills: SkillEntrySchema,
	scripts: StandaloneScriptSchema,
} as const

export class ConfigService {
	constructor(private db: CompanyDb) {}

	async hasAnyConfig(): Promise<boolean> {
		const company = await this.db.select().from(configCompanyScopes).get()
		if (company) return true
		const agent = await this.db.select().from(configAgents).get()
		return agent !== undefined
	}

	async loadAuthoredConfig(projectId?: string | null): Promise<AuthoredConfig> {
		const company = await this.getCompanyScope()
		const project = projectId ? await this.getProjectScope(projectId) : null

		const [agents, workflows, environments, providers, capabilities, skills, scripts, context] =
			await Promise.all([
				this.loadMap('agents', projectId),
				this.loadMap('workflows', projectId),
				this.loadMap('environments', projectId),
				this.loadMap('providers', projectId),
				this.loadMap('capabilities', projectId),
				this.loadMap('skills', projectId),
				this.loadMap('scripts', projectId),
				this.loadContext(projectId),
			])

		return {
			company,
			agents: agents as Map<string, Agent>,
			workflows: workflows as Map<string, Workflow>,
			environments: environments as Map<string, Environment>,
			providers: providers as Map<string, Provider>,
			capabilityProfiles: capabilities as Map<string, CapabilityProfile>,
			skills: skills as Map<string, SkillEntry>,
			context,
			scripts: scripts as Map<string, StandaloneScript>,
			defaults: {
				runtime: project?.defaults.runtime ?? company.defaults.runtime ?? 'claude-code',
				workflow: project?.defaults.workflow ?? company.defaults.workflow,
				task_assignee: project?.defaults.task_assignee ?? company.defaults.task_assignee,
			},
			queues: company.queues ?? {},
		}
	}

	async list(type: ConfigEntityType, projectId?: string | null): Promise<unknown[]> {
		if (type === 'company') {
			const company = await this.getCompanyScope()
			return [company]
		}

		if (type === 'project') {
			if (projectId) {
				const scope = await this.getProjectScope(projectId)
				return scope ? [scope] : []
			}
			const rows = await this.db.select().from(configProjectScopes).all()
			return rows.map((row) => ProjectScopeSchema.parse(JSON.parse(row.data)))
		}

		if (type === 'context') {
			return this.listContext(projectId)
		}

		return [...(await this.loadMap(type, projectId)).values()]
	}

	async get(
		type: ConfigEntityType,
		id?: string,
		projectId?: string | null,
	): Promise<unknown | null> {
		if (type === 'company') {
			return this.getCompanyScope()
		}

		if (type === 'project') {
			if (!id) return null
			return this.getProjectScope(id)
		}

		if (!id) return null

		if (type === 'context') {
			const row = await this.findContextRow(id, projectId)
			return row ? { id: row.id, content: row.content, project_id: row.project_id ?? null } : null
		}

		const row = await this.findJsonRow(type, id, projectId)
		return row ? JSON_SCHEMAS[type].parse(JSON.parse(row.data)) : null
	}

	async set(
		type: ConfigEntityType,
		id: string,
		data: unknown,
		projectId?: string | null,
	): Promise<unknown> {
		const now = new Date().toISOString()

		if (type === 'company') {
			const parsed = CompanyScopeSchema.parse(data)
			await this.db
				.insert(configCompanyScopes)
				.values({ id: 'company', data: JSON.stringify(parsed), updated_at: now })
				.onConflictDoUpdate({
					target: configCompanyScopes.id,
					set: { data: JSON.stringify(parsed), updated_at: now },
				})
			return parsed
		}

		if (type === 'project') {
			const parsed = ProjectScopeSchema.parse(data)
			await this.db
				.insert(configProjectScopes)
				.values({ project_id: id, data: JSON.stringify(parsed), updated_at: now })
				.onConflictDoUpdate({
					target: configProjectScopes.project_id,
					set: { data: JSON.stringify(parsed), updated_at: now },
				})
			return parsed
		}

		if (type === 'context') {
			const parsed = parseContextRecord(id, data)
			const scopeId = this.scopeId(id, projectId)
			await this.db
				.insert(configContexts)
				.values({
					scope_id: scopeId,
					id,
					project_id: projectId ?? null,
					content: parsed.content,
					updated_at: now,
				})
				.onConflictDoUpdate({
					target: configContexts.scope_id,
					set: { content: parsed.content, updated_at: now },
				})
			return { id, content: parsed.content, project_id: projectId ?? null }
		}

		const parsed = JSON_SCHEMAS[type].parse(data)
		const table = JSON_TABLES[type]
		const scopeId = this.scopeId(id, projectId)
		await this.db
			.insert(table)
			.values({
				scope_id: scopeId,
				id,
				project_id: projectId ?? null,
				data: JSON.stringify(parsed),
				updated_at: now,
			})
			.onConflictDoUpdate({
				target: table.scope_id,
				set: { data: JSON.stringify(parsed), updated_at: now },
			})
		return parsed
	}

	async delete(type: ConfigEntityType, id: string, projectId?: string | null): Promise<boolean> {
		if (type === 'company') {
			const result = await this.db
				.delete(configCompanyScopes)
				.where(eq(configCompanyScopes.id, 'company'))
				.returning()
			return result.length > 0
		}

		if (type === 'project') {
			const result = await this.db
				.delete(configProjectScopes)
				.where(eq(configProjectScopes.project_id, id))
				.returning()
			return result.length > 0
		}

		if (type === 'context') {
			const result = await this.db
				.delete(configContexts)
				.where(eq(configContexts.scope_id, this.scopeId(id, projectId)))
				.returning()
			return result.length > 0
		}

		const table = JSON_TABLES[type]
		const result = await this.db
			.delete(table)
			.where(eq(table.scope_id, this.scopeId(id, projectId)))
			.returning()
		return result.length > 0
	}

	private async getCompanyScope(): Promise<CompanyScope> {
		const row = await this.db
			.select()
			.from(configCompanyScopes)
			.where(eq(configCompanyScopes.id, 'company'))
			.get()
		if (!row) return CompanyScopeSchema.parse({ name: 'Standalone', slug: 'standalone' })
		return CompanyScopeSchema.parse(JSON.parse(row.data))
	}

	private async getProjectScope(projectId: string): Promise<ProjectScope | null> {
		const row = await this.db
			.select()
			.from(configProjectScopes)
			.where(eq(configProjectScopes.project_id, projectId))
			.get()
		return row ? ProjectScopeSchema.parse(JSON.parse(row.data)) : null
	}

	private async loadMap(
		type: JsonConfigType,
		projectId?: string | null,
	): Promise<Map<string, unknown>> {
		const table = JSON_TABLES[type]
		const baseRows = await this.db.select().from(table).where(isNull(table.project_id)).all()
		const result = new Map<string, unknown>(
			baseRows.map((row) => [row.id, JSON_SCHEMAS[type].parse(JSON.parse(row.data))]),
		)

		if (projectId) {
			const projectRows = await this.db
				.select()
				.from(table)
				.where(eq(table.project_id, projectId))
				.all()
			for (const row of projectRows) {
				result.set(row.id, JSON_SCHEMAS[type].parse(JSON.parse(row.data)))
			}
		}

		return result
	}

	private async loadContext(projectId?: string | null): Promise<Map<string, string>> {
		const baseRows = await this.db
			.select()
			.from(configContexts)
			.where(isNull(configContexts.project_id))
			.all()
		const result = new Map<string, string>(baseRows.map((row) => [row.id, row.content]))

		if (projectId) {
			const projectRows = await this.db
				.select()
				.from(configContexts)
				.where(eq(configContexts.project_id, projectId))
				.all()
			for (const row of projectRows) result.set(row.id, row.content)
		}

		return result
	}

	private async listContext(
		projectId?: string | null,
	): Promise<Array<{ id: string; content: string; project_id: string | null }>> {
		const rows = projectId
			? await this.db
					.select()
					.from(configContexts)
					.where(eq(configContexts.project_id, projectId))
					.all()
			: await this.db.select().from(configContexts).where(isNull(configContexts.project_id)).all()

		return rows.map((row) => ({
			id: row.id,
			content: row.content,
			project_id: row.project_id ?? null,
		}))
	}

	private async findJsonRow(type: JsonConfigType, id: string, projectId?: string | null) {
		const table = JSON_TABLES[type]
		return projectId
			? this.db
					.select()
					.from(table)
					.where(and(eq(table.id, id), eq(table.project_id, projectId)))
					.get()
			: this.db
					.select()
					.from(table)
					.where(and(eq(table.id, id), isNull(table.project_id)))
					.get()
	}

	private async findContextRow(id: string, projectId?: string | null) {
		return projectId
			? this.db
					.select()
					.from(configContexts)
					.where(and(eq(configContexts.id, id), eq(configContexts.project_id, projectId)))
					.get()
			: this.db
					.select()
					.from(configContexts)
					.where(and(eq(configContexts.id, id), isNull(configContexts.project_id)))
					.get()
	}

	private scopeId(id: string, projectId?: string | null): string {
		return `${projectId ?? '__company__'}:${id}`
	}
}

function parseContextRecord(id: string, data: unknown): { id: string; content: string } {
	if (typeof data === 'string') return { id, content: data }
	if (
		typeof data === 'object' &&
		data !== null &&
		'content' in data &&
		typeof data.content === 'string'
	) {
		return { id, content: data.content }
	}
	throw new Error('Context record must be a string or { content: string }')
}
