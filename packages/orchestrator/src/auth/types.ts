/**
 * Unified actor model for all identity types in the QUESTPIE Autopilot system.
 * Every request — human, worker, API client — is resolved to an Actor.
 */

export interface Actor {
	id: string
	type: 'human' | 'agent' | 'api' | 'mcp'
	name: string
	role: 'owner' | 'admin' | 'member' | 'viewer' | 'agent'
	permissions: Record<string, string[]>
	scope?: {
		fsRead?: string[]
		fsWrite?: string[]
		projects?: string[]
		secrets?: string[]
	}
	source: 'cli' | 'dashboard' | 'api' | 'internal' | 'mcp'
	ip?: string
}
