import { Command } from 'commander'
import type { StreamChunk } from '@questpie/autopilot-spec'
import {
	loadCompany,
	loadAgents,
	spawnAgent,
	SessionStreamManager,
} from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, dim, error, badge } from '../utils/format'

/**
 * A stream manager that auto-subscribes a listener to every new stream.
 * Used by `autopilot chat` to capture output from whatever session
 * the spawner creates internally.
 */
class ChatStreamManager extends SessionStreamManager {
	private chatListener: (chunk: StreamChunk) => void

	constructor(listener: (chunk: StreamChunk) => void) {
		super()
		this.chatListener = listener
	}

	override createStream(sessionId: string, agentId: string) {
		const stream = super.createStream(sessionId, agentId)
		this.subscribe(sessionId, this.chatListener)
		return stream
	}
}

program.addCommand(
	new Command('chat')
		.description('Send a message to an agent and get a response')
		.argument('<agent>', 'Agent ID (with or without @ prefix)')
		.argument('<message>', 'Message to send to the agent')
		.action(async (rawAgent: string, message: string) => {
			try {
				const agentId = rawAgent.replace(/^@/, '')
				const root = await findCompanyRoot()
				const company = await loadCompany(root)
				const agents = await loadAgents(root)

				const agent = agents.find((a) => a.id === agentId)
				if (!agent) {
					console.error(error(`Agent "${agentId}" not found.`))
					const ids = agents.map((a) => a.id).join(', ')
					console.error(dim(`Available agents: ${ids}`))
					process.exit(1)
				}

				console.log('')
				console.log(header('QUESTPIE Autopilot'))
				console.log(dim(`Chatting with ${badge(agent.id, 'cyan')} (${agent.name})`))
				console.log('')

				// Stream manager that prints output for any session the spawner creates
				const streamManager = new ChatStreamManager((chunk) => {
					if (chunk.type === 'text' && chunk.content) {
						process.stdout.write(chunk.content)
					}
					if (chunk.type === 'tool_call') {
						console.log(dim(`  [${chunk.tool ?? 'unknown'}]`))
					}
					if (chunk.type === 'error' && chunk.content) {
						console.error(error(chunk.content))
					}
				})

				// Spawn agent directly with the user's message
				const result = await spawnAgent({
					companyRoot: root,
					agent,
					company,
					allAgents: agents,
					streamManager,
					trigger: { type: 'message_received' },
					message,
				})

				console.log('')
				console.log('')

				if (result.error) {
					console.error(error(`Session failed: ${result.error}`))
					process.exit(1)
				}

				console.log(dim(`--- ${result.toolCalls} tool calls | session ${result.sessionId} ---`))
				console.log('')
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
