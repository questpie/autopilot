import type { Agent, Task } from '@questpie/autopilot-spec'
import { container } from '../container'
import { storageFactory } from '../fs/sqlite-backend'

/**
 * Routes an incoming human message to the most relevant agent.
 *
 * Priority:
 * 1. Explicit @mention → that agent
 * 2. Task reference (task-xxx) → agent assigned to that task
 * 3. Role keyword matching → agent with matching role
 * 4. Default → CEO agent (meta, can delegate)
 */
export async function routeMessage(
	message: string,
	agents: Agent[],
	companyRoot: string,
): Promise<{ agent: Agent; reason: string }> {
	const { storage } = await container.resolveAsync([storageFactory])
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
			const tasks = await storage.listTasks()
			const task = tasks.find(t => t.id === taskMatch[0])
			if (task?.assigned_to) {
				const agent = agents.find(a => a.id === task.assigned_to)
				if (agent) return { agent, reason: `assigned to ${task.id}` }
			}
		} catch {
			// ignore — fall through to keyword matching
		}
	}

	// 3. Role keyword matching
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

	// 4. Default → CEO
	const ceo = agents.find(a => a.role === 'meta') ?? agents[0]
	return { agent: ceo!, reason: 'default → CEO' }
}
