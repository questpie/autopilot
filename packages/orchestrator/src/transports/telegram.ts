/**
 * @deprecated Use `transports/adapters/telegram.ts` and `createTelegramAdapter` instead.
 *
 * Telegram Bot API transport.
 *
 * Provides helpers to send messages via the Telegram Bot API and
 * parse incoming webhook updates.
 */

/** Configuration needed to interact with the Telegram Bot API. */
export interface TelegramConfig {
	botToken: string
	chatId: string | number
}

/** Subset of the Telegram User object we care about. */
export interface TelegramUser {
	id: number
	first_name: string
	username?: string
}

/** Subset of the Telegram Chat object we care about. */
export interface TelegramChat {
	id: number
	type: 'private' | 'group' | 'supergroup' | 'channel'
	title?: string
}

/** Subset of the Telegram Message object we care about. */
export interface TelegramMessage {
	message_id: number
	from?: TelegramUser
	chat: TelegramChat
	date: number
	text?: string
}

/** Incoming Telegram Update payload. */
export interface TelegramUpdate {
	update_id: number
	message?: TelegramMessage
}

/** Result from the Telegram Bot API sendMessage call. */
export interface TelegramSendResult {
	ok: boolean
	description?: string
}

/**
 * Send a text message to a Telegram chat.
 *
 * Uses the Bot API `sendMessage` endpoint with Markdown formatting.
 */
export async function sendTelegramMessage(
	config: TelegramConfig,
	text: string,
): Promise<TelegramSendResult> {
	const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: config.chatId,
			text,
			parse_mode: 'Markdown',
		}),
	})

	const json = (await res.json()) as TelegramSendResult
	if (!json.ok) {
		console.error('[telegram] sendMessage failed:', json.description)
	}
	return json
}

/**
 * Parse a raw webhook payload into a structured {@link TelegramUpdate}.
 *
 * Returns `null` if the payload is not a valid Telegram update with a text message.
 */
export function parseTelegramUpdate(payload: unknown): TelegramUpdate | null {
	if (!payload || typeof payload !== 'object') return null

	const update = payload as Record<string, unknown>
	if (typeof update.update_id !== 'number') return null

	const message = update.message as Record<string, unknown> | undefined
	if (!message) return null

	const chat = message.chat as Record<string, unknown> | undefined
	if (!chat || typeof chat.id !== 'number') return null

	return {
		update_id: update.update_id,
		message: {
			message_id: (message.message_id as number) ?? 0,
			from: message.from as TelegramUser | undefined,
			chat: {
				id: chat.id,
				type: (chat.type as TelegramChat['type']) ?? 'private',
				title: chat.title as string | undefined,
			},
			date: (message.date as number) ?? 0,
			text: message.text as string | undefined,
		},
	}
}

/**
 * Extract @mentions from a message text.
 *
 * Returns an array of lowercase agent IDs mentioned (without the `@` prefix).
 */
export function extractMentions(text: string): string[] {
	const mentionPattern = /@([a-z0-9_-]+)/gi
	const mentions: string[] = []
	let match: RegExpExecArray | null = mentionPattern.exec(text)
	while (match) {
		mentions.push(match[1]!.toLowerCase())
		match = mentionPattern.exec(text)
	}
	return mentions
}

/**
 * Register a webhook URL with the Telegram Bot API.
 *
 * Call this once after deploying or when the webhook URL changes.
 */
export async function setTelegramWebhook(
	botToken: string,
	webhookUrl: string,
): Promise<TelegramSendResult> {
	const url = `https://api.telegram.org/bot${botToken}/setWebhook`

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			url: webhookUrl,
			allowed_updates: ['message'],
		}),
	})

	return (await res.json()) as TelegramSendResult
}
