// Transport registry
export { TransportRegistry, transportRegistry } from './registry'
export type { TransportAdapter } from './registry'

// Telegram adapter
export { createTelegramAdapter } from './adapters/telegram'
export type { TelegramAdapterConfig } from './adapters/telegram'

// Re-export original telegram functions for backwards compatibility
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
