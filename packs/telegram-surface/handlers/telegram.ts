/**
 * Telegram surface handler for QUESTPIE Autopilot.
 *
 * Supports two operations:
 *
 * notify.send (outbound):
 *   Sends task notifications to Telegram with inline approve/reject buttons.
 *   Uses the Telegram Bot API (sendMessage with inline_keyboard).
 *   Supports edit-in-place via edit_message_id payload field.
 *   Query events (query_response, query_progress) render Markdown-like text as Telegram HTML.
 *
 * conversation.ingest (inbound):
 *   Normalizes Telegram webhook updates into orchestrator conversation actions.
 *   Supports: callback_query (button presses), text messages (reply/commands).
 *   Emits sender_id/sender_name for group chat identity.
 *   Generic commands: any /command forwards to conversation.command
 *
 * Envelope shape (stdin JSON):
 *   { op, provider_id, provider_kind, config, secrets, payload }
 *
 * Required secrets:
 *   bot_token — Telegram Bot API token
 *
 * Required config:
 *   default_chat_id — fallback chat for notifications
 */

import {
	defineHandler,
	ok,
	fail,
	noop,
	queryMessage,
	conversationApprove,
	conversationReject,
	conversationReply,
	conversationCommand,
} from '@questpie/autopilot-spec/handler-sdk'
import type { HandlerEnvelope, HandlerResult } from '@questpie/autopilot-spec/handler-sdk'

interface TelegramResponse {
	ok: boolean
	result?: { message_id: number }
	description?: string
}

defineHandler({
	'notify.send': handleNotifySend,
	'conversation.ingest': handleConversationIngest,
})

