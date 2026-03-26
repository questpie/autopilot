import Anthropic from '@anthropic-ai/sdk'
import type { Agent } from '@questpie/autopilot-spec'
import type { Message, StorageBackend } from '../fs/storage'
import { container } from '../container'
import { storageFactory } from '../fs/sqlite-backend'

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
 * 4. Keyword fallback → if LLM call fails
 * 5. Default → CEO agent (meta role, can delegate)
 */
export async function routeMessage(
	message: string,
	agents: Agent[],
	companyRoot: string,
	options?: RouteOptions,
): Promise<{ agent: Agent; reason: string }> {
	// 1. Explicit @mention
	const mentionMatch = message.match(/@([a-z0-9-]+)/)
	if (mentionMatch) {
		const id = mentionMatch[1]
		const agent = agents.find(a => a.id === id)
		if (agent) return { agent, reason: `mentioned @${id}` }
	}

	// 2. Task reference
	const taskMatch = message.match(/task-[a-z0-9]+/i)
	if (taskMatch) {
		try {
			const storage = options?.storage ?? (await container.resolveAsync([storageFactory])).storage
			const tasks = await storage.listTasks()
			const task = tasks.find(t => t.id === taskMatch[0])
			if (task?.assigned_to) {
				const agent = agents.find(a => a.id === task.assigned_to)
				if (agent) return { agent, reason: `assigned to ${task.id}` }
			}
		} catch {
			// ignore — fall through to LLM routing
		}
	}

	// 3. LLM-based routing
	try {
		const result = await routeWithLLM(message, agents, options)
		if (result) return result
	} catch {
		// LLM call failed — fall through to keyword matching
	}

	// 4. Keyword fallback
	const keywordResult = routeByKeyword(message, agents)
	if (keywordResult) return keywordResult

	// 5. Default → CEO
	const ceo = agents.find(a => a.role === 'meta') ?? agents[0]
	return { agent: ceo!, reason: 'default → CEO' }
}

/**
 * Use Claude Haiku to determine the best agent for a message based on
 * agent descriptions, recent conversation context, and conversation continuity.
 */
async function routeWithLLM(
	message: string,
	agents: Agent[],
	options?: RouteOptions,
): Promise<{ agent: Agent; reason: string } | null> {
	const agentList = agents
		.map(a => `- id: "${a.id}", role: "${a.role}", description: "${a.description ?? 'N/A'}"`)
		.join('\n')

	const recentMessages = options?.recentMessages ?? []
	let conversationContext = ''
	if (recentMessages.length > 0) {
		const lastN = recentMessages.slice(-10)
		conversationContext = `\n\nRecent conversation (most recent last):\n${lastN
			.map(m => `[${m.from}]: ${m.content.slice(0, 200)}`)
			.join('\n')}`
	}

	const client = new Anthropic()
	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20250514',
		max_tokens: 256,
		messages: [
			{
				role: 'user',
				content: `You are a message router. Given the available agents and a new message, decide which agent should respond.

Available agents:
${agentList}
${conversationContext}

New message: "${message}"

Which agent should respond to this message? Consider:
1. Role expertise — match the message topic to the agent's role and description
2. Conversation continuity — if an agent was recently active in the conversation and the topic hasn't shifted, prefer that agent
3. When uncertain, prefer the "meta" role agent (CEO) who can delegate

Respond with ONLY valid JSON, no markdown fences:
{"agent_id": "<agent id>", "reason": "<brief reason>"}`,
			},
		],
	})

	const textBlock = response.content.find(b => b.type === 'text')
	if (!textBlock || textBlock.type !== 'text') return null

	const parsed = JSON.parse(textBlock.text) as { agent_id: string; reason: string }
	const agent = agents.find(a => a.id === parsed.agent_id)
	if (!agent) return null

	return { agent, reason: `LLM: ${parsed.reason}` }
}

/**
 * Fallback keyword-based routing when LLM is unavailable.
 */
function routeByKeyword(
	message: string,
	agents: Agent[],
): { agent: Agent; reason: string } | null {
	const roleKeywords: Record<string, string[]> = {
		developer: ['code', 'implement', 'build', 'fix', 'bug', 'feature', 'component', 'function', 'api', 'endpoint', 'test', 'pr', 'branch'],
		strategist: ['spec', 'scope', 'requirement', 'feature request', 'business', 'strategy', 'priority'],
		planner: ['plan', 'estimate', 'breakdown', 'architecture', 'design doc', 'implementation plan'],
		reviewer: ['review', 'approve', 'reject', 'quality', 'standards', 'feedback'],
		devops: ['deploy', 'infrastructure', 'server', 'docker', 'k8s', 'kubernetes', 'ci', 'cd', 'monitor', 'health', 'uptime', 'ssl', 'dns'],
		marketing: ['marketing', 'copy', 'social', 'campaign', 'announce', 'blog', 'content', 'seo', 'launch'],
		design: ['design', 'ui', 'ux', 'mockup', 'wireframe', 'figma', 'layout', 'responsive', 'css', 'style'],
	}

	const lower = message.toLowerCase()
	let bestRole: string | undefined
	let bestScore = 0

	for (const [role, keywords] of Object.entries(roleKeywords)) {
		const score = keywords.filter(kw => lower.includes(kw)).length
		if (score > bestScore) {
			bestScore = score
			bestRole = role
		}
	}

	if (bestRole && bestScore > 0) {
		const agent = agents.find(a => a.role === bestRole)
		if (agent) return { agent, reason: `keyword match → ${bestRole}` }
	}

	return null
}
