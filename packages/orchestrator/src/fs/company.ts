import { join } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import {
	CompanySchema,
	AgentsFileSchema,
	HumansFileSchema,
	WorkflowSchema,
	ScheduleSchema,
	WebhooksFileSchema,
	PATHS,
	workflowPath,
} from '@questpie/autopilot-spec'
import { readYaml } from './yaml'
import { logger } from '../logger'

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath)
}

/** Read and validate `company.yaml`. */
export async function loadCompany(companyRoot: string) {
	return readYaml(resolvePath(companyRoot, PATHS.COMPANY_CONFIG), CompanySchema)
}

/**
 * Read `team/agents.yaml` and return the `agents` array.
 * Falls back to root `agents.yaml` with a deprecation warning.
 */
export async function loadAgents(companyRoot: string) {
	const primaryPath = resolvePath(companyRoot, PATHS.AGENTS)
	const legacyPath = resolvePath(companyRoot, '/agents.yaml')

	let agentsPath = primaryPath
	if (!existsSync(primaryPath) && existsSync(legacyPath)) {
		logger.warn('autopilot', 'DEPRECATED: agents.yaml found at root level. Move it to team/agents.yaml.')
		agentsPath = legacyPath
	}

	const file = await readYaml(agentsPath, AgentsFileSchema)
	return file.agents
}

/** Read `humans.yaml` and return the `humans` array. */
export async function loadHumans(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.HUMANS), HumansFileSchema)
	return file.humans
}

/** Read and validate a single workflow YAML file by its ID. */
export async function loadWorkflow(companyRoot: string, id: string) {
	return readYaml(resolvePath(companyRoot, workflowPath(id)), WorkflowSchema)
}

/** Read `team/schedules/*.yaml` and return an array of validated schedules. */
export async function loadSchedules(companyRoot: string) {
	const schedulesDir = resolvePath(companyRoot, PATHS.SCHEDULES_DIR)
	if (!existsSync(schedulesDir)) return []

	const files = readdirSync(schedulesDir).filter((f) => f.endsWith('.yaml'))
	const schedules = []
	for (const file of files) {
		try {
			const schedule = await readYaml(join(schedulesDir, file), ScheduleSchema)
			schedules.push(schedule)
		} catch (err) {
			logger.warn('autopilot', `failed to parse schedule ${file}: ${err instanceof Error ? err.message : String(err)}`)
		}
	}
	return schedules
}

/** Read `webhooks.yaml` and return the `webhooks` array. */
export async function loadWebhooks(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.WEBHOOKS), WebhooksFileSchema)
	return file.webhooks
}
