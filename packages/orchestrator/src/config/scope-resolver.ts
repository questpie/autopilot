/**
 * Scope resolver — walks up from a start directory to find
 * `.autopilot/company.yaml` and `.autopilot/project.yaml`,
 * then merges them into a single ResolvedConfig.
 *
 * Local and cloud are the same model with a different URL.
 * This module handles the local filesystem discovery path.
 * Cloud/API push produces the same ResolvedConfig shape.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
	CompanyScopeSchema,
	ProjectScopeSchema,
	AgentSchema,
	WorkflowSchema,
	EnvironmentSchema,
	ProviderSchema,
	CapabilityProfileSchema,
	PATHS,
} from '@questpie/autopilot-spec'
import type { CompanyScope, ProjectScope, Agent, Workflow, Environment, Provider, CapabilityProfile } from '@questpie/autopilot-spec'
import type { z, ZodTypeDef } from 'zod'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ScopeChain {
	companyRoot: string | null
	projectRoot: string | null
	company: CompanyScope | null
	project: ProjectScope | null
}

export interface ResolvedConfig {
	company: CompanyScope
	agents: Map<string, Agent>
	workflows: Map<string, Workflow>
	environments: Map<string, Environment>
	providers: Map<string, Provider>
	capabilityProfiles: Map<string, CapabilityProfile>
	skills: Map<string, string>
	context: Map<string, string>
	/** Resolved defaults (project overrides company). */
	defaults: { runtime: string; workflow?: string; task_assignee?: string }
}

// ─── Discovery ─────────────────────────────────────────────────────────────

/**
 * Walk up from `from` to find `.autopilot/company.yaml` and `.autopilot/project.yaml`.
 * Returns the scope chain (company and/or project roots + parsed configs).
 */
export async function discoverScopes(from?: string): Promise<ScopeChain> {
	let dir = resolve(from ?? process.cwd())
	let project: { root: string; config: ProjectScope } | null = null
	let company: { root: string; config: CompanyScope } | null = null

	while (true) {
		const projectPath = join(dir, PATHS.PROJECT_CONFIG)
		const companyPath = join(dir, PATHS.COMPANY_CONFIG)

		if (!project && existsSync(projectPath)) {
			const raw = await readFile(projectPath, 'utf-8')
			project = { root: dir, config: ProjectScopeSchema.parse(parseYaml(raw)) }
		}

		if (existsSync(companyPath)) {
			const raw = await readFile(companyPath, 'utf-8')
			company = { root: dir, config: CompanyScopeSchema.parse(parseYaml(raw)) }
			break // company is the top — stop walking
		}

		const parent = dirname(dir)
		if (parent === dir) break
		dir = parent
	}

	return {
		companyRoot: company?.root ?? null,
		projectRoot: project?.root ?? null,
		company: company?.config ?? null,
		project: project?.config ?? null,
	}
}

// ─── Loading ───────────────────────────────────────────────────────────────

async function loadYamlDir<T>(dir: string, schema: z.ZodType<T, ZodTypeDef, unknown>): Promise<T[]> {
	if (!existsSync(dir)) return []
	let files: string[]
	try {
		files = await readdir(dir)
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
		throw err
	}
	const results: T[] = []
	for (const f of files) {
		if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue
		const raw = await readFile(join(dir, f), 'utf-8')
		results.push(schema.parse(parseYaml(raw)))
	}
	return results
}

async function loadTextDir(dir: string): Promise<Map<string, string>> {
	const result = new Map<string, string>()
	if (!existsSync(dir)) return result
	let entries: string[]
	try {
		entries = await readdir(dir)
	} catch {
		return result
	}
	for (const entry of entries) {
		if (!entry.endsWith('.md') && !entry.endsWith('.txt')) continue
		const content = await readFile(join(dir, entry), 'utf-8')
		const name = entry.replace(/\.(md|txt)$/, '')
		result.set(name, content)
	}
	return result
}

async function loadSkillsDir(dir: string): Promise<Map<string, string>> {
	const result = new Map<string, string>()
	if (!existsSync(dir)) return result
	let entries: string[]
	try {
		entries = await readdir(dir)
	} catch {
		return result
	}
	for (const entry of entries) {
		// Standard SKILL.md format: .autopilot/skills/<name>/SKILL.md
		const skillPath = join(dir, entry, 'SKILL.md')
		if (existsSync(skillPath)) {
			const content = await readFile(skillPath, 'utf-8')
			result.set(entry, content)
			continue
		}
		// Also support flat .md files: .autopilot/skills/<name>.md
		if (entry.endsWith('.md')) {
			const content = await readFile(join(dir, entry), 'utf-8')
			const name = entry.replace(/\.md$/, '')
			result.set(name, content)
		}
	}
	return result
}

// ─── Config loading from a single scope root ───────────────────────────────

