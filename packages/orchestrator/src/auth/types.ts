/**
 * Unified actor model for all identity types in the QUESTPIE Autopilot system.
 * Every request — human, agent, API client, MCP, webhook — is resolved to an Actor.
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
	source: 'cli' | 'dashboard' | 'api' | 'internal' | 'mcp' | 'webhook'
	ip?: string
}

export interface AuditEvent {
	ts: string
	actor: string
	actor_type: 'human' | 'agent' | 'api' | 'mcp' | 'system'
	action: string
	target?: string
	source: 'cli' | 'dashboard' | 'api' | 'internal' | 'mcp' | 'webhook'
	ip?: string
	result: 'success' | 'denied' | 'error'
	detail?: string
}

export interface AgentKeyEntry {
	agentId: string
	keyHash: string
	createdAt: string
	encryptedKey?: string
}
