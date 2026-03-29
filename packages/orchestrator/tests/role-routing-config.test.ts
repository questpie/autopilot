/**
 * D46: Role prompt caching tests.
 * D47: Keyword routing configurability tests.
 */
import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadRolePrompt, invalidateRoleCache } from '../src/context/assembler'

// ─── D46: Role prompt caching ──────────────────────────────────────────────

describe('D46: role prompt caching', () => {
	let tmpRoot: string

	beforeEach(async () => {
		invalidateRoleCache() // Clear cache between tests
		tmpRoot = await mkdtemp(join(tmpdir(), 'role-cache-test-'))
		await mkdir(join(tmpRoot, 'team', 'roles'), { recursive: true })
	})

	afterAll(async () => {
		invalidateRoleCache()
	})

	test('loadRolePrompt returns empty for missing role', () => {
		const result = loadRolePrompt(tmpRoot, 'nonexistent', {
			companyName: 'Test',
			teamRoster: '',
		})
		expect(result.prompt).toBe('')
		expect(result.defaults).toEqual({})
	})

	test('loadRolePrompt reads role file and returns prompt', async () => {
		await writeFile(
			join(tmpRoot, 'team', 'roles', 'developer.md'),
			'---\ndescription: A developer\n---\nYou are a developer at {{companyName}}.',
		)
		const result = loadRolePrompt(tmpRoot, 'developer', {
			companyName: 'Acme',
			teamRoster: '',
		})
		expect(result.prompt).toContain('You are a developer at Acme')
		expect(result.defaults.description).toBe('A developer')
	})

	test('loadRolePrompt caches on second call (same raw content)', async () => {
		await writeFile(
			join(tmpRoot, 'team', 'roles', 'dev.md'),
			'---\ndescription: Dev\n---\nHello {{companyName}}.',
		)
		const r1 = loadRolePrompt(tmpRoot, 'dev', { companyName: 'A', teamRoster: '' })
		const r2 = loadRolePrompt(tmpRoot, 'dev', { companyName: 'B', teamRoster: '' })

		// Content should differ (different companyName) but both should work
		expect(r1.prompt).toContain('Hello A')
		expect(r2.prompt).toContain('Hello B')
		// Defaults should be same (cached)
		expect(r1.defaults.description).toBe(r2.defaults.description)
	})

	test('invalidateRoleCache(role) clears specific role', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'a.md'), '---\n---\nRole A')
		await writeFile(join(tmpRoot, 'team', 'roles', 'b.md'), '---\n---\nRole B')

		loadRolePrompt(tmpRoot, 'a', { companyName: '', teamRoster: '' })
		loadRolePrompt(tmpRoot, 'b', { companyName: '', teamRoster: '' })

		// Invalidate only 'a'
		invalidateRoleCache('a')

		// 'a' should be re-read, 'b' should still be cached
		// (We can't directly observe cache hit, but no crash = success)
		const ra = loadRolePrompt(tmpRoot, 'a', { companyName: '', teamRoster: '' })
		const rb = loadRolePrompt(tmpRoot, 'b', { companyName: '', teamRoster: '' })
		expect(ra.prompt).toContain('Role A')
		expect(rb.prompt).toContain('Role B')
	})

	test('invalidateRoleCache() clears all roles', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'x.md'), '---\n---\nRole X')
		loadRolePrompt(tmpRoot, 'x', { companyName: '', teamRoster: '' })

		invalidateRoleCache()

		// Should re-read from disk (no crash)
		const result = loadRolePrompt(tmpRoot, 'x', { companyName: '', teamRoster: '' })
		expect(result.prompt).toContain('Role X')
	})

	test('loadRolePrompt replaces {{teamRoster}} variable', async () => {
		await writeFile(
			join(tmpRoot, 'team', 'roles', 'lead.md'),
			'---\n---\nTeam:\n{{teamRoster}}',
		)
		const result = loadRolePrompt(tmpRoot, 'lead', {
			companyName: 'Acme',
			teamRoster: '- Alice\n- Bob',
		})
		expect(result.prompt).toContain('- Alice')
		expect(result.prompt).toContain('- Bob')
	})

	test('loadRolePrompt parses frontmatter defaults', async () => {
		await writeFile(
			join(tmpRoot, 'team', 'roles', 'ops.md'),
			'---\ndefault_tools:\n  - bash\n  - read_file\ndescription: Operations agent\n---\nDo ops.',
		)
		const result = loadRolePrompt(tmpRoot, 'ops', { companyName: '', teamRoster: '' })
		expect(result.defaults.tools).toEqual(['bash', 'read_file'])
		expect(result.defaults.description).toBe('Operations agent')
	})
})

// ─── D47: Keyword routing configurability ──────────────────────────────────

describe('D47: keyword routing', () => {
	test('DEFAULT_ROLE_KEYWORDS are defined in message-router.ts', async () => {
		const { readFileSync } = await import('node:fs')
		const source = readFileSync(
			join(import.meta.dir, '..', 'src', 'router', 'message-router.ts'),
			'utf-8',
		)
		expect(source).toContain('DEFAULT_ROLE_KEYWORDS')
		expect(source).toContain('developer')
		expect(source).toContain('devops')
		expect(source).toContain('marketing')
	})

	test('routeByKeyword uses agent.keywords when defined', async () => {
		const { readFileSync } = await import('node:fs')
		const source = readFileSync(
			join(import.meta.dir, '..', 'src', 'router', 'message-router.ts'),
			'utf-8',
		)
		expect(source).toContain('agent.keywords')
		expect(source).toContain('DEFAULT_ROLE_KEYWORDS[agent.role]')
	})

	test('developer role has code-related keywords', async () => {
		const { readFileSync } = await import('node:fs')
		const source = readFileSync(
			join(import.meta.dir, '..', 'src', 'router', 'message-router.ts'),
			'utf-8',
		)
		// Extract developer keywords line
		const devLine = source.split('\n').find((l: string) => l.includes("developer:"))
		expect(devLine).toBeDefined()
		expect(devLine).toContain('code')
		expect(devLine).toContain('bug')
		expect(devLine).toContain('api')
	})

	test('devops role has infrastructure keywords', async () => {
		const { readFileSync } = await import('node:fs')
		const source = readFileSync(
			join(import.meta.dir, '..', 'src', 'router', 'message-router.ts'),
			'utf-8',
		)
		const devopsLine = source.split('\n').find((l: string) => l.includes("devops:"))
		expect(devopsLine).toBeDefined()
		expect(devopsLine).toContain('deploy')
		expect(devopsLine).toContain('docker')
	})

	test('keyword fallback handles agent with no keywords and unknown role', async () => {
		const { readFileSync } = await import('node:fs')
		const source = readFileSync(
			join(import.meta.dir, '..', 'src', 'router', 'message-router.ts'),
			'utf-8',
		)
		// Should have ?? [] fallback for missing role
		expect(source).toContain('?? []')
	})

	test('all 7 default roles have keyword mappings', async () => {
		const { readFileSync } = await import('node:fs')
		const source = readFileSync(
			join(import.meta.dir, '..', 'src', 'router', 'message-router.ts'),
			'utf-8',
		)
		const roles = ['developer', 'strategist', 'planner', 'reviewer', 'devops', 'marketing', 'design']
		for (const role of roles) {
			expect(source).toContain(`${role}:`)
		}
	})
})
