/**
 * Generic text conversation handler.
 *
 * Supports two operations:
 *
 * conversation.ingest (inbound):
 *   Payload: { conversation_id, thread_id?, text }
 *   /approve → task.approve, /reject [reason] → task.reject, text → task.reply
 *
 * notify.send (outbound):
 *   Payload: NotificationPayload with conversation_id, thread_id
 *   Logs the outbound message (real providers would POST to Telegram/Slack/etc)
 */

const input = await Bun.stdin.text()
const envelope = JSON.parse(input)
const op = envelope.op as string

if (op === 'notify.send') {
	// Outbound: format notification for the bound conversation
	const p = envelope.payload
	const convId = p.conversation_id as string | undefined
	if (!convId) {
		console.log(JSON.stringify({ ok: true, metadata: { skipped: true, reason: 'no conversation_id' } }))
		process.exit(0)
	}

	// In a real provider, this would POST to Telegram/Slack/Discord API.
	// For the example, we record what was delivered.
	console.log(JSON.stringify({
		ok: true,
		metadata: {
			delivered: true,
			conversation_id: convId,
			thread_id: p.thread_id,
			title: p.title,
			summary: p.summary,
			preview_url: p.preview_url,
			task_url: p.task_url,
			run_url: p.run_url,
		},
	}))
	process.exit(0)
}

// conversation.ingest (inbound)
const conversationId = envelope.payload.conversation_id as string | undefined
const threadId = envelope.payload.thread_id as string | undefined
const text = (envelope.payload.text as string ?? '').trim()

if (!conversationId) {
	console.log(JSON.stringify({
		ok: true,
		metadata: { action: 'noop', reason: 'Missing conversation_id' },
	}))
	process.exit(0)
}

if (!text) {
	console.log(JSON.stringify({
		ok: true,
		metadata: { action: 'noop', reason: 'Empty text' },
	}))
	process.exit(0)
}

if (text === '/approve') {
	console.log(JSON.stringify({
		ok: true,
		metadata: {
			action: 'task.approve',
			conversation_id: conversationId,
			thread_id: threadId,
		},
	}))
} else if (text.startsWith('/reject')) {
	const reason = text.slice('/reject'.length).trim() || undefined
	console.log(JSON.stringify({
		ok: true,
		metadata: {
			action: 'task.reject',
			conversation_id: conversationId,
			thread_id: threadId,
			message: reason,
		},
	}))
} else {
	console.log(JSON.stringify({
		ok: true,
		metadata: {
			action: 'task.reply',
			conversation_id: conversationId,
			thread_id: threadId,
			message: text,
		},
	}))
}
