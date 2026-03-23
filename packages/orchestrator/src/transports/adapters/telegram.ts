/**
 * Telegram transport adapter.
 *
 * Wraps the Telegram Bot API helpers into the generic {@link TransportAdapter}
 * interface while preserving the original exported functions for direct use.
 */

import {
	sendTelegramMessage,
	parseTelegramUpdate,
	extractMentions,
	setTelegramWebhook,
} from '../telegram'
import type {
	TelegramConfig,
	TelegramUpdate,
	TelegramMessage,
	TelegramUser,
	TelegramChat,
	TelegramSendResult,
} from '../telegram'
import type { TransportAdapter } from '../registry'

/** Configuration for creating a Telegram adapter instance. */
export interface TelegramAdapterConfig {
	botToken: string
}

/**
 * Create a {@link TransportAdapter} backed by the Telegram Bot API.
 *
 * @param config - Must include `botToken`. Individual sends use the
 *   `to` parameter as the `chatId`.
 */
export function createTelegramAdapter(config: TelegramAdapterConfig): TransportAdapter {
	return {
		name: 'telegram',

		async send(to: string, content: string, _extra: Record<string, unknown>): Promise<void> {
			await sendTelegramMessage({ botToken: config.botToken, chatId: to }, content)
		},

		formatIncoming(payload: unknown): { from: string; content: string; channel?: string } | null {
			const update = parseTelegramUpdate(payload)
			if (!update?.message?.text) return null

			const from = update.message.from?.username
				?? update.message.from?.first_name
				?? 'unknown'

			return {
				from,
				content: update.message.text,
				channel: String(update.message.chat.id),
			}
		},
	}
}

// Re-export everything from the base telegram module for direct access
export {
	sendTelegramMessage,
	parseTelegramUpdate,
	extractMentions,
	setTelegramWebhook,
}
export type {
	TelegramConfig,
	TelegramUpdate,
	TelegramMessage,
	TelegramUser,
	TelegramChat,
	TelegramSendResult,
	TelegramAdapterConfig as TelegramTransportConfig,
}
