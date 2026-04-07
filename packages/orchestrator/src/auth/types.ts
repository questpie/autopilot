/**
 * Unified actor model for all identity types in the QUESTPIE Autopilot system.
 * Every request — human, worker, API client — is resolved to an Actor.
 */

export interface Actor {
	id: string
	type: 'human' | 'agent' | 'api'
	name: string
	role: 'owner' | 'admin' | 'member' | 'viewer' | 'agent'
	source: 'cli' | 'dashboard' | 'api' | 'internal'
	ip?: string
}
