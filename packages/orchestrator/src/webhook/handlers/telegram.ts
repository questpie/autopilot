/**
 * Telegram webhook handler plugin.
 *
 * Implements the generic {@link WebhookHandler} interface, wrapping the
 * original Telegram-specific logic from `telegram-handler.ts`.
 */

import { join } from 'node:path'
import {
	parseTelegramUpdate,
	extractMentions,
	sendTelegramMessage,
} from '../../transports/adapters/telegram'
import { loadAgents, loadCompany } from '../../fs'
import { readYamlUnsafe } from '../../fs/yaml'
import { spawnAgent } from '../../agent'
import type { WebhookHandler, WebhookContext, WebhookResult } from '../handler'

/**
 * Read the Telegram bot token from the secrets directory.
 *
 * Expects a file at `secrets/telegram.yaml` with a `value` field.
 */
async function readBotToken(companyRoot: string): Promise<string | null> {
	const secretPath = join(companyRoot, 'secrets', 'telegram.yaml')
	try {
		const secret = await readYamlUnsafe(secretPath) as Record<string, unknown>
		return (secret?.value as string) ?? null
	} catch {
		return null
	}
}

/**
 * Telegram webhook handler.
 *
 * Parses the Telegram Update, resolves the target agent via @mentions,
 * spawns the agent, and sends the result back to the originating chat.
 */
export const telegramWebhookHandler: WebhookHandler = {
	id: 'telegram',

	canHandle(webhookId: string, _payload: unknown): boolean {
		return webhookId === 'telegram'
	},

	async handle(payload: unknown, ctx: WebhookContext): Promise<WebhookResult> {
		const { companyRoot, streamManager } = ctx

		// 1. Parse the Telegram update
		const update = parseTelegramUpdate(payload)
		if (!update?.message?.text) {
			return { handled: false, error: 'no text message in update' }
		}

		const { text } = update.message
		const chatId = update.message.chat.id
		const fromUser = update.message.from?.username ?? update.message.from?.first_name ?? 'unknown'

		console.log(`[telegram] message from ${fromUser} in chat ${chatId}: ${text.slice(0, 100)}`)

		// 2. Read bot token
		const botToken = await readBotToken(companyRoot)
		if (!botToken) {
			console.error('[telegram] no bot token found — add one via: autopilot secrets add telegram --value "YOUR_TOKEN"')
			return { handled: false, error: 'no bot token configured' }
		}

		// 3. Load agents and company
		const agents = await loadAgents(companyRoot)
		const company = await loadCompany(companyRoot)

		// 4. Resolve target agent from @mentions or default to CEO
		const mentions = extractMentions(text)
		let targetAgentId = 'ceo'

		for (const mention of mentions) {
			const found = agents.find((a) => a.id === mention)
			if (found) {
				targetAgentId = found.id
				break
			}
		}

		const agent = agents.find((a) => a.id === targetAgentId)
		if (!agent) {
			console.error(`[telegram] agent not found: ${targetAgentId}`)
			return { handled: false, error: `agent not found: ${targetAgentId}` }
		}

		console.log(`[telegram] routing to agent: ${agent.id} (${agent.name})`)

		// 5. Send a "thinking" indicator
		await sendTelegramMessage(
			{ botToken, chatId },
			`_${agent.name} is working on this..._`,
		)

		// 6. Spawn agent with the message as context
		try {
			const result = await spawnAgent({
				companyRoot,
				agent,
				company,
				allAgents: agents,
				streamManager,
				trigger: {
					type: 'telegram',
					task_id: undefined,
				},
			})

			// 7. Send the response back to Telegram
			const responseText = result.result
				?? (result.error ? `Error: ${result.error}` : 'Done. No output produced.')

			await sendTelegramMessage({ botToken, chatId }, responseText)

			return { handled: true, agentId: agent.id }
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err)
			console.error(`[telegram] agent ${agent.id} failed:`, errorMsg)

			await sendTelegramMessage(
				{ botToken, chatId },
				`Something went wrong: ${errorMsg}`,
			)

			return { handled: false, agentId: agent.id, error: errorMsg }
		}
	},
}
