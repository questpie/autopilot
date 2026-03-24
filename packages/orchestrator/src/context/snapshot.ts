import type { Agent } from '@questpie/autopilot-spec'
import { listPins, loadAgents } from '../fs'
import type { StorageBackend } from '../fs/storage'

/** A point-in-time snapshot of company state scoped to a single agent. */
export interface CompanySnapshot {
	activeTasks: Array<{ id: string; title: string; status: string; assigned_to?: string }>
	recentMessages: Array<{ from: string; content: string; at: string }>
	dashboardPins: Array<{ title: string; type: string; content: string }>
	agentStatuses: Array<{ id: string; name: string; role: string; status: string }>
}

/**
 * Build a role-scoped company snapshot for context assembly.
 *
 * Reads active tasks from storage, recent channel messages, dashboard pins,
 * and agent statuses.
 */
export async function buildCompanySnapshot(
	companyRoot: string,
	agent: Agent,
	storage: StorageBackend,
): Promise<CompanySnapshot> {
	// Load active tasks from SQLite
	const allTasks = await storage.listTasks()
	const activeTasks = allTasks
		.filter((t: { status: string }) => t.status !== 'done' && t.status !== 'cancelled')
		.map((t: { id: string; title: string; status: string; assigned_to?: string }) => ({
			id: t.id,
			title: t.title,
			status: t.status,
			assigned_to: t.assigned_to,
		}))

	// Load recent messages from channels the agent can read
	const readableChannels = agent.fs_scope.read
		.filter((p: string) => p.includes('comms/channels/'))
		.map((p: string) => {
			const match = p.match(/comms\/channels\/([^/*]+)/)
			return match?.[1]
		})
		.filter((c): c is string => c != null)

	const channelsToRead =
		readableChannels.length > 0
			? readableChannels
			: agent.fs_scope.read.some((p: string) => p.includes('comms/**') || p.includes('comms/*'))
				? ['general', 'dev']
				: []

	const recentMessages: CompanySnapshot['recentMessages'] = []
	for (const channel of channelsToRead.slice(0, 5)) {
		try {
			const msgs = await storage.readMessages({ channel, limit: 5 })
			for (const msg of msgs) {
				recentMessages.push({
					from: msg.from,
					content: msg.content,
					at: msg.at,
				})
			}
		} catch {
			// channel may not exist yet
		}
	}

	// Load dashboard pins (still YAML-based)
	const allPins = await listPins(companyRoot)
	const dashboardPins = allPins.map((p) => ({
		title: p.title,
		type: p.type,
		content: p.content ?? '',
	}))

	// Load agent statuses (YAML)
	let agentStatuses: CompanySnapshot['agentStatuses'] = []
	try {
		const agents = await loadAgents(companyRoot)
		agentStatuses = agents.map((a) => ({
			id: a.id,
			name: a.name,
			role: a.role,
			status: 'idle',
		}))
	} catch {
		// agents.yaml may not exist
	}

	return {
		activeTasks,
		recentMessages,
		dashboardPins,
		agentStatuses,
	}
}
