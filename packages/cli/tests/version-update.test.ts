import { describe, expect, test } from 'bun:test'
import { program } from '../src/index'
import { loadPackageVersions, getVersionInfo } from '../src/commands/version'
import { parseChannel, checkForUpdate } from '../src/commands/update'

describe('version command', () => {
	test('is registered on the CLI program', () => {
		const names = program.commands.map((c) => c.name())
		expect(names).toContain('version')
	})

	test('has --url, --offline, and --json options', () => {
		const cmd = program.commands.find((c) => c.name() === 'version')!
		const optionNames = cmd.options.map((o) => o.long)
		expect(optionNames).toContain('--url')
		expect(optionNames).toContain('--offline')
		expect(optionNames).toContain('--json')
	})

	test('loadPackageVersions returns CLI version and optional sibling versions', () => {
		const versions = loadPackageVersions()
		expect(typeof versions.cli).toBe('string')
		expect(versions.cli.length).toBeGreaterThan(0)
		// In monorepo, siblings are available; in published layout they may be null
		for (const key of ['orchestrator', 'worker', 'spec'] as const) {
			const v = versions[key]
			expect(v === null || typeof v === 'string').toBe(true)
		}
	})

	test('getVersionInfo returns CLI version in offline mode', async () => {
		const result = await getVersionInfo({ offline: true })
		expect(result.cli).toBeDefined()
		expect(result.packages.cli).toBe(result.cli)
		expect(result.orchestrator).toBeUndefined()
	})

	test('getVersionInfo without URL skips orchestrator check', async () => {
		const saved = process.env.ORCHESTRATOR_URL
		delete process.env.ORCHESTRATOR_URL
		try {
			const result = await getVersionInfo({})
			expect(result.orchestrator).toBeUndefined()
		} finally {
			if (saved) process.env.ORCHESTRATOR_URL = saved
		}
	})
})

describe('update command', () => {
	test('is registered on the CLI program', () => {
		const names = program.commands.map((c) => c.name())
		expect(names).toContain('update')
	})

	test('has check and status subcommands', () => {
		const cmd = program.commands.find((c) => c.name() === 'update')!
		const subNames = cmd.commands.map((c) => c.name())
		expect(subNames).toContain('check')
		expect(subNames).toContain('status')
	})

	test('parseChannel accepts stable and canary', () => {
		expect(parseChannel('stable')).toBe('stable')
		expect(parseChannel('canary')).toBe('canary')
		expect(parseChannel('Stable')).toBe('stable')
		expect(parseChannel('CANARY')).toBe('canary')
	})

	test('parseChannel rejects unknown channels', () => {
		expect(() => parseChannel('beta')).toThrow('Unknown channel')
		expect(() => parseChannel('nightly')).toThrow('Unknown channel')
		expect(() => parseChannel('')).toThrow('Unknown channel')
	})

	test('checkForUpdate returns current version even on network failure', async () => {
		const result = await checkForUpdate('stable')
		expect(result.currentVersion).toBeDefined()
		expect(result.channel).toBe('stable')
		expect(result.source).toBe('npm')
		// Either succeeds with a version or fails with an error — both valid
		expect(typeof result.updateAvailable).toBe('boolean')
	})
})

describe('doctor version integration', () => {
	test('doctor checks include cli-version', async () => {
		const { runDoctorChecks } = await import('../src/commands/doctor')
		const { mkdtempSync } = await import('node:fs')
		const { tmpdir } = await import('node:os')
		const { join } = await import('node:path')

		const root = mkdtempSync(join(tmpdir(), 'autopilot-version-doctor-'))
		const checks = await runDoctorChecks({
			cwd: root,
			offline: true,
			runtimes: [],
			env: {},
		})

		const versionCheck = checks.find((c) => c.id === 'cli-version')
		expect(versionCheck).toBeDefined()
		expect(versionCheck!.status).toBe('pass')
		expect(versionCheck!.message).toContain('@questpie/autopilot')
	})
})
