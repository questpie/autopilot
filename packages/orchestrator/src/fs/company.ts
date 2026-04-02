import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
	AgentSchema,
	CompanySchema,
	HumanSchema,
	PATHS,
	ScheduleSchema,
	WorkflowSchema,
	workflowPath,
} from '@questpie/autopilot-spec'
import type { Agent, Human, Schedule } from '@questpie/autopilot-spec'
import { readYaml, writeYaml } from './yaml'

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath)
}

/**
 * Read and validate `company.yaml`.
 * If missing or unreadable, schema defaults are used and the file is re-written.
 */
export async function loadCompany(companyRoot: string) {
	const configPath = resolvePath(companyRoot, PATHS.COMPANY_CONFIG)
	try {
		return await readYaml(configPath, CompanySchema)
	} catch {
		const defaults = CompanySchema.parse({})
		await writeYaml(configPath, defaults)
		return defaults
	}
}

/** Read `team/agents/*.yaml` and return validated agents. */
export async function loadAgents(companyRoot: string) {
	const dir = resolvePath(companyRoot, PATHS.AGENTS_DIR)
	const agents: Agent[] = []
	if (!existsSync(dir)) return agents

	const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const agent = await readYaml(join(dir, file), AgentSchema)
			agents.push(agent)
		} catch {
			console.warn(`[config] skipping invalid agent file ${file}`)
		}
	}
	return agents
}

/** Read `team/humans/*.yaml` and return validated humans. */
export async function loadHumans(companyRoot: string) {
	const dir = resolvePath(companyRoot, PATHS.HUMANS_DIR)
	const humans: Human[] = []
	if (!existsSync(dir)) return humans

	const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const human = await readYaml(join(dir, file), HumanSchema)
			humans.push(human)
		} catch {
			console.warn(`[config] skipping invalid human file ${file}`)
		}
	}
	return humans
}

/** Read and validate a single workflow YAML file by its ID. */
export async function loadWorkflow(companyRoot: string, id: string) {
	return readYaml(resolvePath(companyRoot, workflowPath(id)), WorkflowSchema)
}

/** Read `team/schedules/*.yaml` and return validated schedules. */
export async function loadSchedules(companyRoot: string) {
	const schedulesDir = resolvePath(companyRoot, PATHS.SCHEDULES_DIR)
	const schedules: Schedule[] = []
	if (!existsSync(schedulesDir)) return schedules

	const files = readdirSync(schedulesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const schedule = await readYaml(join(schedulesDir, file), ScheduleSchema)
			schedules.push(schedule)
		} catch {
			console.warn(`[config] skipping invalid schedule file ${file}`)
		}
	}
	return schedules
}
