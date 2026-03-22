import { join } from 'node:path'
import {
	CompanySchema,
	AgentsFileSchema,
	HumansFileSchema,
	WorkflowSchema,
	SchedulesFileSchema,
	WebhooksFileSchema,
	PATHS,
	workflowPath,
} from '@questpie/autopilot-spec'
import { readYaml } from './yaml'

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath.replace(/^\/company/, ''))
}

/** Read and validate `company.yaml`. */
export async function loadCompany(companyRoot: string) {
	return readYaml(resolvePath(companyRoot, PATHS.COMPANY_CONFIG), CompanySchema)
}

/** Read `agents.yaml` and return the `agents` array. */
export async function loadAgents(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.AGENTS), AgentsFileSchema)
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

/** Read `schedules.yaml` and return the `schedules` array. */
export async function loadSchedules(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.SCHEDULES), SchedulesFileSchema)
	return file.schedules
}

/** Read `webhooks.yaml` and return the `webhooks` array. */
export async function loadWebhooks(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.WEBHOOKS), WebhooksFileSchema)
	return file.webhooks
}
