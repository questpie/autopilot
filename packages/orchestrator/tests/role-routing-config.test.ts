/**
 * D46: Role prompt caching tests — all functional.
 */
import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadRolePrompt, invalidateRoleCache } from '../src/context/assembler'

describe('D46: role prompt caching', () => {
	let tmpRoot: string

	beforeEach(async () => {
		invalidateRoleCache()
		tmpRoot = await mkdtemp(join(tmpdir(), 'role-cache-test-'))
		await mkdir(join(tmpRoot, 'team', 'roles'), { recursive: true })
	})

	afterAll(() => { invalidateRoleCache() })

	test('returns empty for missing role', () => {
		const result = loadRolePrompt(tmpRoot, 'nonexistent', { companyName: 'Test', teamRoster: '' })
		expect(result.prompt).toBe('')
		expect(result.defaults).toEqual({})
	})

	test('reads role file and returns prompt with variable substitution', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'developer.md'),
			'---\ndescription: A developer\n---\nYou are a developer at {{companyName}}.')
		const result = loadRolePrompt(tmpRoot, 'developer', { companyName: 'Acme', teamRoster: '' })
		expect(result.prompt).toContain('You are a developer at Acme')
		expect(result.defaults.description).toBe('A developer')
	})

	test('caches: second call with different vars still works', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'dev.md'),
			'---\ndescription: Dev\n---\nHello {{companyName}}.')
		const r1 = loadRolePrompt(tmpRoot, 'dev', { companyName: 'A', teamRoster: '' })
		const r2 = loadRolePrompt(tmpRoot, 'dev', { companyName: 'B', teamRoster: '' })
		expect(r1.prompt).toContain('Hello A')
		expect(r2.prompt).toContain('Hello B')
		expect(r1.defaults.description).toBe(r2.defaults.description)
	})

	test('invalidateRoleCache(role) clears specific role', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'a.md'), '---\n---\nRole A')
		await writeFile(join(tmpRoot, 'team', 'roles', 'b.md'), '---\n---\nRole B')
		loadRolePrompt(tmpRoot, 'a', { companyName: '', teamRoster: '' })
		loadRolePrompt(tmpRoot, 'b', { companyName: '', teamRoster: '' })
		invalidateRoleCache('a')
		expect(loadRolePrompt(tmpRoot, 'a', { companyName: '', teamRoster: '' }).prompt).toContain('Role A')
		expect(loadRolePrompt(tmpRoot, 'b', { companyName: '', teamRoster: '' }).prompt).toContain('Role B')
	})

	test('invalidateRoleCache() clears all', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'x.md'), '---\n---\nRole X')
		loadRolePrompt(tmpRoot, 'x', { companyName: '', teamRoster: '' })
		invalidateRoleCache()
		expect(loadRolePrompt(tmpRoot, 'x', { companyName: '', teamRoster: '' }).prompt).toContain('Role X')
	})

	test('replaces {{teamRoster}} variable', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'lead.md'), '---\n---\nTeam:\n{{teamRoster}}')
		const result = loadRolePrompt(tmpRoot, 'lead', { companyName: 'Acme', teamRoster: '- Alice\n- Bob' })
		expect(result.prompt).toContain('- Alice')
		expect(result.prompt).toContain('- Bob')
	})

	test('parses frontmatter defaults (tools, description)', async () => {
		await writeFile(join(tmpRoot, 'team', 'roles', 'ops.md'),
			'---\ndefault_tools:\n  - bash\n  - read_file\ndescription: Operations agent\n---\nDo ops.')
		const result = loadRolePrompt(tmpRoot, 'ops', { companyName: '', teamRoster: '' })
		expect(result.defaults.tools).toEqual(['bash', 'read_file'])
		expect(result.defaults.description).toBe('Operations agent')
	})
})