export async function loadAgentsFromRoot(root: string) {
	return loadYamlDir(join(root, PATHS.AGENTS_DIR), AgentSchema)
}

export async function loadWorkflowsFromRoot(root: string) {
	return loadYamlDir(join(root, PATHS.WORKFLOWS_DIR), WorkflowSchema)
}

export async function loadEnvironmentsFromRoot(root: string) {
	return loadYamlDir(join(root, PATHS.ENVIRONMENTS_DIR), EnvironmentSchema)
}

export async function loadProvidersFromRoot(root: string) {
	return loadYamlDir(join(root, PATHS.PROVIDERS_DIR), ProviderSchema)
}

export async function loadCapabilityProfilesFromRoot(root: string) {
	return loadYamlDir(join(root, PATHS.CAPABILITIES_DIR), CapabilityProfileSchema)
}

export async function loadSkillsFromRoot(root: string) {
	return loadSkillsDir(join(root, PATHS.SKILLS_DIR))
}

export async function loadContextFromRoot(root: string) {
	return loadTextDir(join(root, PATHS.CONTEXT_DIR))
}

// ─── Merge ─────────────────────────────────────────────────────────────────

function mergeMapById<T extends { id: string }>(base: T[], overlay: T[]): Map<string, T> {
	const result = new Map<string, T>()
	for (const item of base) result.set(item.id, item)
	for (const item of overlay) result.set(item.id, item) // project wins
	return result
}

function mergeMaps(base: Map<string, string>, overlay: Map<string, string>): Map<string, string> {
	const result = new Map(base)
	for (const [key, value] of overlay) result.set(key, value) // project shadows
	return result
}

/**
 * Load and merge config from company + project roots into a single ResolvedConfig.
 * This is the main entry point for runtime config loading.
 */
export async function resolveConfig(chain: ScopeChain): Promise<ResolvedConfig> {
	const company = chain.company ?? CompanyScopeSchema.parse({ name: 'Standalone', slug: 'standalone' })

	// Load from company root
	const companyRoot = chain.companyRoot
	const companyAgents = companyRoot ? await loadAgentsFromRoot(companyRoot) : []
	const companyWorkflows = companyRoot ? await loadWorkflowsFromRoot(companyRoot) : []
	const companyEnvs = companyRoot ? await loadEnvironmentsFromRoot(companyRoot) : []
	const companyProviders = companyRoot ? await loadProvidersFromRoot(companyRoot) : []
	const companyCapProfiles = companyRoot ? await loadCapabilityProfilesFromRoot(companyRoot) : []
	const companySkills = companyRoot ? await loadSkillsFromRoot(companyRoot) : new Map<string, string>()
	const companyContext = companyRoot ? await loadContextFromRoot(companyRoot) : new Map<string, string>()

	// Load from project root (if different from company root)
	const projectRoot = chain.projectRoot
	const hasProjectRoot = projectRoot && projectRoot !== companyRoot
	const projectAgents = hasProjectRoot ? await loadAgentsFromRoot(projectRoot) : []
	const projectWorkflows = hasProjectRoot ? await loadWorkflowsFromRoot(projectRoot) : []
	const projectEnvs = hasProjectRoot ? await loadEnvironmentsFromRoot(projectRoot) : []
	const projectProviders = hasProjectRoot ? await loadProvidersFromRoot(projectRoot) : []
	const projectCapProfiles = hasProjectRoot ? await loadCapabilityProfilesFromRoot(projectRoot) : []
	const projectSkills = hasProjectRoot ? await loadSkillsFromRoot(projectRoot) : new Map<string, string>()
	const projectContext = hasProjectRoot ? await loadContextFromRoot(projectRoot) : new Map<string, string>()

	// Merge: project overrides company
	const project = chain.project
	const defaults = {
		runtime: project?.defaults.runtime ?? company.defaults.runtime ?? 'claude-code',
		workflow: project?.defaults.workflow ?? company.defaults.workflow,
		task_assignee: project?.defaults.task_assignee ?? company.defaults.task_assignee,
	}

	return {
		company,
		agents: mergeMapById(companyAgents, projectAgents),
		workflows: mergeMapById(companyWorkflows, projectWorkflows),
		environments: mergeMapById(companyEnvs, projectEnvs),
		providers: mergeMapById(companyProviders, projectProviders),
		capabilityProfiles: mergeMapById(companyCapProfiles, projectCapProfiles),
		skills: mergeMaps(companySkills, projectSkills),
		context: mergeMaps(companyContext, projectContext),
		defaults,
	}
}

/**
 * Convenience: discover scopes from a directory and resolve config in one step.
 */
export async function discoverAndResolve(from?: string): Promise<{ chain: ScopeChain; config: ResolvedConfig }> {
	const chain = await discoverScopes(from)
	const config = await resolveConfig(chain)
	return { chain, config }
}
