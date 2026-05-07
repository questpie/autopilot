import { afterEach, describe, expect, test } from 'bun:test'
import { type MockAgentSession, connectMockAgent } from 'spawn-agent/testing'
import type { RunContext, WorkerEvent } from '../src/runtimes/adapter'
import { SpawnAgentAdapter } from '../src/runtimes/spawn-agent'

const sessions: MockAgentSession[] = []

afterEach(async () => {
	await Promise.all(sessions.splice(0).map((session) => session.close()))
})

function baseContext(overrides: Partial<RunContext> = {}): RunContext {
	return {
		runId: 'run-spawn-agent',
		agentId: 'dev',
		agentName: 'Developer',
		agentRole: 'developer',
		taskId: 'task-1',
		projectId: 'project-1',
		taskTitle: 'Check ACP adapter',
		taskDescription: null,
		instructions: 'Return a structured result.',
		orchestratorUrl: 'http://localhost:7778',
		apiKey: 'test-key',
		localDev: false,
		runtimeSessionRef: null,
		workDir: null,
		capabilities: null,
		model: null,
		injectedContext: null,
		contextHints: null,
		...overrides,
	}
}

describe('SpawnAgentAdapter', () => {
	test('streams through spawn-agent and extracts structured output', async () => {
		let newSession: any = null
		let modelConfig: any = null
		let promptRequest: any = null

		const mock = await connectMockAgent({
			newSession: (request) => {
				newSession = request
				return { sessionId: 'mock-session-1' }
			},
			setSessionConfigOption: (request) => {
				modelConfig = request
				return { configOptions: [] }
			},
			prompt: async (request, conn) => {
				promptRequest = request
				await conn.sessionUpdate({
					sessionId: request.sessionId,
					update: {
						sessionUpdate: 'agent_message_chunk',
						content: {
							type: 'text',
							text: 'Done.\n\n<AUTOPILOT_RESULT>\n<summary>ACP completed.</summary>\n<outcome>approved</outcome>\n</AUTOPILOT_RESULT>',
						},
					},
				})
				return { stopReason: 'end_turn' }
			},
		})
		sessions.push(mock)

		const adapter = new SpawnAgentAdapter({
			runtime: 'codex',
			useMcp: true,
			sessionPersistence: 'off',
			connectAgent: async () => mock.agent,
		})
		const events: WorkerEvent[] = []
		adapter.onEvent((event) => events.push(event))

		const result = await adapter.start(baseContext({ model: 'gpt-5.2-codex' }))

		expect(result?.summary).toBe('ACP completed.')
		expect(result?.outputs).toEqual({ summary: 'ACP completed.', outcome: 'approved' })
		expect(result?.sessionId).toBeUndefined()

		expect(newSession?.cwd).toBe(process.cwd())
		expect(newSession?.mcpServers).toHaveLength(1)
		expect(newSession?.mcpServers[0]?.name).toBe('autopilot')
		expect(newSession?.mcpServers[0]).toMatchObject({ command: 'bun' })
		expect(newSession?.mcpServers[0]?.env).toContainEqual({
			name: 'AUTOPILOT_RUN_ID',
			value: 'run-spawn-agent',
		})

		expect(modelConfig).toMatchObject({
			sessionId: 'mock-session-1',
			configId: 'model',
			value: 'gpt-5.2-codex',
		})
		expect(promptRequest?.prompt?.[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('Check ACP adapter'),
		})
		expect(
			events.some(
				(event) => event.type === 'progress' && event.summary.includes('Launching codex'),
			),
		).toBe(true)
		expect(
			events.some((event) => event.type === 'progress' && event.summary.includes('ACP completed')),
		).toBe(true)
	})
})
