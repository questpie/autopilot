/**
 * Simple role checking utilities.
 *
 * For now, roles are hardcoded. When YAML-based role definitions
 * are needed again, this module will load from team/roles.yaml.
 */
import type { Actor } from './types'

/**
 * Check if an actor has permission to perform an action on a resource.
 * Currently a simple role-based check — owners and admins have full access,
 * members have read/write, viewers have read-only.
 */
export function checkPermission(
	actor: Actor,
	_resource: string,
	action: string,
): boolean {
	if (actor.role === 'owner' || actor.role === 'admin') return true
	if (actor.role === 'member') return true
	if (actor.role === 'viewer') return action === 'read'
	return false
}
