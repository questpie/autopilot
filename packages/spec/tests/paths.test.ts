import { describe, test, expect } from 'bun:test'
import { PATHS } from '../src/paths'

describe('PATHS', () => {
	test('all values are relative strings (no leading /)', () => {
		for (const [_key, value] of Object.entries(PATHS)) {
			expect(typeof value).toBe('string')
			expect(value.startsWith('/')).toBe(false)
		}
	})

	test('scope markers', () => {
		expect(PATHS.AUTOPILOT_DIR).toBe('.autopilot')
		expect(PATHS.COMPANY_CONFIG).toBe('.autopilot/company.yaml')
		expect(PATHS.PROJECT_CONFIG).toBe('.autopilot/project.yaml')
	})

	test('authored config dirs under .autopilot/', () => {
		expect(PATHS.AGENTS_DIR).toBe('.autopilot/agents')
		expect(PATHS.WORKFLOWS_DIR).toBe('.autopilot/workflows')
		expect(PATHS.ENVIRONMENTS_DIR).toBe('.autopilot/environments')
		expect(PATHS.SKILLS_DIR).toBe('.autopilot/skills')
		expect(PATHS.CONTEXT_DIR).toBe('.autopilot/context')
	})

	test('runtime state dirs', () => {
		expect(PATHS.DATA_DIR).toBe('.data')
		expect(PATHS.WORKTREES_DIR).toBe('.worktrees')
	})
})