async function handleNotifySend(envelope: HandlerEnvelope): Promise<HandlerResult> {
	const botToken = envelope.secrets?.bot_token
	if (!botToken) return fail('Missing secret: bot_token')
	const apiBase = (envelope.config?.api_base_url as string) ?? 'https://api.telegram.org'
	const telegramApi = `${apiBase}/bot${botToken}`

	const payload = envelope.payload as Record<string, unknown>
	const chatId =
		resolveEnvPlaceholder(payload.conversation_id) ??
		resolveEnvPlaceholder(envelope.config?.default_chat_id)

	if (!chatId) {
		return ok({ metadata: { skipped: true, reason: 'no chat_id' } })
	}

	const title = (payload.title as string) ?? 'Notification'
	const summary = (payload.summary as string) ?? ''
	const taskId = payload.task_id as string | undefined
	const previewUrl = payload.preview_url as string | undefined
	const taskUrl = payload.task_url as string | undefined
	const eventType = payload.event_type as string | undefined
	const severity = payload.severity as string | undefined
	const editMessageId = payload.edit_message_id as string | undefined

	const isQueryEvent = eventType === 'query_response' || eventType === 'query_progress'
	const isTaskProgress = eventType === 'task_progress'

	let text: string
	let parseMode: string | undefined

	if (isQueryEvent) {
		text = markdownToTelegramHtml(summary || title)
		if (previewUrl) {
			text += `\n\n🔗 <a href="${escapeHtml(previewUrl)}">Preview</a>`
		}
		parseMode = 'HTML'
	} else if (isTaskProgress) {
		const normalizedStatus = payload.normalized_status as string | undefined
		const workflowId = payload.workflow_id as string | undefined

		const statusMap: Record<string, { icon: string; label: string }> = {
			working: { icon: '⏳', label: 'Working' },
			plan_ready: { icon: '📝', label: 'Plan ready' },
			waiting_for_review: { icon: '👀', label: 'Waiting for review' },
			completed: { icon: '✅', label: 'Completed' },
			failed: { icon: '❌', label: 'Failed' },
		}

		const status = statusMap[normalizedStatus ?? ''] ?? {
			icon: 'ℹ️',
			label: normalizedStatus ?? 'Unknown',
		}

		const lines: string[] = [`🤖 <b>${escapeHtml(title)}</b>`]
		if (workflowId) {
			lines.push(`📋 <i>${escapeHtml(workflowId)}</i>`)
		}

		lines.push('', `${status.icon} <b>${status.label}</b>`)
		if (summary) {
			const truncated = summary.length > 500 ? `${summary.slice(0, 497)}...` : summary
			lines.push(escapeHtml(truncated))
		}
		if (previewUrl) lines.push('', `🔗 <a href="${escapeHtml(previewUrl)}">Preview</a>`)
		if (taskUrl) lines.push(`📝 <a href="${escapeHtml(taskUrl)}">Task details</a>`)
		if (normalizedStatus === 'waiting_for_review') {
			lines.push('', '💬 Reply to this message to respond')
		}

		text = lines.join('\n')
		parseMode = 'HTML'
	} else {
		const icon = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : '✅'
		const lines: string[] = [`${icon} <b>${escapeHtml(title)}</b>`]

		const hasDetailLink = !!(previewUrl || taskUrl)
		const summaryLimit = hasDetailLink ? 500 : 3000
		const safeSummary =
			summary.length > summaryLimit ? `${summary.slice(0, summaryLimit)}...` : summary

		if (safeSummary) lines.push('', escapeHtml(safeSummary))
		if (previewUrl) lines.push('', `🔗 <a href="${escapeHtml(previewUrl)}">Preview</a>`)
		if (taskUrl) lines.push(`📝 <a href="${escapeHtml(taskUrl)}">Task details</a>`)

		const actions = payload.actions as
			| Array<{
					action: string
					label: string
					style?: string
					requires_message?: boolean
			  }>
			| undefined

		if (taskId && actions && actions.length > 0) {
			const replyAction = actions.find((action) => action.requires_message)
			if (replyAction) {
				lines.push('', `💬 Reply to this message to ${replyAction.label.toLowerCase()}`)
			}
		}

		text = lines.join('\n')
		parseMode = 'HTML'
	}

	const keyboard: Array<Array<{ text: string; callback_data: string }>> = []
	const showButtons = isTaskProgress
		? payload.normalized_status === 'waiting_for_review' && !!taskId
		: !isQueryEvent && !!taskId

	if (showButtons) {
		const actions = payload.actions as
			| Array<{
					action: string
					label: string
					style?: string
					requires_message?: boolean
			  }>
			| undefined

		if (actions && actions.length > 0) {
			const buttons: Array<{ text: string; callback_data: string }> = []
			for (const action of actions) {
				if (action.requires_message) continue

				const styleIcons: Record<string, string> = { primary: '✅ ', danger: '❌ ' }
				const actionPrefixes: Record<string, string> = {
					'task.approve': 'approve',
					'task.reject': 'reject',
				}

				const callbackPrefix = actionPrefixes[action.action]
				if (!callbackPrefix) continue

				buttons.push({
					text: `${styleIcons[action.style ?? ''] ?? ''}${action.label}`,
					callback_data: `${callbackPrefix}:${taskId}`,
				})
			}
			if (buttons.length > 0) keyboard.push(buttons)
		}
	}

	const useEdit = !!editMessageId
	const apiMethod = useEdit ? 'editMessageText' : 'sendMessage'
	const body: Record<string, unknown> = { chat_id: chatId, text }

	if (useEdit) body.message_id = Number(editMessageId)
	if (parseMode) body.parse_mode = parseMode
	if (keyboard.length > 0) {
		body.reply_markup = JSON.stringify({ inline_keyboard: keyboard })
	}

	try {
		const response = await fetch(`${telegramApi}/${apiMethod}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = (await response.json()) as TelegramResponse

		if (data.ok) {
			const messageId = useEdit ? Number(editMessageId) : (data.result?.message_id ?? 0)
			return ok({
				external_id: String(messageId),
				metadata: { chat_id: chatId, message_id: messageId },
			})
		}

		const description = data.description ?? ''
		if (useEdit && description.toLowerCase().includes('message is not modified')) {
			const messageId = Number(editMessageId)
			return ok({
				external_id: String(messageId),
				metadata: { chat_id: chatId, message_id: messageId, unchanged: true },
			})
		}

		if (useEdit) {
			const fallbackBody: Record<string, unknown> = { chat_id: chatId, text }
			if (parseMode) fallbackBody.parse_mode = parseMode
			if (keyboard.length > 0) {
				fallbackBody.reply_markup = JSON.stringify({ inline_keyboard: keyboard })
			}

			const fallbackResponse = await fetch(`${telegramApi}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(fallbackBody),
			})
			const fallbackData = (await fallbackResponse.json()) as TelegramResponse
			if (fallbackData.ok) {
				return ok({
					external_id: String(fallbackData.result?.message_id ?? ''),
					metadata: { chat_id: chatId, message_id: fallbackData.result?.message_id },
				})
			}
			return fail(`Telegram API: ${fallbackData.description ?? 'Unknown error'}`)
		}

		return fail(`Telegram API: ${data.description ?? 'Unknown error'}`)
	} catch (err) {
		return fail(err instanceof Error ? err.message : String(err))
	}
}

