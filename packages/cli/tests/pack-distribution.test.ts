import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
	CompanyScopeSchema,
	PackManifestSchema,
	PackLockfileSchema,
	RegistriesFileSchema,
	PackDependencySchema,
} from '@questpie/autopilot-spec'
import { loadRegistries } from '../src/packs/registry-loader'
import { resolvePackFromGit } from '../src/packs/git-registry'
import { resolveAllPacks } from '../src/packs/resolver'
import { materializePacks } from '../src/packs/materializer'
import type { Registry } from '@questpie/autopilot-spec'

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Create a temp directory and return its path. */
async function makeTempDir(prefix = 'autopilot-test-'): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix))
}

/** Create a minimal git repo at the given path with a registry layout. */
function createGitRegistry(dir: string, packs: Array<{ id: string; name: string; category: string; version: string; files: Array<{ src: string; dest: string; content: string }> }>): void {
	mkdirSync(dir, { recursive: true })
	execSync('git init --initial-branch=main', { cwd: dir, stdio: 'pipe' })
	execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' })
	execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' })

	for (const pack of packs) {
		const packDir = join(dir, 'packs', pack.id)
		mkdirSync(packDir, { recursive: true })

		// Write pack.yaml
		const manifest = {
			id: pack.id,
			name: pack.name,
			category: pack.category,
			version: pack.version,
			files: pack.files.map((f) => ({ src: f.src, dest: f.dest })),
		}
		writeFileSync(join(packDir, 'pack.yaml'), stringifyYaml(manifest))

		// Write source files
		for (const file of pack.files) {
			const filePath = join(packDir, file.src)
			mkdirSync(join(filePath, '..'), { recursive: true })
			writeFileSync(filePath, file.content)
		}
	}

	execSync('git add -A', { cwd: dir, stdio: 'pipe' })
	execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
}

/** Set up a company root with .autopilot/company.yaml. */
async function setupCompanyRoot(dir: string, packs: Array<{ ref: string; version?: string }> = []): Promise<void> {
	await mkdir(join(dir, '.autopilot'), { recursive: true })
	const config = {
		name: 'Test Company',
		slug: 'test-company',
		packs,
	}
	await writeFile(join(dir, '.autopilot', 'company.yaml'), stringifyYaml(config))
}

// ─── Schema Tests ─────────────────────────────────────────────────────────

describe('Pack schemas', () => {
	it('parses pack dependency with defaults', () => {
		const dep = PackDependencySchema.parse({ ref: 'questpie/claude-code-surface' })
		expect(dep.ref).toBe('questpie/claude-code-surface')
		expect(dep.version).toBe('latest')
	})

	it('parses pack dependency with explicit version', () => {
		const dep = PackDependencySchema.parse({ ref: 'questpie/workflow-pack', version: 'v1.0.0' })
		expect(dep.version).toBe('v1.0.0')
	})

	it('parses pack manifest', () => {
		const manifest = PackManifestSchema.parse({
			id: 'claude-code-surface',
			name: 'Claude Code Surface',
			category: 'surface',
			version: '1.0.0',
			files: [{ src: 'providers/claude-code.yaml', dest: 'providers/claude-code.yaml' }],
		})
		expect(manifest.id).toBe('claude-code-surface')
		expect(manifest.files).toHaveLength(1)
		expect(manifest.required_env).toEqual([])
		expect(manifest.manual_steps).toEqual([])
	})

	it('rejects pack manifest without files', () => {
		expect(() =>
			PackManifestSchema.parse({ id: 'bad', name: 'Bad', category: 'surface', version: '1.0.0', files: [] }),
		).toThrow()
	})

	it('parses registries file', () => {
		const parsed = RegistriesFileSchema.parse({
			registries: [
				{ id: 'questpie', type: 'git', url: 'https://github.com/questpie/autopilot-packs.git' },
			],
		})
		expect(parsed.registries).toHaveLength(1)
		expect(parsed.registries[0].default).toBe(false)
		expect(parsed.registries[0].priority).toBe(0)
	})

	it('parses lockfile', () => {
		const lockfile = PackLockfileSchema.parse({
			packs: {
				'questpie/claude-code-surface': {
					ref: 'questpie/claude-code-surface',
					registry: 'questpie',
					resolved_ref: 'main',
					commit: 'abc123',
					managed_files: ['.autopilot/providers/claude-code.yaml'],
					installed_at: '2026-04-04T00:00:00.000Z',
				},
			},
		})
		expect(Object.keys(lockfile.packs)).toHaveLength(1)
	})

	it('company scope schema accepts packs field', () => {
		const config = CompanyScopeSchema.parse({
			name: 'Test',
			slug: 'test',
			packs: [{ ref: 'questpie/workflow-pack' }],
		})
		expect(config.packs).toHaveLength(1)
		expect(config.packs[0].version).toBe('latest')
	})

	it('company scope schema defaults packs to empty', () => {
		const config = CompanyScopeSchema.parse({ name: 'Test', slug: 'test' })
		expect(config.packs).toEqual([])
	})
})

