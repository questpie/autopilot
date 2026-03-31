import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
	AgentSchema,
	CompanySchema,
	HumanSchema,
	PATHS,
	ScheduleSchema,
	WebhookSchema,
	WorkflowSchema,
	workflowPath,
} from '@questpie/autopilot-spec'
import type { Agent, Human, Schedule, Webhook } from '@questpie/autopilot-spec'
import { logger } from '../logger'
import { readYaml, writeYaml } from './yaml'

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath)
}

/**
 * Read and validate `company.yaml`.
 *
 * If the file is missing or unreadable the schema defaults are used and the
 * file is re-written so subsequent reads succeed normally.
 */
export async function loadCompany(companyRoot: string) {
	const configPath = resolvePath(companyRoot, PATHS.COMPANY_CONFIG)

	try {
		return await readYaml(configPath, CompanySchema)
	} catch (err) {
		logger.warn('company', 'company.yaml missing or invalid — using defaults', {
			error: err instanceof Error ? err.message : String(err),
		})

		const defaults = CompanySchema.parse({})
		await writeYaml(configPath, defaults)

		logger.info('company', 'regenerated company.yaml with defaults')
		return defaults
	}
}

/** Read `team/agents/*.yaml` and return an array of validated agents. */
export async function loadAgents(companyRoot: string) {
	const dir = resolvePath(companyRoot, PATHS.AGENTS_DIR)
	const agents: Agent[] = []
	if (!existsSync(dir)) return agents

	const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const agent = await readYaml(join(dir, file), AgentSchema)
			agents.push(agent)
		} catch (err) {
			logger.warn('company', `skipping invalid agent file ${file}`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
	return agents
}

/** Read `team/humans/*.yaml` and return an array of validated humans. */
export async function loadHumans(companyRoot: string) {
	const dir = resolvePath(companyRoot, PATHS.HUMANS_DIR)
	const humans: Human[] = []
	if (!existsSync(dir)) return humans

	const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const human = await readYaml(join(dir, file), HumanSchema)
			humans.push(human)
		} catch (err) {
			logger.warn('company', `skipping invalid human file ${file}`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
	return humans
}

/** Read and validate a single workflow YAML file by its ID. */
export async function loadWorkflow(companyRoot: string, id: string) {
	return readYaml(resolvePath(companyRoot, workflowPath(id)), WorkflowSchema)
}

/** Read `team/schedules/*.yaml` and return an array of validated schedules. */
export async function loadSchedules(companyRoot: string) {
	const schedulesDir = resolvePath(companyRoot, PATHS.SCHEDULES_DIR)
	const schedules: Schedule[] = []
	if (!existsSync(schedulesDir)) return schedules

	const files = readdirSync(schedulesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const schedule = await readYaml(join(schedulesDir, file), ScheduleSchema)
			schedules.push(schedule)
		} catch (err) {
			logger.warn('company', `skipping invalid schedule file ${file}`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
	return schedules
}

/** Read `team/webhooks/*.yaml` and return an array of validated webhooks. */
export async function loadWebhooks(companyRoot: string) {
	const dir = resolvePath(companyRoot, PATHS.WEBHOOKS_DIR)
	const webhooks: Webhook[] = []
	if (!existsSync(dir)) return webhooks

	const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const webhook = await readYaml(join(dir, file), WebhookSchema)
			webhooks.push(webhook)
		} catch (err) {
			logger.warn('company', `skipping invalid webhook file ${file}`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
	return webhooks
}