async function handleConversationIngest(envelope: HandlerEnvelope): Promise<HandlerResult> {
	const botToken = envelope.secrets?.bot_token
	if (!botToken) return fail('Missing secret: bot_token')
	const apiBase = (envelope.config?.api_base_url as string) ?? 'https://api.telegram.org'
	const telegramApi = `${apiBase}/bot${botToken}`

	const payload = envelope.payload as Record<string, unknown>
	const callbackQuery = payload.callback_query as Record<string, unknown> | undefined
	const message = payload.message as Record<string, unknown> | undefined

	if (callbackQuery) {
		const data = (callbackQuery.data as string) ?? ''
		const chat = callbackQuery.message as Record<string, unknown> | undefined
		const chatId = String((chat?.chat as Record<string, unknown>)?.id ?? '')
		const messageId = String(chat?.message_id ?? '')

		const callbackId = callbackQuery.id as string
		if (callbackId) {
			await fetch(`${telegramApi}/answerCallbackQuery`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ callback_query_id: callbackId }),
			}).catch((err: unknown) => {
				console.error(
					`answerCallbackQuery failed: ${err instanceof Error ? err.message : String(err)}`,
				)
			})
		}

		if (data.startsWith('approve:')) {
			return conversationApprove({ conversation_id: chatId, thread_id: messageId })
		}
		if (data.startsWith('reject:')) {
			return conversationReject({
				conversation_id: chatId,
				thread_id: messageId,
				message: 'Rejected via Telegram',
			})
		}
		return noop(`Unknown callback: ${data}`)
	}

	if (message) {
		const chatId = String((message.chat as Record<string, unknown>)?.id ?? '')
		const messageId = message.message_id !== undefined ? String(message.message_id) : undefined
		const text = ((message.text as string) ?? '').trim()
		const replyTo = message.reply_to_message as Record<string, unknown> | undefined
		const threadId = replyTo ? String(replyTo.message_id ?? '') : undefined

		const from = message.from as Record<string, unknown> | undefined
		const senderId = from?.id !== undefined ? String(from.id) : undefined
		const senderName = (from?.first_name as string) ?? (from?.username as string) ?? undefined

		if (!text) return noop('Empty message')
		if (text === '/approve') {
			return conversationApprove({ conversation_id: chatId, thread_id: threadId })
		}
		if (text.startsWith('/reject')) {
			const reason = text.slice('/reject'.length).trim() || 'Rejected via Telegram'
			return conversationReject({ conversation_id: chatId, thread_id: threadId, message: reason })
		}
		if (text.startsWith('/reply ')) {
			const replyMessage = text.slice('/reply '.length).trim()
			if (replyMessage) {
				return conversationReply({
					conversation_id: chatId,
					thread_id: threadId,
					message: replyMessage,
				})
			}
		}

		const passthroughCommands = new Set(['/reset', '/new', '/clear'])
		if (text.startsWith('/') && !passthroughCommands.has(text.split(' ')[0]!)) {
			const spaceIdx = text.indexOf(' ')
			const command = spaceIdx > 0 ? text.slice(1, spaceIdx) : text.slice(1)
			const args = spaceIdx > 0 ? text.slice(spaceIdx + 1).trim() : ''
			return conversationCommand({
				conversation_id: chatId,
				thread_id: threadId ?? messageId,
				command,
				args,
				sender_id: senderId,
				sender_name: senderName,
			})
		}

		if (replyTo) {
			return conversationReply({ conversation_id: chatId, thread_id: threadId, message: text })
		}

		return queryMessage({
			conversation_id: chatId,
			message: text,
			sender_id: senderId,
			sender_name: senderName,
		})
	}

	return noop('Unrecognized Telegram update')
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function markdownToTelegramHtml(text: string): string {
	const protectedFragments: Array<{ token: string; html: string }> = []
	let nextToken = 0

	const protect = (html: string): string => {
		const token = `@@QPCODE${nextToken}@@`
		nextToken += 1
		protectedFragments.push({ token, html })
		return token
	}

	let working = text.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
		return protect(`<pre>${escapeHtml(code.trim())}</pre>`)
	})

	working = working.replace(/`([^`\n]+)`/g, (_match, code: string) => {
		return protect(`<code>${escapeHtml(code)}</code>`)
	})

	let html = escapeHtml(working)

	html = html.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
	html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
	html = html.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
	html = html.replace(/__([^_\n]+)__/g, '<b>$1</b>')
	html = html.replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
	html = html.replace(/_([^_\n]+)_/g, '<i>$1</i>')

	for (const fragment of protectedFragments) {
		html = html.replace(fragment.token, fragment.html)
	}

	return html
}

function resolveEnvPlaceholder(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length === 0) return undefined
	const match = value.match(/^\$\{([A-Z0-9_]+)\}$/i)
	if (!match) return value
	const envValue = Bun.env[match[1]]
	return typeof envValue === 'string' && envValue.length > 0 ? envValue : undefined
}
