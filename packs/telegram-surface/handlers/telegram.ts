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

// ─── Inline SDK helpers (handler runs standalone, can't import orchestrator) ──

interface HandlerResult {
	ok: boolean
	external_id?: string
	metadata?: Record<string, unknown>
	error?: string
}

function ok(data?: Partial<HandlerResult>): HandlerResult {
	return { ok: true, ...data }
}

function fail(error: string): HandlerResult {
	return { ok: false, error }
}

function noop(reason?: string): HandlerResult {
	return { ok: true, metadata: { action: 'noop', reason } }
}

function queryMessage(input: {
	conversation_id: string
	thread_id?: string
	message: string
	sender_id?: string
	sender_name?: string
}): HandlerResult {
	return { ok: true, metadata: { action: 'query.message', ...input } }
}

function conversationApprove(input: {
	conversation_id: string
	thread_id?: string
}): HandlerResult {
	return { ok: true, metadata: { action: 'task.approve', ...input } }
}

function conversationReject(input: {
	conversation_id: string
	thread_id?: string
	message?: string
}): HandlerResult {
	return { ok: true, metadata: { action: 'task.reject', ...input } }
}

function conversationReply(input: {
	conversation_id: string
	thread_id?: string
	message: string
}): HandlerResult {
	return { ok: true, metadata: { action: 'task.reply', ...input } }
}

function conversationCommand(input: {
	conversation_id: string
	thread_id?: string
	command: string
	args: string
	sender_id?: string
	sender_name?: string
}): HandlerResult {
	return { ok: true, metadata: { action: 'conversation.command', ...input } }
}

function emit(result: HandlerResult): never {
	console.log(JSON.stringify(result))
	process.exit(0)
}

// ─── Envelope parsing ─────────────────────────────────────────────────────

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
	emit(fail('Missing secret: bot_token'))
}

const apiBase = (envelope.config?.api_base_url as string) ?? 'https://api.telegram.org'
const TELEGRAM_API = `${apiBase}/bot${botToken}`

// ─── Outbound: notify.send ─────────────────────────────────────────────

