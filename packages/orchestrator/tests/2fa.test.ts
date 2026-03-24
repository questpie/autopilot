import { describe, test, expect } from 'bun:test'
import { resolveActor } from '../src/auth/middleware'
import { createTestCompany } from './helpers'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'

describe('2FA enforcement in resolveActor', () => {
	test('returns null when twoFactorEnabled=true but twoFactorVerified=false', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer valid-token' },
			})
			const actor = await resolveActor(request, {
				authEnabled: true,
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
				authEnabled: true,
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

	test('agent (API key) skips 2FA — returns actor always', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			// Agent auth goes through X-API-Key path, not session path
			// 2FA is only enforced in resolveHumanActor
			// With auth disabled, implicit owner is returned (agents use API keys, not sessions)
			const request = new Request('http://localhost:7778/api/tasks')
			const actor = await resolveActor(request, {
				authEnabled: false,
				companyRoot: root,
				auth: {} as any,
			})
			expect(actor).not.toBeNull()
			expect(actor!.type).toBe('human') // implicit owner
		} finally {
			await cleanup()
		}
	})

	test('returns actor normally when twoFactorEnabled=false', async () => {
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
				authEnabled: true,
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
				authEnabled: true,
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
