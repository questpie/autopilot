import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
	AgentSchema,
	WorkflowSchema,
	CompanySchema,
	EnvironmentSchema,
	PATHS,
} from '@questpie/autopilot-spec'
import type { z, ZodTypeDef } from 'zod'

export type Agent = z.output<typeof AgentSchema>
export type Workflow = z.output<typeof WorkflowSchema>
export type Company = z.output<typeof CompanySchema>
export type Environment = z.output<typeof EnvironmentSchema>

/** Load and validate the company config from `<companyRoot>/company.yaml`. */
export async function loadCompany(companyRoot: string): Promise<Company> {
	const path = join(companyRoot, PATHS.COMPANY_CONFIG)
	const raw = await readFile(path, 'utf-8')
	return CompanySchema.parse(parseYaml(raw))
}

/** Load all agent definitions from `<companyRoot>/team/agents/*.yaml`. */
export async function loadAgents(companyRoot: string) {
	const dir = join(companyRoot, PATHS.AGENTS_DIR)
	return loadYamlDir(dir, AgentSchema)
}

/** Load all workflow definitions from `<companyRoot>/team/workflows/*.yaml`. */
export async function loadWorkflows(companyRoot: string) {
	const dir = join(companyRoot, PATHS.WORKFLOWS_DIR)
	return loadYamlDir(dir, WorkflowSchema)
}

/** Load all environment definitions from `<companyRoot>/team/environments/*.yaml`. */
export async function loadEnvironments(companyRoot: string) {
	const dir = join(companyRoot, PATHS.ENVIRONMENTS_DIR)
	return loadYamlDir(dir, EnvironmentSchema)
}

/** Generic helper: read all YAML files in a directory and validate against a schema. */
async function loadYamlDir<T>(dir: string, schema: z.ZodType<T, ZodTypeDef, unknown>): Promise<T[]> {
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
