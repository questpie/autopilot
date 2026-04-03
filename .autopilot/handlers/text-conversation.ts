/**
 * Generic text conversation handler.
 *
 * Normalizes inbound text into task actions based on command prefixes:
 *   /approve           → task.approve
 *   /reject [reason]   → task.reject
 *   anything else      → task.reply
 *
 * Expected payload:
 *   { conversation_id: string, thread_id?: string, text: string }
 */

const input = await Bun.stdin.text()
const envelope = JSON.parse(input)

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
