/**
 * Generic text-to-task intake handler.
 *
 * Normalizes an inbound text payload into a task.create action.
 *
 * Expected payload:
 *   { text: string, type?: string, priority?: string }
 *
 * Behavior:
 *   - If text is empty or missing → noop
 *   - Otherwise → task.create with text as title
 */

const input = await Bun.stdin.text()
const envelope = JSON.parse(input)

const text = envelope.payload.text as string | undefined
if (!text || text.trim().length === 0) {
	console.log(JSON.stringify({
		ok: true,
		metadata: {
			action: 'noop',
			reason: 'Empty or missing text',
		},
	}))
	process.exit(0)
}

const type = (envelope.payload.type as string) ?? envelope.config.default_type ?? 'feature'
const priority = (envelope.payload.priority as string) ?? undefined

console.log(JSON.stringify({
	ok: true,
	metadata: {
		action: 'task.create',
		input: {
			title: text.trim(),
			type,
			priority,
			metadata: {
				source_provider: envelope.provider_id,
			},
		},
	},
}))
