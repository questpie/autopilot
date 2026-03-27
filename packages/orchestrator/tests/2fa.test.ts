import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { hashApiKey } from '../src/auth/crypto'
import { resolveActor } from '../src/auth/middleware'
import { createTestCompany } from './helpers'

describe('2FA enforcement in resolveActor', () => {
	test('returns null when twoFactorEnabled=true but twoFactorVerified=false', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer valid-token' },
			})
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {
					api: {
						getSession: async () => ({
							user: { id: 'user-1', email: 'test@test.com', twoFactorEnabled: true },
							twoFactorVerified: false,
						}),
					},
				} as any,
			})
			expect(actor).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('returns actor when twoFactorEnabled=true and twoFactorVerified=true', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await writeFile(
				join(root, 'team', 'humans.yaml'),
				stringify({ humans: [{ email: 'test@test.com', role: 'member' }] }),
			)

			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer valid-token' },
			})
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {
					api: {
						getSession: async () => ({
							user: { id: 'user-1', email: 'test@test.com', name: 'Test', twoFactorEnabled: true },
							twoFactorVerified: true,
						}),
					},
				} as any,
			})
			expect(actor).not.toBeNull()
			expect(actor!.id).toBe('user-1')
		} finally {
			await cleanup()
		}
	})

	test('agent API key auth bypasses 2FA session checks', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const rawKey = 'ap_test-agent_example-test-key'

			await mkdir(join(root, '.auth'), { recursive: true })
			await writeFile(
				join(root, '.auth', 'agent-keys.yaml'),
				stringify({
					keys: [
						{
							agentId: 'test-agent',
							keyHash: hashApiKey(rawKey),
							createdAt: new Date().toISOString(),
						},
					],
				}),
			)

			await writeFile(
				join(root, 'team', 'agents.yaml'),
				stringify({
					agents: [
						{
							id: 'test-agent',
							name: 'Test Agent',
							role: 'developer',
							description: 'Test agent',
							fs_scope: { read: ['/**'], write: ['/tasks/**'] },
							tools: ['fs', 'terminal'],
						},
					],
				}),
			)

			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { 'X-API-Key': rawKey },
			})
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: { api: { getSession: async () => null } } as any,
			})
			expect(actor).not.toBeNull()
			expect(actor!.type).toBe('agent')
			expect(actor!.id).toBe('test-agent')
		} finally {
			await cleanup()
		}
	})

	test('blocks owner without 2FA on non-auth paths (mandatory 2FA)', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await writeFile(
				join(root, 'team', 'humans.yaml'),
				stringify({ humans: [{ email: 'test@test.com', role: 'owner' }] }),
			)

			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer valid-token' },
			})
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {
					api: {
						getSession: async () => ({
							user: { id: 'user-2', email: 'test@test.com', name: 'Test' },
						}),
					},
				} as any,
			})
			expect(actor).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('allows owner without 2FA on auth paths (to set up 2FA)', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await writeFile(
				join(root, 'team', 'humans.yaml'),
				stringify({ humans: [{ email: 'test@test.com', role: 'owner' }] }),
			)

			const request = new Request('http://localhost:7778/api/auth/two-factor/enable', {
				headers: { Authorization: 'Bearer valid-token' },
			})
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {
					api: {
						getSession: async () => ({
							user: { id: 'user-2', email: 'test@test.com', name: 'Test' },
						}),
					},
				} as any,
			})
			expect(actor).not.toBeNull()
			expect(actor!.id).toBe('user-2')
		} finally {
			await cleanup()
		}
	})

	test('returns actor when twoFactorEnabled is undefined (not set up)', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await writeFile(
				join(root, 'team', 'humans.yaml'),
				stringify({ humans: [{ email: 'test@test.com', role: 'member' }] }),
			)

			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer valid-token' },
			})
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {
					api: {
						getSession: async () => ({
							user: { id: 'user-3', email: 'test@test.com', name: 'Test' },
						}),
					},
				} as any,
			})
			expect(actor).not.toBeNull()
			expect(actor!.id).toBe('user-3')
		} finally {
			await cleanup()
		}
	})
})