// ─── Registry Loading ─────────────────────────────────────────────────────

describe('Registry loading', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await makeTempDir()
		await setupCompanyRoot(tempDir)
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it('returns empty array when no registries configured', () => {
		const registries = loadRegistries(tempDir)
		expect(registries).toEqual([])
	})

	it('loads repo-local registries', async () => {
		await writeFile(
			join(tempDir, '.autopilot', 'registries.yaml'),
			stringifyYaml({
				registries: [{ id: 'local-reg', type: 'git', url: '/tmp/fake-repo' }],
			}),
		)

		const registries = loadRegistries(tempDir)
		expect(registries).toHaveLength(1)
		expect(registries[0].id).toBe('local-reg')
	})

	it('sorts registries by priority descending', async () => {
		await writeFile(
			join(tempDir, '.autopilot', 'registries.yaml'),
			stringifyYaml({
				registries: [
					{ id: 'low', type: 'git', url: '/tmp/a', priority: 1 },
					{ id: 'high', type: 'git', url: '/tmp/b', priority: 10 },
				],
			}),
		)

		const registries = loadRegistries(tempDir)
		expect(registries[0].id).toBe('high')
		expect(registries[1].id).toBe('low')
	})
})

// ─── Git Registry Backend ─────────────────────────────────────────────────

describe('Git registry backend', () => {
	let tempDir: string
	let registryDir: string

	beforeEach(async () => {
		tempDir = await makeTempDir()
		registryDir = await makeTempDir('autopilot-registry-')
		await setupCompanyRoot(tempDir)

		createGitRegistry(registryDir, [
			{
				id: 'test-workflow',
				name: 'Test Workflow',
				category: 'workflow',
				version: '1.0.0',
				files: [
					{ src: 'workflows/test.yaml', dest: 'workflows/test.yaml', content: 'id: test\nname: Test\nsteps: []' },
				],
			},
			{
				id: 'test-surface',
				name: 'Test Surface',
				category: 'surface',
				version: '1.0.0',
				files: [
					{ src: 'providers/test.yaml', dest: 'providers/test.yaml', content: 'id: test-provider\nkind: notification_channel' },
					{ src: 'handlers/test.ts', dest: 'handlers/test.ts', content: 'export default {}' },
				],
			},
		])
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
		await rm(registryDir, { recursive: true, force: true })
	})

	it('resolves a pack from a local git registry', () => {
		const registry: Registry = { id: 'test', type: 'git', url: registryDir, default: true, priority: 0 }
		const result = resolvePackFromGit('test-workflow', 'latest', registry, tempDir)

		expect(result).not.toBeNull()
		expect(result!.manifest.id).toBe('test-workflow')
		expect(result!.manifest.category).toBe('workflow')
		expect(result!.commit).toMatch(/^[0-9a-f]{40}$/)
	})

	it('returns null for missing pack', () => {
		const registry: Registry = { id: 'test', type: 'git', url: registryDir, default: true, priority: 0 }
		const result = resolvePackFromGit('nonexistent', 'latest', registry, tempDir)
		expect(result).toBeNull()
	})

	it('resolves pack with multiple files', () => {
		const registry: Registry = { id: 'test', type: 'git', url: registryDir, default: true, priority: 0 }
		const result = resolvePackFromGit('test-surface', 'latest', registry, tempDir)

		expect(result).not.toBeNull()
		expect(result!.manifest.files).toHaveLength(2)
	})
})

