/**
 * Telegram transport adapter.
 *
 * Re-exports the Telegram Bot API helpers for direct use.
 */

// Re-export everything from the base telegram module for direct access
export {
	sendTelegramMessage,
	parseTelegramUpdate,
	extractMentions,
	setTelegramWebhook,
} from '../telegram'
export type {
	TelegramConfig,
	TelegramUpdate,
	TelegramMessage,
	TelegramUser,
	TelegramChat,
	TelegramSendResult,
} from '../telegram'
