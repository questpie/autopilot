import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigManager } from '../src/config/config-manager'
import { ConfigService } from '../src/config/config-service'
import { importAuthoredConfigFromScopes } from '../src/config/import-authored-config'
import { discoverScopes } from '../src/config/scope-resolver'
import { type CompanyDbResult, createCompanyDb } from '../src/db'
import { ProjectService } from '../src/services/projects'

let root: string
let dbResult: CompanyDbResult
let configService: ConfigService
let projectService: ProjectService

beforeAll(async () => {
	root = join(tmpdir(), `autopilot-config-db-${Date.now()}`)
	await mkdir(join(root, '.autopilot', 'agents'), { recursive: true })
	await mkdir(join(root, '.autopilot', 'workflows'), { recursive: true })
	await mkdir(join(root, '.autopilot', 'context'), { recursive: true })

	await writeFile(
		join(root, '.autopilot', 'company.yaml'),
		'name: Test Company\nslug: test-company\ndefaults:\n  runtime: claude-code\n  workflow: simple\n  task_assignee: dev\n',
	)
	await writeFile(
		join(root, '.autopilot', 'agents', 'dev.yaml'),
		'id: dev\nname: Developer\nrole: developer\ndescription: Default dev\n',
	)
	await writeFile(
		join(root, '.autopilot', 'workflows', 'simple.yaml'),
		'id: simple\nname: Simple\nsteps:\n  - id: implement\n    type: agent\n    agent_id: dev\n    instructions: Do work\n  - id: done\n    type: done\n',
	)
	await writeFile(join(root, '.autopilot', 'context', 'company.md'), '# Company context')

	dbResult = await createCompanyDb(root)
	configService = new ConfigService(dbResult.db)
	projectService = new ProjectService(dbResult.db)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(root, { recursive: true, force: true })
})

describe('DB-backed config loading', () => {
	test('imports authored config from filesystem scopes into DB', async () => {
		const chain = await discoverScopes(root)
		await importAuthoredConfigFromScopes(configService, projectService, chain)

		const config = await configService.loadAuthoredConfig(null)
		expect(config.company.name).toBe('Test Company')
		expect(config.defaults.workflow).toBe('simple')
		expect(config.agents.get('dev')?.name).toBe('Developer')
		expect(config.workflows.get('simple')?.steps[0]?.id).toBe('implement')
		expect(config.context.get('company')).toBe('# Company context')
	})

	test('ConfigManager reload() swaps from DB service', async () => {
		const initial = await configService.loadAuthoredConfig(null)
		const manager = new ConfigManager(initial, {
			companyRoot: root,
			configService,
		})

		await configService.set('agents', 'dev', {
			id: 'dev',
			name: 'Developer Reloaded',
			role: 'developer',
			description: 'Reloaded from DB',
		})

		const result = await manager.reload()
		expect(result.ok).toBe(true)
		expect(manager.get().agents.get('dev')?.name).toBe('Developer Reloaded')
	})
})