// ─── Pack Resolver ────────────────────────────────────────────────────────

describe('Pack resolver', () => {
	let tempDir: string
	let registryDir: string
	let testRegistry: Registry

	beforeEach(async () => {
		tempDir = await makeTempDir()
		registryDir = await makeTempDir('autopilot-registry-')
		await setupCompanyRoot(tempDir)

		createGitRegistry(registryDir, [
			{
				id: 'workflow-a',
				name: 'Workflow A',
				category: 'workflow',
				version: '1.0.0',
				files: [{ src: 'workflows/a.yaml', dest: 'workflows/a.yaml', content: 'id: a' }],
			},
		])

		testRegistry = { id: 'test', type: 'git', url: registryDir, default: true, priority: 0 }
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
		await rm(registryDir, { recursive: true, force: true })
	})

	it('resolves packs by qualified ref', () => {
		const result = resolveAllPacks(
			[{ ref: 'test/workflow-a', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
		expect(result.errors).toHaveLength(0)
	})

	it('resolves packs by unqualified ref across registries', () => {
		const result = resolveAllPacks(
			[{ ref: 'workflow-a', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
	})

	it('reports error for missing pack', () => {
		const result = resolveAllPacks(
			[{ ref: 'test/nonexistent', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		expect(result.resolved).toHaveLength(0)
		expect(result.errors).toHaveLength(1)
		expect(result.errors[0]).toContain('nonexistent')
	})

	it('reports error when registry not found', () => {
		const result = resolveAllPacks(
			[{ ref: 'missing-registry/workflow-a', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		expect(result.resolved).toHaveLength(0)
		expect(result.errors).toHaveLength(1)
	})
})

// ─── Pack Materializer ───────────────────────────────────────────────────

describe('Pack materializer', () => {
	let tempDir: string
	let registryDir: string
	let testRegistry: Registry

	beforeEach(async () => {
		tempDir = await makeTempDir()
		registryDir = await makeTempDir('autopilot-registry-')
		await setupCompanyRoot(tempDir)

		createGitRegistry(registryDir, [
			{
				id: 'workflow-pack',
				name: 'Workflow Pack',
				category: 'workflow',
				version: '1.0.0',
				files: [
					{ src: 'workflows/default.yaml', dest: 'workflows/default.yaml', content: 'id: default\nname: Default Workflow' },
					{ src: 'context/guide.md', dest: 'context/guide.md', content: '# Pack Guide' },
				],
			},
		])

		testRegistry = { id: 'test', type: 'git', url: registryDir, default: true, priority: 0 }
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
		await rm(registryDir, { recursive: true, force: true })
	})

	it('materializes pack files into .autopilot/', () => {
		const { resolved } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		const result = materializePacks(resolved, tempDir)

		expect(result.installed).toContain('test/workflow-pack')
		expect(result.conflicts).toHaveLength(0)

		// Check files were written
		const workflowPath = join(tempDir, '.autopilot', 'workflows', 'default.yaml')
		expect(existsSync(workflowPath)).toBe(true)
		expect(readFileSync(workflowPath, 'utf-8')).toBe('id: default\nname: Default Workflow')

		const contextPath = join(tempDir, '.autopilot', 'context', 'guide.md')
		expect(existsSync(contextPath)).toBe(true)
		expect(readFileSync(contextPath, 'utf-8')).toBe('# Pack Guide')
	})

	it('creates lockfile after materialization', () => {
		const { resolved } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		materializePacks(resolved, tempDir)

		const lockPath = join(tempDir, '.autopilot', 'packs.lock.yaml')
		expect(existsSync(lockPath)).toBe(true)

		const lockfile = PackLockfileSchema.parse(parseYaml(readFileSync(lockPath, 'utf-8')))
		const entry = lockfile.packs['test/workflow-pack']
		expect(entry).toBeDefined()
		expect(entry.registry).toBe('test')
		expect(entry.managed_files).toContain('.autopilot/workflows/default.yaml')
		expect(entry.managed_files).toContain('.autopilot/context/guide.md')
		expect(entry.commit).toMatch(/^[0-9a-f]{40}$/)
	})

	it('detects conflicts with unmanaged files', () => {
		// Pre-create a file that would conflict
		mkdirSync(join(tempDir, '.autopilot', 'workflows'), { recursive: true })
		writeFileSync(join(tempDir, '.autopilot', 'workflows', 'default.yaml'), 'id: my-custom-workflow')

		const { resolved } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		const result = materializePacks(resolved, tempDir)

		expect(result.conflicts).toContain('.autopilot/workflows/default.yaml')
		// Original file should be untouched
		expect(readFileSync(join(tempDir, '.autopilot', 'workflows', 'default.yaml'), 'utf-8')).toBe('id: my-custom-workflow')
		// Non-conflicting file should still be written
		expect(existsSync(join(tempDir, '.autopilot', 'context', 'guide.md'))).toBe(true)
	})

	it('overwrites pack-managed files on re-sync', () => {
		const { resolved } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		// First install
		materializePacks(resolved, tempDir)

		// Modify managed file
		writeFileSync(join(tempDir, '.autopilot', 'workflows', 'default.yaml'), 'modified content')

		// Re-resolve to get fresh ResolvedPack (cache already populated)
		const { resolved: resolved2 } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		// Second install should overwrite managed files
		const result = materializePacks(resolved2, tempDir)

		expect(result.conflicts).toHaveLength(0)
		expect(result.installed).toContain('test/workflow-pack')
		expect(readFileSync(join(tempDir, '.autopilot', 'workflows', 'default.yaml'), 'utf-8')).toBe('id: default\nname: Default Workflow')
	})

	it('updates lockfile with new commit on re-sync', () => {
		const { resolved } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		materializePacks(resolved, tempDir)

		const lockPath = join(tempDir, '.autopilot', 'packs.lock.yaml')
		const lock1 = PackLockfileSchema.parse(parseYaml(readFileSync(lockPath, 'utf-8')))
		const commit1 = lock1.packs['test/workflow-pack'].commit

		// Re-install (same commit, but installed_at should update)
		const { resolved: resolved2 } = resolveAllPacks(
			[{ ref: 'test/workflow-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		materializePacks(resolved2, tempDir)

		const lock2 = PackLockfileSchema.parse(parseYaml(readFileSync(lockPath, 'utf-8')))
		expect(lock2.packs['test/workflow-pack'].commit).toBe(commit1) // same commit
	})
})

// ─── Default Registry Resolution (V1.1) ──────────────────────────────────

describe('Default registry resolution', () => {
	let tempDir: string
	let regDirA: string
	let regDirB: string

	beforeEach(async () => {
		tempDir = await makeTempDir()
		regDirA = await makeTempDir('autopilot-reg-a-')
		regDirB = await makeTempDir('autopilot-reg-b-')
		await setupCompanyRoot(tempDir)

		// Registry A has pack-alpha
		createGitRegistry(regDirA, [
			{
				id: 'pack-alpha',
				name: 'Pack Alpha',
				category: 'workflow',
				version: '1.0.0',
				files: [{ src: 'workflows/alpha.yaml', dest: 'workflows/alpha.yaml', content: 'id: alpha' }],
			},
		])

		// Registry B has pack-alpha too (different content) and pack-beta
		createGitRegistry(regDirB, [
			{
				id: 'pack-alpha',
				name: 'Pack Alpha from B',
				category: 'workflow',
				version: '2.0.0',
				files: [{ src: 'workflows/alpha.yaml', dest: 'workflows/alpha.yaml', content: 'id: alpha-from-b' }],
			},
			{
				id: 'pack-beta',
				name: 'Pack Beta',
				category: 'context',
				version: '1.0.0',
				files: [{ src: 'context/beta.md', dest: 'context/beta.md', content: '# Beta' }],
			},
		])
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
		await rm(regDirA, { recursive: true, force: true })
		await rm(regDirB, { recursive: true, force: true })
	})

	it('unqualified refs prefer default registries over non-defaults', () => {
		const regA: Registry = { id: 'reg-a', type: 'git', url: regDirA, default: false, priority: 10 }
		const regB: Registry = { id: 'reg-b', type: 'git', url: regDirB, default: true, priority: 0 }

		// reg-a has higher priority but is not default
		// reg-b is default → unqualified ref should resolve from reg-b
		const result = resolveAllPacks(
			[{ ref: 'pack-alpha', version: 'latest' }],
			[regA, regB],
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
		expect(result.resolved[0].registry.id).toBe('reg-b')
	})

	it('falls back to all registries when no defaults exist', () => {
		const regA: Registry = { id: 'reg-a', type: 'git', url: regDirA, default: false, priority: 10 }
		const regB: Registry = { id: 'reg-b', type: 'git', url: regDirB, default: false, priority: 0 }

		// No defaults → try all in priority order → reg-a wins (higher priority)
		const result = resolveAllPacks(
			[{ ref: 'pack-alpha', version: 'latest' }],
			[regA, regB],
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
		expect(result.resolved[0].registry.id).toBe('reg-a')
	})

	it('qualified refs bypass default logic entirely', () => {
		const regA: Registry = { id: 'reg-a', type: 'git', url: regDirA, default: false, priority: 0 }
		const regB: Registry = { id: 'reg-b', type: 'git', url: regDirB, default: true, priority: 10 }

		// Qualified ref targets reg-a directly, even though reg-b is default
		const result = resolveAllPacks(
			[{ ref: 'reg-a/pack-alpha', version: 'latest' }],
			[regA, regB],
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
		expect(result.resolved[0].registry.id).toBe('reg-a')
	})

	it('multiple defaults are tried in priority order', () => {
		const regA: Registry = { id: 'reg-a', type: 'git', url: regDirA, default: true, priority: 5 }
		const regB: Registry = { id: 'reg-b', type: 'git', url: regDirB, default: true, priority: 10 }

		// Both are default, reg-b has higher priority → reg-b wins
		// Registries pre-sorted by loadRegistries: priority desc
		const result = resolveAllPacks(
			[{ ref: 'pack-alpha', version: 'latest' }],
			[regB, regA], // sorted: priority 10, then 5
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
		expect(result.resolved[0].registry.id).toBe('reg-b')
	})

	it('unqualified ref not found in defaults does not fall back to non-defaults', () => {
		const regA: Registry = { id: 'reg-a', type: 'git', url: regDirA, default: false, priority: 10 }
		const regB: Registry = { id: 'reg-b', type: 'git', url: regDirB, default: true, priority: 0 }

		// pack-beta only exists in reg-b (which is default) — should resolve
		const result1 = resolveAllPacks([{ ref: 'pack-beta', version: 'latest' }], [regA, regB], tempDir)
		expect(result1.resolved).toHaveLength(1)

		// Now make reg-a the only default — pack-beta is not in reg-a
		const regA2: Registry = { ...regA, default: true }
		const regB2: Registry = { ...regB, default: false }

		const result2 = resolveAllPacks([{ ref: 'pack-beta', version: 'latest' }], [regA2, regB2], tempDir)
		expect(result2.resolved).toHaveLength(0)
		expect(result2.errors).toHaveLength(1)
	})
})

// ─── Zero-Materialization Lockfile (V1.1) ────────────────────────────────

describe('Zero-materialization lockfile handling', () => {
	let tempDir: string
	let registryDir: string
	let testRegistry: Registry

	beforeEach(async () => {
		tempDir = await makeTempDir()
		registryDir = await makeTempDir('autopilot-registry-')
		await setupCompanyRoot(tempDir)

		createGitRegistry(registryDir, [
			{
				id: 'conflict-pack',
				name: 'Conflict Pack',
				category: 'workflow',
				version: '1.0.0',
				files: [
					{ src: 'workflows/existing.yaml', dest: 'workflows/existing.yaml', content: 'id: from-pack' },
				],
			},
		])

		testRegistry = { id: 'test', type: 'git', url: registryDir, default: true, priority: 0 }
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
		await rm(registryDir, { recursive: true, force: true })
	})

	it('does not write lockfile entry when all files conflict', () => {
		// Pre-create the conflicting file
		mkdirSync(join(tempDir, '.autopilot', 'workflows'), { recursive: true })
		writeFileSync(join(tempDir, '.autopilot', 'workflows', 'existing.yaml'), 'id: user-owned')

		const { resolved } = resolveAllPacks(
			[{ ref: 'test/conflict-pack', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		const result = materializePacks(resolved, tempDir)

		expect(result.installed).toHaveLength(0)
		expect(result.conflicts).toHaveLength(1)

		// Lockfile should exist but have no entries for this pack
		const lockPath = join(tempDir, '.autopilot', 'packs.lock.yaml')
		expect(existsSync(lockPath)).toBe(true)
		const lockfile = PackLockfileSchema.parse(parseYaml(readFileSync(lockPath, 'utf-8')))
		expect(lockfile.packs['test/conflict-pack']).toBeUndefined()
	})

	it('does not write lockfile entry when source files are missing', async () => {
		// Create a registry where the pack manifest references a file that doesn't exist
		const badRegDir = await makeTempDir('autopilot-bad-reg-')
		mkdirSync(join(badRegDir, 'packs', 'ghost-pack'), { recursive: true })
		writeFileSync(
			join(badRegDir, 'packs', 'ghost-pack', 'pack.yaml'),
			stringifyYaml({
				id: 'ghost-pack',
				name: 'Ghost Pack',
				category: 'context',
				version: '1.0.0',
				files: [{ src: 'context/missing.md', dest: 'context/missing.md' }],
			}),
		)
		execSync('git init --initial-branch=main', { cwd: badRegDir, stdio: 'pipe' })
		execSync('git config user.email "test@test.com"', { cwd: badRegDir, stdio: 'pipe' })
		execSync('git config user.name "Test"', { cwd: badRegDir, stdio: 'pipe' })
		execSync('git add -A', { cwd: badRegDir, stdio: 'pipe' })
		execSync('git commit -m "init"', { cwd: badRegDir, stdio: 'pipe' })

		const badRegistry: Registry = { id: 'bad', type: 'git', url: badRegDir, default: true, priority: 0 }
		const { resolved } = resolveAllPacks(
			[{ ref: 'bad/ghost-pack', version: 'latest' }],
			[badRegistry],
			tempDir,
		)

		const result = materializePacks(resolved, tempDir)

		expect(result.installed).toHaveLength(0)
		expect(result.skipped).toHaveLength(1)

		const lockPath = join(tempDir, '.autopilot', 'packs.lock.yaml')
		const lockfile = PackLockfileSchema.parse(parseYaml(readFileSync(lockPath, 'utf-8')))
		expect(lockfile.packs['bad/ghost-pack']).toBeUndefined()

		await rm(badRegDir, { recursive: true, force: true })
	})
})

// ─── Existing Sync Behavior ──────────────────────────────────────────────

describe('Existing sync behavior preserved', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await makeTempDir()
		await setupCompanyRoot(tempDir)
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it('company.yaml without packs field parses cleanly', () => {
		const raw = readFileSync(join(tempDir, '.autopilot', 'company.yaml'), 'utf-8')
		// Remove packs from the written config to test backwards compat
		writeFileSync(
			join(tempDir, '.autopilot', 'company.yaml'),
			stringifyYaml({ name: 'Old Company', slug: 'old-company' }),
		)

		const config = CompanyScopeSchema.parse(
			parseYaml(readFileSync(join(tempDir, '.autopilot', 'company.yaml'), 'utf-8')),
		)
		expect(config.packs).toEqual([])
	})

	it('loadRegistries returns empty for company without registries', () => {
		const registries = loadRegistries(tempDir)
		expect(registries).toEqual([])
	})
})
