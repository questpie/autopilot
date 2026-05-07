import { delimiter, dirname } from 'node:path'
import {
	type AgentAdapter,
	type AgentEvent,
	type AgentStream,
	type McpServer,
	type SessionId,
	SpawnAgent,
	type SpawnAgentConnectOptions,
	type SupportedAgentId,
	type UsageReport,
	adapters,
} from 'spawn-agent'
import { resolveMcpCommand } from '../mcp-command'
import type { RunContext, RuntimeAdapter, RuntimeResult, WorkerEvent } from './adapter'
import { buildPrompt, extractResult, summarizeToolInput, truncate } from './shared'

type RuntimeName = 'claude-code' | 'codex' | 'opencode'
type ConnectSpawnAgent = (
	target: SupportedAgentId | AgentAdapter,
	options: SpawnAgentConnectOptions,
) => Promise<SpawnAgent>

export interface SpawnAgentRuntimeConfig {
	runtime: RuntimeName
	binaryPath?: string
	workDir?: string
	useMcp?: boolean
	mcpBinaryPath?: string
	sessionPersistence?: 'local' | 'off'
	inactivityTimeoutMs?: number
	connectAgent?: ConnectSpawnAgent
}

const RUNTIME_TO_AGENT: Partial<Record<RuntimeName, SupportedAgentId>> = {
	'claude-code': 'claude',
	codex: 'codex',
	opencode: 'opencode',
}

export class SpawnAgentAdapter implements RuntimeAdapter {
	private eventHandler: ((event: WorkerEvent) => void) | null = null
	private activeAgent: SpawnAgent | null = null
	private activeStream: AgentStream | null = null
	private readonly config: SpawnAgentRuntimeConfig
	private readonly connectAgent: ConnectSpawnAgent

	constructor(config: SpawnAgentRuntimeConfig) {
		this.config = config
		this.connectAgent =
			config.connectAgent ?? ((target, options) => SpawnAgent.connect(target, options))
	}

	onEvent(handler: (event: WorkerEvent) => void): void {
		this.eventHandler = handler
	}

	async start(context: RunContext): Promise<RuntimeResult | undefined> {
		const agentId = runtimeToAgentId(this.config.runtime)
		const effectiveWorkDir = context.workDir ?? this.config.workDir ?? process.cwd()
		const sessionInput = {
			cwd: effectiveWorkDir,
			mcpServers: this.config.useMcp === false ? [] : [this.buildMcpServer(context)],
			meta: {
				autopilot: {
					runId: context.runId,
					taskId: context.taskId,
					projectId: context.projectId,
					agentId: context.agentId,
				},
			},
		}

		const target = this.buildTarget(agentId)
		const isResume = !!context.runtimeSessionRef
		this.emit({
			type: 'progress',
			summary: isResume
				? `Resuming ${agentId} session ${context.runtimeSessionRef}`
				: `Launching ${agentId}`,
		})

		const agent = await this.connectAgent(target, {
			cwd: effectiveWorkDir,
			env: this.buildEnv(agentId),
			mcpServers: sessionInput.mcpServers,
			permission: 'auto-allow',
			inactivityTimeoutMs: this.config.inactivityTimeoutMs,
			onStderr: (line) => this.emit({ type: 'progress', summary: truncate(line) }),
		})
		this.activeAgent = agent

		try {
			const sessionId = isResume
				? await agent.loadSession({
						...sessionInput,
						sessionId: context.runtimeSessionRef as SessionId,
					})
				: await agent.createSession(sessionInput)

			const stream = agent.prompt(sessionId, {
				prompt: buildPrompt(context),
				meta: { runId: context.runId, taskId: context.taskId ?? undefined },
				modelPreference: context.model ? { configId: 'model', value: context.model } : undefined,
			})
			this.activeStream = stream

			const usage = await this.forwardEvents(stream)
			const result = await stream.completion
			const extracted = await extractResult(result.text, context.workDir)
			const sessionPersisted = this.config.sessionPersistence !== 'off'

			if (!sessionPersisted) {
				await agent.closeSession(sessionId).catch(() => {})
			}

			this.emit({ type: 'progress', summary: `${agentId} completed` })

			return {
				summary: extracted.summary || `${agentId} completed with no output`,
				tokens: usage ? { input: usage.used, output: 0 } : undefined,
				artifacts: extracted.artifacts.length > 0 ? extracted.artifacts : undefined,
				sessionId: sessionPersisted ? String(result.sessionId) : undefined,
				outputs: extracted.outputs,
			}
		} finally {
			this.activeStream = null
			await agent.close().catch(() => {})
			if (this.activeAgent === agent) this.activeAgent = null
		}
	}

