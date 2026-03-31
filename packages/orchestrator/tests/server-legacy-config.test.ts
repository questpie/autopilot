import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { writeYaml } from '../src/fs/yaml'
import { Orchestrator } from '../src/server'
import { createTestCompany } from './helpers'

describe('legacy team config guard', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
	})

	afterEach(async () => {
		await cleanup()
	})

	test('allows startup when no legacy team config files exist', () => {
		const orchestrator = new Orchestrator({ companyRoot })
		expect(() => {
			;(
				orchestrator as unknown as { assertNoLegacyTeamConfig: (root: string) => void }
			).assertNoLegacyTeamConfig(companyRoot)
		}).not.toThrow()
	})

	test('throws when legacy team/agents.yaml exists', async () => {
		await mkdir(join(companyRoot, 'team'), { recursive: true })
		await writeYaml(join(companyRoot, 'team', 'agents.yaml'), {
			agents: [
				{
					id: 'dev',
					name: 'Dev',
					role: 'developer',
					description: 'legacy format',
					fs_scope: { read: ['**'], write: ['**'] },
				},
			],
		})

		const orchestrator = new Orchestrator({ companyRoot })
		expect(() => {
			;(
				orchestrator as unknown as { assertNoLegacyTeamConfig: (root: string) => void }
			).assertNoLegacyTeamConfig(companyRoot)
		}).toThrow('legacy file team/agents.yaml is no longer supported')
	})
})
