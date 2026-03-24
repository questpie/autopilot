/**
 * @deprecated Use `webhook/handlers/telegram.ts` and `webhookHandlerRegistry` instead.
 *
 * Telegram-specific webhook handler.
 *
 * When a POST arrives at `/hooks/telegram`, this module:
 * 1. Parses the Telegram Update
 * 2. Extracts message text and chat_id
 * 3. Checks for @mentions to route to specific agents
 * 4. Falls back to the CEO agent if no mention
 * 5. Spawns the agent with message context
 * 6. Sends the agent's response back via the Telegram Bot API
 */

import { join } from 'node:path'
import { parseTelegramUpdate, extractMentions, sendTelegramMessage } from '../transports/telegram'
import type { TelegramUpdate } from '../transports/telegram'
import { loadAgents, loadCompany } from '../fs'
import { readYamlUnsafe } from '../fs/yaml'
import { spawnAgent } from '../agent'
import { container } from '../container'
import { storageFactory } from '../fs/sqlite-backend'

/** Options for the Telegram webhook handler. */
export interface TelegramHandlerOptions {
	companyRoot: string
}

/** Result of handling a Telegram webhook. */
export interface TelegramHandlerResult {
	handled: boolean
	agentId?: string
	error?: string
}

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
 * Handle an incoming Telegram webhook payload.
 *
 * Parses the update, resolves the target agent, spawns a session,
 * and sends the result back to the originating Telegram chat.
 */
export async function handleTelegramWebhook(
	payload: unknown,
	options: TelegramHandlerOptions,
): Promise<TelegramHandlerResult> {
	const { companyRoot } = options
	const { storage } = await container.resolveAsync([storageFactory])

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
			agent,
			company,
			allAgents: agents,
			storage,
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
}
