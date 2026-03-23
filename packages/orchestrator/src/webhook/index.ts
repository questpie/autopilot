export { WebhookServer } from './server'
export type { WebhookServerOptions } from './server'

// Webhook handler registry
export { WebhookHandlerRegistry, webhookHandlerRegistry } from './handler'
export type { WebhookHandler, WebhookContext, WebhookResult } from './handler'

// Telegram webhook handler
export { telegramWebhookHandler } from './handlers/telegram'

// Backwards compatibility — re-export the old function name
// @deprecated Use webhookHandlerRegistry + telegramWebhookHandler instead
export { handleTelegramWebhook } from './telegram-handler'
export type { TelegramHandlerOptions, TelegramHandlerResult } from './telegram-handler'
