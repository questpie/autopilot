// Re-export telegram functions for backwards compatibility
export {
	sendTelegramMessage,
	parseTelegramUpdate,
	extractMentions,
	setTelegramWebhook,
} from './telegram'

export type {
	TelegramConfig,
	TelegramUpdate,
	TelegramMessage,
	TelegramUser,
	TelegramChat,
	TelegramSendResult,
} from './telegram'
