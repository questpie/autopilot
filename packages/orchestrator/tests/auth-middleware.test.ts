import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { getRequiredPermission, resolveActor } from '../src/auth/middleware'
import { checkPermission, loadRoles, resolveRolePermissions } from '../src/auth/roles'
import type { Actor } from '../src/auth/types'
import { writeYaml } from '../src/fs/yaml'
import { createTestCompany } from './helpers'

describe('resolveActor', () => {
	test('returns webhook actor for /hooks/* without credentials', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			// Configure webhook with auth: none so no HMAC is required
			await writeYaml(join(root, 'team', 'webhooks', 'hooks-test.yaml'), { id: 'hooks-test', path: '/hooks/test', auth: 'none', enabled: true, agent: 'dev', action: { type: 'spawn_agent' } })
			const request = new Request('http://localhost:7778/hooks/test')
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {} as any,
			})

			expect(actor).not.toBeNull()
			expect((actor as Actor).id).toBe('webhook')
			expect((actor as Actor).role).toBe('viewer')
			expect((actor as Actor).type).toBe('api')
		} finally {
			await cleanup()
		}
	})

	test('returns null when no credentials are provided', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const request = new Request('http://localhost:7778/api/tasks')
			const actor = await resolveActor(request, {
				companyRoot: root,
				auth: {
					api: {
						getSession: async () => null,
					},
				} as any,
			})

			expect(actor).toBeNull()
		} finally {
			await cleanup()
		}
	})
})

describe('resolveActor 2FA enforcement for owner/admin', () => {
	async function makeSessionAuth(root: string, role: string, twoFactorEnabled: boolean) {
		await writeYaml(join(root, 'team', 'humans', 'user.yaml'), { id: 'user', email: 'user@example.com', role, name: 'User' })
		return {
			companyRoot: root,
			auth: {
				api: {
					getSession: async () => ({
						user: {
							id: 'user-1',
							email: 'user@example.com',
							name: 'Test User',
							twoFactorEnabled,
						},
						twoFactorVerified: twoFactorEnabled, // only set when 2FA is enabled and done
					}),
				},
			} as any,
		}
	}

	test('owner WITHOUT 2FA enabled returns null for non-auth paths', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const config = await makeSessionAuth(root, 'owner', false)
			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer some-token' },
			})
			const actor = await resolveActor(request, config)
			expect(actor).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('admin WITHOUT 2FA enabled returns null for non-auth paths', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const config = await makeSessionAuth(root, 'admin', false)
			const request = new Request('http://localhost:7778/api/agents', {
				headers: { Authorization: 'Bearer some-token' },
			})
			const actor = await resolveActor(request, config)
			expect(actor).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('owner WITHOUT 2FA enabled is allowed through /api/auth/* paths', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const config = await makeSessionAuth(root, 'owner', false)
			const request = new Request('http://localhost:7778/api/auth/two-factor/enable', {
				headers: { Authorization: 'Bearer some-token' },
			})
			const actor = await resolveActor(request, config)
			expect(actor).not.toBeNull()
			expect(actor!.role).toBe('owner')
		} finally {
			await cleanup()
		}
	})

	test('member WITHOUT 2FA enabled is allowed (no 2FA requirement for members)', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const config = await makeSessionAuth(root, 'member', false)
			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer some-token' },
			})
			const actor = await resolveActor(request, config)
			expect(actor).not.toBeNull()
			expect(actor!.role).toBe('member')
		} finally {
			await cleanup()
		}
	})

	test('owner WITH 2FA enabled resolves normally', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const config = await makeSessionAuth(root, 'owner', true)
			const request = new Request('http://localhost:7778/api/tasks', {
				headers: { Authorization: 'Bearer some-token' },
			})
			const actor = await resolveActor(request, config)
			expect(actor).not.toBeNull()
			expect(actor!.role).toBe('owner')
		} finally {
			await cleanup()
		}
	})

	test('admin WITH 2FA enabled resolves normally', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const config = await makeSessionAuth(root, 'admin', true)
			const request = new Request('http://localhost:7778/api/agents', {
				headers: { Authorization: 'Bearer some-token' },
			})
			const actor = await resolveActor(request, config)
			expect(actor).not.toBeNull()
			expect(actor!.role).toBe('admin')
		} finally {
			await cleanup()
		}
	})
})

