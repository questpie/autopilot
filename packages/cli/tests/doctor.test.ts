import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { program } from '../src/index'
import { runDoctorChecks } from '../src/commands/doctor'

function tempRoot(): string {
	return mkdtempSync(join(tmpdir(), 'autopilot-doctor-'))
}

function writeBootstrapSkeleton(root: string): void {
	mkdirSync(join(root, '.autopilot', 'agents'), { recursive: true })
	mkdirSync(join(root, '.autopilot', 'workflows'), { recursive: true })
	writeFileSync(join(root, '.autopilot', 'company.yaml'), 'name: Test\nslug: test\n')
	writeFileSync(join(root, '.autopilot', 'agents', 'dev.yaml'), 'id: dev\nrole: developer\n')
	writeFileSync(join(root, '.autopilot', 'workflows', 'simple.yaml'), 'id: simple\nsteps: []\n')
}

describe('doctor command', () => {
	test('is registered on the CLI program', () => {
		const names = program.commands.map((command) => command.name())
		expect(names).toContain('doctor')
	})

	test('fails when no company root is present', async () => {
		const checks = await runDoctorChecks({
			cwd: tempRoot(),
			offline: true,
			runtimes: [],
			env: {},
		})

		const companyRoot = checks.find((check) => check.id === 'company-root')
		expect(companyRoot?.status).toBe('fail')
	})

	test('passes core checks for a bootstrapped production root with required secrets', async () => {
		const root = tempRoot()
		writeBootstrapSkeleton(root)

		const checks = await runDoctorChecks({
			cwd: root,
			offline: true,
			runtimes: [],
			env: {
				NODE_ENV: 'production',
				AUTOPILOT_MASTER_KEY: '0'.repeat(64),
				BETTER_AUTH_SECRET: '1'.repeat(64),
				ORCHESTRATOR_URL: 'http://localhost:7778',
				CORS_ORIGIN: 'http://localhost:7778',
			},
		})

		expect(checks.find((check) => check.id === 'company-root')?.status).toBe('pass')
		expect(checks.find((check) => check.id === 'agents')?.status).toBe('pass')
		expect(checks.find((check) => check.id === 'workflows')?.status).toBe('pass')
		expect(checks.find((check) => check.id === 'master-key')?.status).toBe('pass')
		expect(checks.find((check) => check.id === 'auth-secret')?.status).toBe('pass')
		expect(checks.some((check) => check.status === 'fail')).toBe(false)
	})

	test('fails invalid master key format', async () => {
		const root = tempRoot()
		writeBootstrapSkeleton(root)

		const checks = await runDoctorChecks({
			cwd: root,
			offline: true,
			runtimes: [],
			env: {
				NODE_ENV: 'production',
				AUTOPILOT_MASTER_KEY: 'not-hex',
				BETTER_AUTH_SECRET: '1'.repeat(64),
			},
		})

		expect(checks.find((check) => check.id === 'master-key')?.status).toBe('fail')
	})

	test('runtime availability only fails when required', async () => {
		const root = tempRoot()
		writeBootstrapSkeleton(root)

		const base = {
			cwd: root,
			offline: true,
			runtimes: ['definitely-missing-runtime'],
			env: {},
		}

		const optional = await runDoctorChecks(base)
		expect(optional.find((check) => check.id === 'runtime-any')?.status).toBe('warn')

		const required = await runDoctorChecks({ ...base, requireRuntime: true })
		expect(required.find((check) => check.id === 'runtime-any')?.status).toBe('fail')
	})
})
