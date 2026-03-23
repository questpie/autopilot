import { describe, test, expect } from 'bun:test'
import { resolveActor, getRequiredPermission } from '../src/auth/middleware'
import { checkPermission, resolveRolePermissions, loadRoles } from '../src/auth/roles'
import type { Actor } from '../src/auth/types'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import { join } from 'node:path'

describe('resolveActor', () => {
	test('returns implicit owner when auth disabled', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const request = new Request('http://localhost:7778/api/status')
			const actor = await resolveActor(request, {
				authEnabled: false,
				companyRoot: root,
				auth: {} as any,
			})

			expect(actor).not.toBeNull()
			expect(actor!.id).toBe('implicit-owner')
			expect(actor!.role).toBe('owner')
			expect(actor!.type).toBe('human')
		} finally {
			await cleanup()
		}
	})

	test('returns null when auth enabled and no credentials', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const request = new Request('http://localhost:7778/api/tasks')
			const actor = await resolveActor(request, {
				authEnabled: true,
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

describe('getRequiredPermission', () => {
	test('maps task endpoints correctly', () => {
		expect(getRequiredPermission('/api/tasks', 'GET')).toEqual({ resource: 'tasks', action: 'read' })
		expect(getRequiredPermission('/api/tasks', 'POST')).toEqual({ resource: 'tasks', action: 'create' })
		expect(getRequiredPermission('/api/tasks/123/approve', 'POST')).toEqual({ resource: 'tasks', action: 'approve' })
		expect(getRequiredPermission('/api/tasks/123/reject', 'POST')).toEqual({ resource: 'tasks', action: 'reject' })
		expect(getRequiredPermission('/api/tasks/123', 'DELETE')).toEqual({ resource: 'tasks', action: 'delete' })
	})

	test('maps team endpoints correctly', () => {
		expect(getRequiredPermission('/api/team', 'GET')).toEqual({ resource: 'team', action: 'read' })
		expect(getRequiredPermission('/api/team/invite', 'POST')).toEqual({ resource: 'team', action: 'invite' })
		expect(getRequiredPermission('/api/team/user-123/role', 'PUT')).toEqual({ resource: 'team', action: 'change_role' })
		expect(getRequiredPermission('/api/team/user-123', 'DELETE')).toEqual({ resource: 'team', action: 'remove' })
	})

	test('maps agent endpoints', () => {
		expect(getRequiredPermission('/api/agents', 'GET')).toEqual({ resource: 'agents', action: 'read' })
		expect(getRequiredPermission('/api/agents/ceo', 'PUT')).toEqual({ resource: 'agents', action: 'configure' })
	})

	test('maps chat endpoint', () => {
		expect(getRequiredPermission('/api/chat', 'POST')).toEqual({ resource: 'chat', action: 'write' })
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
