/**
 * YAML-driven role loading and permission checking.
 *
 * Roles are defined in team/roles.yaml and loaded at startup.
 * The watcher reloads roles on file changes.
 */
import { join } from 'node:path'
import { readYaml } from '../fs/yaml'
import { RolesFileSchema, type RolesFile } from '@questpie/autopilot-spec'
import { PERMISSION_ACTIONS } from '@questpie/autopilot-spec'
import type { Actor } from './types'

let cachedRoles: RolesFile | null = null

/**
 * Load roles from team/roles.yaml.
 * Called at startup and on watcher reload.
 */
export async function loadRoles(companyRoot: string): Promise<RolesFile> {
	const rolesFile = await readYaml(
		join(companyRoot, 'team', 'roles.yaml'),
		RolesFileSchema,
	)
	cachedRoles = rolesFile
	return rolesFile
}

/** Get the currently cached roles (loaded at startup). */
export function getCachedRoles(): RolesFile | null {
	return cachedRoles
}

/** Clear cached roles and reload from disk. */
export async function reloadRoles(companyRoot: string): Promise<void> {
	cachedRoles = null
	await loadRoles(companyRoot)
}

/**
 * Resolve a role name into a permissions map.
 * Returns { resource: [actions] } based on the YAML role definition.
 */
export function resolveRolePermissions(roleName: string): Record<string, string[]> {
	if (!cachedRoles) return {}

	const roleDef = cachedRoles.roles[roleName]
	if (!roleDef) return {}

	if (roleDef.permissions.includes('*')) {
		return Object.fromEntries(
			Object.entries(PERMISSION_ACTIONS).map(([r, a]) => [r, [...a]]),
		)
	}

	const perms: Record<string, string[]> = {}
	for (const p of roleDef.permissions) {
		const [resource, action] = p.split('.')
		if (!resource || !action) continue
		if (!perms[resource]) perms[resource] = []
		if (action === '*') {
			const resourceActions = PERMISSION_ACTIONS[resource as keyof typeof PERMISSION_ACTIONS]
			if (resourceActions) {
				perms[resource] = [...resourceActions]
			}
		} else {
			perms[resource]!.push(action)
		}
	}

	return perms
}

/**
 * Check if an actor has permission to perform an action on a resource.
 * Wildcard '*' in permissions grants all actions on all resources.
 */
export function checkPermission(
	actor: Actor,
	resource: string,
	action: string,
): boolean {
	const perms = actor.permissions

	// Wildcard — full access
	if (perms['*']) return true

	const resourcePerms = perms[resource]
	if (!resourcePerms) return false

	return resourcePerms.includes(action) || resourcePerms.includes('*')
}
