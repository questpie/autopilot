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

interface TelegramResponse {
	ok: boolean
	result?: { message_id: number }
	description?: string
}

const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const op = envelope.op as string

const botToken = envelope.secrets?.bot_token as string | undefined
if (!botToken) {
	console.log(JSON.stringify({ ok: false, error: 'Missing secret: bot_token' }))
	process.exit(0)
}

const apiBase = (envelope.config?.api_base_url as string) ?? 'https://api.telegram.org'
const TELEGRAM_API = `${apiBase}/bot${botToken}`

// ─── Outbound: notify.send ─────────────────────────────────────────────

if (op === 'notify.send') {
	const payload = envelope.payload as Record<string, unknown>
	const chatId = (payload.conversation_id as string)
		?? (envelope.config?.default_chat_id as string)

	if (!chatId) {
		console.log(JSON.stringify({ ok: true, metadata: { skipped: true, reason: 'no chat_id' } }))
		process.exit(0)
	}

	const title = payload.title as string ?? 'Notification'
	const summary = payload.summary as string ?? ''
	const taskId = payload.task_id as string | undefined
	const previewUrl = payload.preview_url as string | undefined
	const taskUrl = payload.task_url as string | undefined
	const eventType = payload.event_type as string | undefined
	const severity = payload.severity as string | undefined
	const editMessageId = payload.edit_message_id as string | undefined

	// Query events (query_response, query_progress) use chat text without task icons.
	const isQueryEvent = eventType === 'query_response' || eventType === 'query_progress'

	let text: string
	let parseMode: string | undefined

	if (isQueryEvent) {
		text = markdownToTelegramHtml(summary || title)
		if (previewUrl) {
			text += `\n\n\ud83d\udd17 <a href="${escapeHtml(previewUrl)}">Preview</a>`
		}
		parseMode = 'HTML'
	} else {
		// Rich HTML formatting for task notifications
		const icon = severity === 'error' ? '\u274c'
			: severity === 'warning' ? '\u26a0\ufe0f'
			: '\u2705'

		const lines: string[] = [
			`${icon} <b>${escapeHtml(title)}</b>`,
		]

		if (summary) lines.push('', escapeHtml(summary))
		if (previewUrl) lines.push('', `\ud83d\udd17 <a href="${escapeHtml(previewUrl)}">Preview</a>`)
		if (taskUrl) lines.push(`\ud83d\udcdd <a href="${escapeHtml(taskUrl)}">Task details</a>`)

		// Build inline keyboard from normalized actions (if present)
		const actions = payload.actions as Array<{
			action: string
			label: string
			style?: string
			requires_message?: boolean
		}> | undefined

		if (taskId && actions && actions.length > 0) {
			// If there's a requires_message action (e.g. task.reply), add a text hint
			const replyAction = actions.find((a) => a.requires_message)
			if (replyAction) {
				lines.push('', `\ud83d\udcac Reply to this message to ${replyAction.label.toLowerCase()}`)
			}
		}

		text = lines.join('\n')
		parseMode = 'HTML'
	}

	// Build inline keyboard (only for task notifications)
	const keyboard: Array<Array<{ text: string; callback_data: string }>> = []
	if (!isQueryEvent && taskId) {
		const actions = payload.actions as Array<{
			action: string
			label: string
			style?: string
			requires_message?: boolean
		}> | undefined

		if (actions && actions.length > 0) {
			const buttons: Array<{ text: string; callback_data: string }> = []
			for (const act of actions) {
				if (act.requires_message) continue

				const STYLE_ICONS: Record<string, string> = { primary: '\u2705 ', danger: '\u274c ' }
				const ACTION_PREFIXES: Record<string, string> = { 'task.approve': 'approve', 'task.reject': 'reject' }

				const icon = STYLE_ICONS[act.style ?? ''] ?? ''
				const callbackPrefix = ACTION_PREFIXES[act.action]
				if (!callbackPrefix) continue

				buttons.push({ text: `${icon}${act.label}`, callback_data: `${callbackPrefix}:${taskId}` })
			}
			if (buttons.length > 0) keyboard.push(buttons)
		}
	}

	// Choose between editing an existing message or sending a new one
	const useEdit = !!editMessageId
	const apiMethod = useEdit ? 'editMessageText' : 'sendMessage'

	const body: Record<string, unknown> = {
		chat_id: chatId,
		text,
	}

	if (useEdit) {
		body.message_id = Number(editMessageId)
	}

	if (parseMode) {
		body.parse_mode = parseMode
	}

	if (keyboard.length > 0) {
		body.reply_markup = JSON.stringify({ inline_keyboard: keyboard })
	}

	try {
		const res = await fetch(`${TELEGRAM_API}/${apiMethod}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})

		const data = (await res.json()) as TelegramResponse

		if (data.ok) {
			// For edits, the message_id stays the same; for new messages, capture it
			const messageId = useEdit ? Number(editMessageId) : (data.result?.message_id ?? 0)
			console.log(JSON.stringify({
				ok: true,
				external_id: String(messageId),
				metadata: { chat_id: chatId, message_id: messageId },
			}))
		} else {
			// If edit fails (e.g. message deleted), fall back to sending a new message
			if (useEdit) {
				const fallbackBody: Record<string, unknown> = { chat_id: chatId, text }
				if (parseMode) fallbackBody.parse_mode = parseMode
				if (keyboard.length > 0) fallbackBody.reply_markup = JSON.stringify({ inline_keyboard: keyboard })

				const fallbackRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(fallbackBody),
				})
				const fallbackData = (await fallbackRes.json()) as TelegramResponse
				if (fallbackData.ok) {
					console.log(JSON.stringify({
						ok: true,
						external_id: String(fallbackData.result?.message_id ?? ''),
						metadata: { chat_id: chatId, message_id: fallbackData.result?.message_id },
					}))
				} else {
					console.log(JSON.stringify({
						ok: false,
						error: `Telegram API: ${fallbackData.description ?? 'Unknown error'}`,
					}))
				}
			} else {
				console.log(JSON.stringify({
					ok: false,
					error: `Telegram API: ${data.description ?? 'Unknown error'}`,
				}))
			}
		}
	} catch (err) {
		console.log(JSON.stringify({
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		}))
	}

	process.exit(0)
}

// ─── Inbound: conversation.ingest ──────────────────────────────────────

if (op === 'conversation.ingest') {
	const payload = envelope.payload as Record<string, unknown>

	// Telegram sends webhook updates with different shapes
	const callbackQuery = payload.callback_query as Record<string, unknown> | undefined
	const message = payload.message as Record<string, unknown> | undefined

	// Handle inline button callback
	if (callbackQuery) {
		const data = callbackQuery.data as string ?? ''
		const chat = callbackQuery.message as Record<string, unknown> | undefined
		const chatId = String((chat?.chat as Record<string, unknown>)?.id ?? '')
		const messageId = String(chat?.message_id ?? '')

		// Answer the callback to dismiss the loading indicator
		const callbackId = callbackQuery.id as string
		if (callbackId) {
			await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ callback_query_id: callbackId }),
			}).catch(() => {})
		}

		if (data.startsWith('approve:')) {
			console.log(JSON.stringify({
				ok: true,
				metadata: {
					action: 'task.approve',
					conversation_id: chatId,
					thread_id: messageId,
				},
			}))
			process.exit(0)
		}

		if (data.startsWith('reject:')) {
			console.log(JSON.stringify({
				ok: true,
				metadata: {
					action: 'task.reject',
					conversation_id: chatId,
					thread_id: messageId,
					message: 'Rejected via Telegram',
				},
			}))
			process.exit(0)
		}

		// Unknown callback
		console.log(JSON.stringify({
			ok: true,
			metadata: { action: 'noop', reason: `Unknown callback: ${data}` },
		}))
		process.exit(0)
	}

	// Handle text message
	if (message) {
		const chatId = String((message.chat as Record<string, unknown>)?.id ?? '')
		const text = (message.text as string ?? '').trim()
		const replyTo = message.reply_to_message as Record<string, unknown> | undefined
		const threadId = replyTo ? String(replyTo.message_id ?? '') : undefined

		// Extract sender identity for group chat support
		const from = message.from as Record<string, unknown> | undefined
		const senderId = from?.id !== undefined ? String(from.id) : undefined
		const senderName = (from?.first_name as string) ?? (from?.username as string) ?? undefined

		if (!text) {
			console.log(JSON.stringify({
				ok: true,
				metadata: { action: 'noop', reason: 'Empty message' },
			}))
			process.exit(0)
		}

		// Command handling — explicit task actions
		if (text === '/approve') {
			console.log(JSON.stringify({
				ok: true,
				metadata: { action: 'task.approve', conversation_id: chatId, thread_id: threadId },
			}))
			process.exit(0)
		}

		if (text.startsWith('/reject')) {
			const reason = text.slice('/reject'.length).trim() || 'Rejected via Telegram'
			console.log(JSON.stringify({
				ok: true,
				metadata: { action: 'task.reject', conversation_id: chatId, thread_id: threadId, message: reason },
			}))
			process.exit(0)
		}

		if (text.startsWith('/reply ')) {
			const replyMessage = text.slice('/reply '.length).trim()
			if (replyMessage) {
				console.log(JSON.stringify({
					ok: true,
					metadata: { action: 'task.reply', conversation_id: chatId, thread_id: threadId, message: replyMessage },
				}))
				process.exit(0)
			}
		}

		// If replying to a bot notification message, treat as task reply
		// (replyTo indicates the user is responding to a specific notification)
		if (replyTo) {
			console.log(JSON.stringify({
				ok: true,
				metadata: { action: 'task.reply', conversation_id: chatId, thread_id: threadId, message: text },
			}))
			process.exit(0)
		}

		// General message (not a command, not replying to notification) → query mode
		console.log(JSON.stringify({
			ok: true,
			metadata: {
				action: 'query.message',
				conversation_id: chatId,
				message: text,
				sender_id: senderId,
				sender_name: senderName,
			},
		}))
		process.exit(0)
	}

	// Unknown update type
	console.log(JSON.stringify({
		ok: true,
		metadata: { action: 'noop', reason: 'Unrecognized Telegram update' },
	}))
	process.exit(0)
}

// Unknown operation
console.log(JSON.stringify({ ok: false, error: `Unknown op: ${op}` }))

// ─── Helpers ───────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
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