	async stop(): Promise<void> {
		await this.activeStream?.cancel().catch(() => {})
		await this.activeAgent?.close().catch(() => {})
		this.activeStream = null
		this.activeAgent = null
	}

	private async forwardEvents(stream: AgentStream): Promise<UsageReport | undefined> {
		let usage: UsageReport | undefined

		for await (const event of stream) {
			if (event.type === 'usage') {
				usage = event.usage
			}
			this.forwardEvent(event)
		}

		return usage
	}

	private forwardEvent(event: AgentEvent): void {
		switch (event.type) {
			case 'text-delta':
				this.emit({ type: 'progress', summary: truncate(event.text) })
				return
			case 'thinking-delta':
				this.emit({ type: 'progress', summary: truncate(event.text) })
				return
			case 'tool-call':
				this.emit({
					type: 'tool_use',
					summary: summarizeToolInput(event.tool, toRecord(event.input)),
				})
				return
			case 'tool-call-update':
				if (event.status === 'failed') {
					this.emit({ type: 'error', summary: `${event.title ?? 'tool'} failed` })
				}
				return
			case 'plan':
				this.emit({
					type: 'progress',
					summary: event.entries.map((entry) => entry.content).join('\n'),
				})
				return
			case 'permission-request':
				this.emit({
					type: 'tool_use',
					summary: `Permission: ${event.request.tool ?? event.request.toolCallId}`,
				})
				return
			default:
				return
		}
	}

	private buildTarget(agentId: SupportedAgentId): SupportedAgentId | AgentAdapter {
		if (agentId === 'opencode' && this.config.binaryPath) {
			return adapters.builtInAdapter(agentId, { binPath: this.config.binaryPath })
		}

		return agentId
	}

	private buildEnv(agentId: SupportedAgentId): Record<string, string> {
		const env: Record<string, string> = {}

		if (agentId === 'claude' && this.config.binaryPath) {
			env.CLAUDE_CODE_EXECUTABLE = this.config.binaryPath
		}

		if (this.config.binaryPath) {
			env.PATH = `${dirname(this.config.binaryPath)}${delimiter}${process.env.PATH ?? ''}`
		}

		return env
	}

	private buildMcpServer(context: RunContext): McpServer {
		const { command, args } = resolveMcpCommand(this.config.mcpBinaryPath)
		const env: Record<string, string> = {
			AUTOPILOT_API_URL: context.orchestratorUrl,
			AUTOPILOT_RUN_ID: context.runId,
		}

		if (context.localDev) {
			env.AUTOPILOT_LOCAL_DEV = 'true'
		} else {
			env.AUTOPILOT_API_KEY = context.apiKey
		}

		return {
			name: 'autopilot',
			command,
			args,
			env: Object.entries(env).map(([name, value]) => ({ name, value })),
		}
	}

	private emit(event: WorkerEvent): void {
		this.eventHandler?.(event)
	}
}

function runtimeToAgentId(runtime: RuntimeName): SupportedAgentId {
	const agentId = RUNTIME_TO_AGENT[runtime]
	if (!agentId) {
		throw new Error(`Runtime '${runtime}' is not supported by spawn-agent`)
	}
	return agentId
}

function toRecord(input: unknown): Record<string, unknown> | undefined {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
	return input as Record<string, unknown>
}
