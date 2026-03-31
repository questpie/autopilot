import type { Agent } from '@questpie/autopilot-spec'
import { MESSAGE_ROUTER, classify } from '../agent/micro-agent'
import { aiProviderFactory } from '../ai'
import { container } from '../container'
import { storageFactory } from '../fs/sqlite-backend'
import type { Message, StorageBackend } from '../fs/storage'

export interface RouteOptions {
	channelId?: string
	recentMessages?: Message[]
	storage?: StorageBackend
}

/**
 * Routes an incoming human message to the most relevant agent.
 *
 * Priority:
 * 1. Explicit @mention → that agent
 * 2. Task reference (task-xxx) → agent assigned to that task
 * 3. LLM-based routing (Claude Haiku) → considers agent roles, descriptions,
 *    recent conversation context, and conversation continuity
 * 4. Micro-agent routing (Gemini Flash) → fast, cheap message→agent mapping
 * 4b. Keyword fallback → if both LLM and micro-agent unavailable
 * 5. Default → CEO agent (meta role, can delegate)
 */
export async function routeMessage(
	message: string,
	agents: Agent[],
	_companyRoot: string,
	options?: RouteOptions,
): Promise<{ agent: Agent; reason: string }> {
	// 1. Explicit @mention
	const mentionMatch = message.match(/@([a-z0-9-]+)/)
	if (mentionMatch) {
		const id = mentionMatch[1]
		const agent = agents.find((a) => a.id === id)
		if (agent) return { agent, reason: `mentioned @${id}` }
	}

	// 2. Task reference
	const taskMatch = message.match(/task-[a-z0-9]+/i)
	if (taskMatch) {
		try {
			const storage = options?.storage ?? (await container.resolveAsync([storageFactory])).storage
			const tasks = await storage.listTasks()
			const task = tasks.find((t) => t.id === taskMatch[0])
			if (task?.assigned_to) {
				const agent = agents.find((a) => a.id === task.assigned_to)
				if (agent) return { agent, reason: `assigned to ${task.id}` }
			}
		} catch {
			// ignore — fall through to LLM routing
		}
	}

	// 3. AI routing via classify() — same chat() API, just different model
	try {
		const { aiProvider } = await container.resolveAsync([aiProviderFactory])
		const agentContext = agents
			.map((a) => `- id="${a.id}" role="${a.role}" description="${a.description ?? 'N/A'}"`)
			.join('\n')
		const recentMessages = options?.recentMessages ?? []
		const conversationContext =
			recentMessages.length > 0
				? `\nRecent conversation:\n${recentMessages
						.slice(-10)
						.map((m) => `[${m.from}]: ${m.content.slice(0, 200)}`)
						.join('\n')}`
				: ''
		const input = `Available agents:\n${agentContext}${conversationContext}\n\nChannel: ${options?.channelId ?? 'default'}\nMessage: ${message}`
		const result = await classify(aiProvider, MESSAGE_ROUTER, input)
		if (result) {
			const agent = agents.find((a) => a.id === result.agent_id)
			if (agent) return { agent, reason: `AI routing: ${result.reason}` }
		}
	} catch {
		// fall through to keyword fallback
	}

	// 4. Keyword fallback
	const keywordResult = routeByKeyword(message, agents)
	if (keywordResult) return keywordResult

	// 5. Default → CEO
	const ceo = agents.find((a) => a.role === 'meta') ?? agents[0]
	if (!ceo) {
		throw new Error('no agents available for routing')
	}
	return { agent: ceo, reason: 'default → CEO' }
}

/** D47: Default keyword mappings (fallback when agent has no keywords field). */
const DEFAULT_ROLE_KEYWORDS: Record<string, string[]> = {
	developer: [
		'code',
		'implement',
		'build',
		'fix',
		'bug',
		'feature',
		'component',
		'function',
		'api',
		'endpoint',
		'test',
		'pr',
		'branch',
	],
	strategist: [
		'spec',
		'scope',
		'requirement',
		'feature request',
		'business',
		'strategy',
		'priority',
	],
	planner: ['plan', 'estimate', 'breakdown', 'architecture', 'design doc', 'implementation plan'],
	reviewer: ['review', 'approve', 'reject', 'quality', 'standards', 'feedback'],
	devops: [
		'deploy',
		'infrastructure',
		'server',
		'docker',
		'k8s',
		'kubernetes',
		'ci',
		'cd',
		'monitor',
		'health',
		'uptime',
		'ssl',
		'dns',
	],
	marketing: [
		'marketing',
		'copy',
		'social',
		'campaign',
		'announce',
		'blog',
		'content',
		'seo',
		'launch',
	],
	design: [
		'design',
		'ui',
		'ux',
		'mockup',
		'wireframe',
		'figma',
		'layout',
		'responsive',
		'css',
		'style',
	],
}

/**
 * D47: Keyword-based routing — configurable from agent definitions.
 * Agents can define a `keywords` array in team/agents/*.yaml; falls back to role defaults.
 */
function routeByKeyword(message: string, agents: Agent[]): { agent: Agent; reason: string } | null {
	const lower = message.toLowerCase()
	let bestAgent: Agent | undefined
	let bestScore = 0

	for (const agent of agents) {
		// D47: Use agent-level keywords if defined, else fall back to role defaults
		const keywords = agent.keywords ?? DEFAULT_ROLE_KEYWORDS[agent.role] ?? []

		const score = keywords.filter((kw) => lower.includes(kw)).length
		if (score > bestScore) {
			bestScore = score
			bestAgent = agent
		}
	}

	if (bestAgent && bestScore > 0) {
		return { agent: bestAgent, reason: `keyword match → ${bestAgent.role}` }
	}

	return null
}
