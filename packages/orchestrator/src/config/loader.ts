import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
	AgentSchema,
	WorkflowSchema,
	CompanySchema,
	PATHS,
} from '@questpie/autopilot-spec'
import type { z } from 'zod'

export type Agent = z.output<typeof AgentSchema>
export type Workflow = z.output<typeof WorkflowSchema>
export type Company = z.output<typeof CompanySchema>

/** Load and validate the company config from `<companyRoot>/company.yaml`. */
export async function loadCompany(companyRoot: string): Promise<Company> {
	const path = join(companyRoot, PATHS.COMPANY_CONFIG)
	const raw = await readFile(path, 'utf-8')
	return CompanySchema.parse(parseYaml(raw))
}

/** Load all agent definitions from `<companyRoot>/team/agents/*.yaml`. */
export async function loadAgents(companyRoot: string): Promise<Agent[]> {
	const dir = join(companyRoot, PATHS.AGENTS_DIR)
	return loadYamlDir(dir, AgentSchema) as Promise<Agent[]>
}

/** Load all workflow definitions from `<companyRoot>/team/workflows/*.yaml`. */
export async function loadWorkflows(companyRoot: string): Promise<Workflow[]> {
	const dir = join(companyRoot, PATHS.WORKFLOWS_DIR)
	return loadYamlDir(dir, WorkflowSchema) as Promise<Workflow[]>
}

/** Generic helper: read all YAML files in a directory and validate against a schema. */
// biome-ignore lint: zod input/output type mismatch requires broader generic
async function loadYamlDir<T>(dir: string, schema: z.ZodType<T>): Promise<unknown[]> {
	let files: string[]
	try {
		files = await readdir(dir)
	} catch {
		return []
	}

	const results: T[] = []
	for (const f of files) {
		if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue
		const raw = await readFile(join(dir, f), 'utf-8')
		results.push(schema.parse(parseYaml(raw)))
	}
	return results
}