if (op === 'notify.send') {
	const payload = envelope.payload as Record<string, unknown>
	const chatId = resolveEnvPlaceholder(payload.conversation_id)
		?? resolveEnvPlaceholder(envelope.config?.default_chat_id)

	if (!chatId) {
		emit(ok({ metadata: { skipped: true, reason: 'no chat_id' } }))
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
	const isTaskProgress = eventType === 'task_progress'

	let text: string
	let parseMode: string | undefined

	if (isQueryEvent) {
		text = markdownToTelegramHtml(summary || title)
		if (previewUrl) {
			text += `\n\n\ud83d\udd17 <a href="${escapeHtml(previewUrl)}">Preview</a>`
		}
		parseMode = 'HTML'
	} else if (isTaskProgress) {
		// Card-style progress rendering for task_progress events
		const normalizedStatus = payload.normalized_status as string | undefined
		const workflowId = payload.workflow_id as string | undefined

		const STATUS_MAP: Record<string, { icon: string; label: string }> = {
			working: { icon: '\u23f3', label: 'Working' },
			plan_ready: { icon: '\ud83d\udcdd', label: 'Plan ready' },
			waiting_for_review: { icon: '\ud83d\udc40', label: 'Waiting for review' },
			completed: { icon: '\u2705', label: 'Completed' },
			failed: { icon: '\u274c', label: 'Failed' },
		}

		const status = STATUS_MAP[normalizedStatus ?? ''] ?? { icon: '\u2139\ufe0f', label: normalizedStatus ?? 'Unknown' }

		const lines: string[] = [
			`\ud83e\udd16 <b>${escapeHtml(title)}</b>`,
		]

		if (workflowId) {
			lines.push(`\ud83d\udccb <i>${escapeHtml(workflowId)}</i>`)
		}

		lines.push('', `${status.icon} <b>${status.label}</b>`)

		if (summary) {
			const truncated = summary.length > 500 ? `${summary.slice(0, 497)}...` : summary
			lines.push(escapeHtml(truncated))
		}

		if (previewUrl) lines.push('', `\ud83d\udd17 <a href="${escapeHtml(previewUrl)}">Preview</a>`)
		if (taskUrl) lines.push(`\ud83d\udcdd <a href="${escapeHtml(taskUrl)}">Task details</a>`)

		if (normalizedStatus === 'waiting_for_review') {
			lines.push('', '\ud83d\udcac Reply to this message to respond')
		}

		text = lines.join('\n')
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

	// Build inline keyboard (only for task notifications and task_progress waiting_for_review)
	const keyboard: Array<Array<{ text: string; callback_data: string }>> = []
	const showButtons = isTaskProgress
		? (payload.normalized_status === 'waiting_for_review' && !!taskId)
		: (!isQueryEvent && !!taskId)

	if (showButtons) {
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
			emit(ok({
				external_id: String(messageId),
				metadata: { chat_id: chatId, message_id: messageId },
			}))
		} else {
			const description = data.description ?? ''
			// Telegram returns "message is not modified" when the progress text already
			// matches the final response. Treat that as a successful edit, otherwise
			// fast query completions can duplicate the final message via fallback send.
			if (useEdit && description.toLowerCase().includes('message is not modified')) {
				const messageId = Number(editMessageId)
				emit(ok({
					external_id: String(messageId),
					metadata: { chat_id: chatId, message_id: messageId, unchanged: true },
				}))
			} else if (useEdit) {
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
					emit(ok({
						external_id: String(fallbackData.result?.message_id ?? ''),
						metadata: { chat_id: chatId, message_id: fallbackData.result?.message_id },
					}))
				} else {
					emit(fail(`Telegram API: ${fallbackData.description ?? 'Unknown error'}`))
				}
			} else {
				emit(fail(`Telegram API: ${data.description ?? 'Unknown error'}`))
			}
		}
	} catch (err) {
		emit(fail(err instanceof Error ? err.message : String(err)))
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
			}).catch((err: unknown) => {
				// Best-effort callback answer — log but don't block the response
				console.error(`answerCallbackQuery failed: ${err instanceof Error ? err.message : String(err)}`)
			})
		}

		if (data.startsWith('approve:')) {
			emit(conversationApprove({ conversation_id: chatId, thread_id: messageId }))
		}

		if (data.startsWith('reject:')) {
			emit(conversationReject({
				conversation_id: chatId,
				thread_id: messageId,
				message: 'Rejected via Telegram',
			}))
		}

		// Unknown callback
		emit(noop(`Unknown callback: ${data}`))
	}

	// Handle text message
	if (message) {
		const chatId = String((message.chat as Record<string, unknown>)?.id ?? '')
		const messageId = message.message_id !== undefined ? String(message.message_id) : undefined
		const text = (message.text as string ?? '').trim()
		const replyTo = message.reply_to_message as Record<string, unknown> | undefined
		const threadId = replyTo ? String(replyTo.message_id ?? '') : undefined

		// Extract sender identity for group chat support
		const from = message.from as Record<string, unknown> | undefined
		const senderId = from?.id !== undefined ? String(from.id) : undefined
		const senderName = (from?.first_name as string) ?? (from?.username as string) ?? undefined

		if (!text) {
			emit(noop('Empty message'))
		}

		// ── Reserved task-action commands ──────────────────────────────
		if (text === '/approve') {
			emit(conversationApprove({ conversation_id: chatId, thread_id: threadId }))
		}

		if (text.startsWith('/reject')) {
			const reason = text.slice('/reject'.length).trim() || 'Rejected via Telegram'
			emit(conversationReject({ conversation_id: chatId, thread_id: threadId, message: reason }))
		}

		if (text.startsWith('/reply ')) {
			const replyMessage = text.slice('/reply '.length).trim()
			if (replyMessage) {
				emit(conversationReply({ conversation_id: chatId, thread_id: threadId, message: replyMessage }))
			}
		}

		// ── Generic command detection ─────────────────────────────────
		// Commands that fall through to query.message (conversation resets)
		const PASSTHROUGH_COMMANDS = new Set(['/reset', '/new', '/clear'])

		if (text.startsWith('/') && !PASSTHROUGH_COMMANDS.has(text.split(' ')[0]!)) {
			const spaceIdx = text.indexOf(' ')
			const command = spaceIdx > 0 ? text.slice(1, spaceIdx) : text.slice(1)
			const args = spaceIdx > 0 ? text.slice(spaceIdx + 1).trim() : ''
			emit(conversationCommand({
				conversation_id: chatId,
				// For new work orders, use the Telegram update message_id as a
				// stable idempotency key. Replies keep their reply target.
				thread_id: threadId ?? messageId,
				command,
				args,
				sender_id: senderId,
				sender_name: senderName,
			}))
		}

		// If replying to a bot notification message, treat as task reply
		// (replyTo indicates the user is responding to a specific notification)
		if (replyTo) {
			emit(conversationReply({ conversation_id: chatId, thread_id: threadId, message: text }))
		}

		// General message (not a command, not replying to notification) → query mode
		emit(queryMessage({
			conversation_id: chatId,
			message: text,
			sender_id: senderId,
			sender_name: senderName,
		}))
	}

	// Unknown update type
	emit(noop('Unrecognized Telegram update'))
}

// Unknown operation
emit(fail(`Unknown op: ${op}`))

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

function resolveEnvPlaceholder(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length === 0) return undefined
	const match = value.match(/^\$\{([A-Z0-9_]+)\}$/)
	if (!match) return value
	return process.env[match[1]]
}
