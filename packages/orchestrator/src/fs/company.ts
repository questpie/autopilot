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

export async function loadCompany(companyRoot: string) {
	return readYaml(resolvePath(companyRoot, PATHS.COMPANY_CONFIG), CompanySchema)
}

export async function loadAgents(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.AGENTS), AgentsFileSchema)
	return file.agents
}

export async function loadHumans(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.HUMANS), HumansFileSchema)
	return file.humans
}

export async function loadWorkflow(companyRoot: string, id: string) {
	return readYaml(resolvePath(companyRoot, workflowPath(id)), WorkflowSchema)
}

export async function loadSchedules(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.SCHEDULES), SchedulesFileSchema)
	return file.schedules
}

export async function loadWebhooks(companyRoot: string) {
	const file = await readYaml(resolvePath(companyRoot, PATHS.WEBHOOKS), WebhooksFileSchema)
	return file.webhooks
}
