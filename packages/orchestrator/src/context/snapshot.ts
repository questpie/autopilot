import type { Agent } from '@questpie/autopilot-spec'
import { listTasks, readChannelMessages, listPins, loadAgents } from '../fs'

export interface CompanySnapshot {
	activeTasks: Array<{ id: string; title: string; status: string; assigned_to?: string }>
	recentMessages: Array<{ from: string; content: string; at: string }>
	dashboardPins: Array<{ title: string; type: string; content: string }>
	agentStatuses: Array<{ id: string; name: string; role: string; status: string }>
}

export async function buildCompanySnapshot(
	companyRoot: string,
	agent: Agent,
): Promise<CompanySnapshot> {
	// Load active tasks, filtered by agent's readable scopes
	const allTasks = await listTasks(companyRoot)
	const activeTasks = allTasks
		.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
		.map((t) => ({
			id: t.id,
			title: t.title,
			status: t.status,
			assigned_to: t.assigned_to,
		}))

	// Load recent messages from channels the agent can read
	const readableChannels = agent.fs_scope.read
		.filter((p) => p.includes('comms/channels/'))
		.map((p) => {
			const match = p.match(/comms\/channels\/([^/*]+)/)
			return match?.[1]
		})
		.filter((c): c is string => c != null)

	// If agent has wildcard read access to comms, read from general + dev
	const channelsToRead =
		readableChannels.length > 0
			? readableChannels
			: agent.fs_scope.read.some((p) => p.includes('comms/**') || p.includes('comms/*'))
				? ['general', 'dev']
				: []

	const recentMessages: CompanySnapshot['recentMessages'] = []
	for (const channel of channelsToRead.slice(0, 5)) {
		try {
			const msgs = await readChannelMessages(companyRoot, channel, 5)
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

	// Load dashboard pins
	const allPins = await listPins(companyRoot)
	const dashboardPins = allPins.map((p) => ({
		title: p.title,
		type: p.type,
		content: p.content ?? '',
	}))

	// Load agent statuses
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
