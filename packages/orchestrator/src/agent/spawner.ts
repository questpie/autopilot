import type { Agent, Task } from '@questpie/autopilot-spec'
import { assembleContext } from '../context/assembler'
import { extractMemory } from './memory-extractor'
import type { SessionStreamManager } from '../session/stream'
import { appendActivity } from '../fs/activity'
import { createAutopilotTools } from './tools'
import type { ToolContext } from './tools'
import type { AgentProvider, AgentEvent } from './provider'
import { ClaudeAgentSDKProvider } from './providers/claude-agent-sdk'

/** Registry of available agent providers, keyed by name. */
const providers: Map<string, AgentProvider> = new Map()

/**
 * Register an {@link AgentProvider} so it can be resolved by name.
 *
 * Built-in providers are registered at module load time.
 */
export function registerProvider(provider: AgentProvider): void {
	providers.set(provider.name, provider)
}

/**
 * Look up a registered provider by name.
 *
 * @throws When no provider with the given name has been registered.
 */
export function getProvider(name: string): AgentProvider {
	const provider = providers.get(name)
	if (!provider) {
		throw new Error(
			`Unknown agent provider: "${name}". Available: ${[...providers.keys()].join(', ')}`,
		)
	}
	return provider
}

// Register built-in provider
// Claude Agent SDK works with both API key and Max subscription
registerProvider(new ClaudeAgentSDKProvider())

/** Options required to spawn an agent session. */
export interface SpawnOptions {
	companyRoot: string
	agent: Agent
	company: { name: string; slug: string; [key: string]: unknown }
	allAgents: Agent[]
	task?: Task
	streamManager: SessionStreamManager
	trigger: { type: string; task_id?: string; schedule_id?: string }
	/** Optional human message to use as the prompt (e.g. from `autopilot chat`). */
	message?: string
}

/** Outcome of a completed agent session. */
export interface SpawnResult {
	sessionId: string
	result?: string
	toolCalls: number
	error?: string
}

/**
 * Spawn a single agent session end-to-end.
 *
 * Steps:
 * 1. Resolve the LLM provider from the agent or company config.
 * 2. Assemble a multi-layer system prompt via {@link assembleContext}.
 * 3. Create the autopilot tool-set.
 * 4. Open a session stream for real-time `attach` subscriptions.
 * 5. Log session start/end to the activity feed.
 * 6. Delegate to the provider's `spawn()` for the actual LLM loop.
 */
export async function spawnAgent(options: SpawnOptions): Promise<SpawnResult> {
	const { companyRoot, agent, company, allAgents, task, streamManager, trigger, message } = options
	const sessionId = `session-${Date.now().toString(36)}-${agent.id}`

	// 1. Resolve provider (from agent definition or company default)
	const agentProvider = (agent as Record<string, unknown>).provider as string | undefined
	const companySettings = (company as Record<string, unknown>).settings as Record<string, unknown> | undefined
	const providerName = agentProvider ?? companySettings?.agent_provider as string ?? 'claude-agent-sdk'
	const provider = getProvider(providerName)

	// 2. Assemble context (4-layer system prompt)
	const context = await assembleContext({
		companyRoot,
		agent,
		company: company as Parameters<typeof assembleContext>[0]['company'],
		allAgents,
		task,
	})

	// 3. Create custom tools
	const autopilotTools = createAutopilotTools(companyRoot)
	const toolContext: ToolContext = { companyRoot, agentId: agent.id }

	// 4. Build prompt
	const prompt = message
		? message
		: task
			? `Work on task: ${task.title}\n\nDescription: ${task.description || 'No description'}\nPriority: ${task.priority}\nStatus: ${task.status}\n\nDo your work using the available tools. When done, update the task status.`
			: `You have been triggered by: ${trigger.type}. Check your current tasks and act accordingly.`

	// 5. Create session stream for attach
	streamManager.createStream(sessionId, agent.id)

	// 6. Log session start
	await appendActivity(companyRoot, {
		agent: agent.id,
		type: 'session_start',
		summary: `Session started: ${task?.title ?? trigger.type} [${provider.name}/${agent.model}]`,
		details: { sessionId, trigger, taskId: task?.id, provider: provider.name, model: agent.model },
	})

	// 7. Spawn via provider
	const onEvent = (event: AgentEvent) => {
		streamManager.emit(sessionId, {
			at: Date.now(),
			type: event.type,
			content: event.content,
			tool: event.tool,
		})

		if (event.type === 'tool_call') {
			appendActivity(companyRoot, {
				agent: agent.id,
				type: 'tool_call',
				summary: event.tool ?? 'unknown',
				details: { sessionId, tool: event.tool },
			}).catch(() => {}) // Fire-and-forget activity logging
		}
	}

	let sessionResult: { result?: string; toolCalls: number; error?: string }

	try {
		sessionResult = await provider.spawn(
			{
				systemPrompt: context.systemPrompt,
				prompt,
				model: agent.model || 'claude-sonnet-4-6',
				tools: autopilotTools,
				toolContext,
				maxTurns: 50,
			},
			onEvent,
		)
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err)
		sessionResult = { toolCalls: 0, error }
		streamManager.emit(sessionId, { at: Date.now(), type: 'error', content: error })
	} finally {
		streamManager.endStream(sessionId)

		await appendActivity(companyRoot, {
			agent: agent.id,
			type: 'session_end',
			summary: sessionResult!.error
				? `Session failed: ${sessionResult!.error}`
				: `Session completed (${sessionResult!.toolCalls} tool calls)`,
			details: { sessionId, ...sessionResult! },
		})

		// Extract and persist memory from this session (best-effort)
		try {
			await extractMemory(companyRoot, agent.id, sessionId)
		} catch {
			// Memory extraction failure must not crash the session
		}
	}

	return { sessionId, ...sessionResult! }
}