describe('getRequiredPermission', () => {
	test('maps task endpoints correctly', () => {
		expect(getRequiredPermission('/api/tasks', 'GET')).toEqual({
			resource: 'tasks',
			action: 'read',
		})
		expect(getRequiredPermission('/api/tasks', 'POST')).toEqual({
			resource: 'tasks',
			action: 'create',
		})
		expect(getRequiredPermission('/api/tasks/123/approve', 'POST')).toEqual({
			resource: 'tasks',
			action: 'approve',
		})
		expect(getRequiredPermission('/api/tasks/123/reject', 'POST')).toEqual({
			resource: 'tasks',
			action: 'reject',
		})
		expect(getRequiredPermission('/api/tasks/123', 'DELETE')).toEqual({
			resource: 'tasks',
			action: 'delete',
		})
	})

	test('maps team endpoints correctly', () => {
		expect(getRequiredPermission('/api/team', 'GET')).toEqual({ resource: 'team', action: 'read' })
		expect(getRequiredPermission('/api/team/invite', 'POST')).toEqual({
			resource: 'team',
			action: 'invite',
		})
		expect(getRequiredPermission('/api/team/user-123/role', 'PUT')).toEqual({
			resource: 'team',
			action: 'change_role',
		})
		expect(getRequiredPermission('/api/team/user-123', 'DELETE')).toEqual({
			resource: 'team',
			action: 'remove',
		})
	})

	test('maps agent endpoints', () => {
		expect(getRequiredPermission('/api/agents', 'GET')).toEqual({
			resource: 'agents',
			action: 'read',
		})
		expect(getRequiredPermission('/api/agents/ceo', 'PUT')).toEqual({
			resource: 'agents',
			action: 'configure',
		})
	})

	test('maps chat endpoint', () => {
		expect(getRequiredPermission('/api/chat', 'POST')).toEqual({
			resource: 'chat',
			action: 'write',
		})
	})

	test('returns null for unknown paths', () => {
		expect(getRequiredPermission('/api/unknown', 'GET')).toBeNull()
	})

	test('maps /api/status to null (public)', () => {
		expect(getRequiredPermission('/api/status', 'GET')).toBeNull()
	})
})

describe('checkPermission', () => {
	test('grants access for wildcard permissions', () => {
		const owner: Actor = {
			id: 'owner',
			type: 'human',
			name: 'Owner',
			role: 'owner',
			permissions: { '*': ['*'] },
			source: 'dashboard',
		}
		expect(checkPermission(owner, 'tasks', 'create')).toBe(true)
		expect(checkPermission(owner, 'secrets', 'delete')).toBe(true)
	})

	test('denies access for missing resource', () => {
		const viewer: Actor = {
			id: 'viewer',
			type: 'human',
			name: 'Viewer',
			role: 'viewer',
			permissions: { tasks: ['read'], agents: ['read'] },
			source: 'dashboard',
		}
		expect(checkPermission(viewer, 'secrets', 'read')).toBe(false)
	})

	test('denies access for missing action', () => {
		const member: Actor = {
			id: 'member',
			type: 'human',
			name: 'Member',
			role: 'member',
			permissions: { tasks: ['read', 'create', 'update'] },
			source: 'dashboard',
		}
		expect(checkPermission(member, 'tasks', 'delete')).toBe(false)
		expect(checkPermission(member, 'tasks', 'read')).toBe(true)
	})
})

describe('loadRoles', () => {
	test('loads roles from YAML and resolves permissions', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await writeYaml(join(root, 'team', 'roles.yaml'), {
				roles: {
					owner: {
						description: 'Full access',
						permissions: ['*'],
					},
					admin: {
						description: 'Admin access',
						permissions: ['tasks.*', 'agents.read', 'chat.*'],
					},
					viewer: {
						description: 'Read-only',
						permissions: ['tasks.read', 'agents.read'],
					},
				},
			})

			await loadRoles(root)

			const ownerPerms = resolveRolePermissions('owner')
			expect(ownerPerms.tasks).toBeDefined()
			expect(ownerPerms.tasks!.length).toBeGreaterThan(0)

			const adminPerms = resolveRolePermissions('admin')
			expect(adminPerms.tasks).toBeDefined()
			expect(adminPerms.agents).toEqual(['read'])
			expect(adminPerms.chat).toBeDefined()

			const viewerPerms = resolveRolePermissions('viewer')
			expect(viewerPerms.tasks).toEqual(['read'])
			expect(viewerPerms.agents).toEqual(['read'])
			expect(viewerPerms.secrets).toBeUndefined()
		} finally {
			await cleanup()
		}
	})
})
