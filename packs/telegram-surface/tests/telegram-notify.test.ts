import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const HANDLER_PATH = join(import.meta.dir, '..', 'handlers', 'telegram.ts')

interface HandlerResult {
	ok: boolean
	external_id?: string
	metadata?: Record<string, unknown>
	error?: string
}

type CapturedRequest = {
	url: string
	body: Record<string, unknown>
}

const servers: Array<{ stop: (closeActiveConnections?: boolean) => void }> = []

afterEach(() => {
	for (const server of servers.splice(0)) {
		server.stop(true)
	}
})

async function runHandler(envelope: Record<string, unknown>): Promise<HandlerResult> {
	const proc = Bun.spawn(['bun', 'run', HANDLER_PATH], {
		stdin: new Blob([JSON.stringify(envelope)]),
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const output = await new Response(proc.stdout).text()
	await proc.exited
	return JSON.parse(output)
}

function startTelegramApi(captured: CapturedRequest[]) {
	const server = Bun.serve({
		port: 0,
		async fetch(request: Request) {
			const body = (await request.json()) as Record<string, unknown>
			captured.push({ url: request.url, body })
			return Response.json({ ok: true, result: { message_id: 123 } })
		},
	})
	servers.push(server)
	return `http://127.0.0.1:${server.port}`
}

describe('Telegram handler: notify.send rendering', () => {
	test('query_response preserves headings and fenced code blocks', async () => {
		const captured: CapturedRequest[] = []
		const apiBaseUrl = startTelegramApi(captured)

		const result = await runHandler({
			op: 'notify.send',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: { api_base_url: apiBaseUrl, default_chat_id: '12345' },
			secrets: { bot_token: 'test-token' },
			payload: {
				event_type: 'query_response',
				title: 'Fallback',
				summary: '### Title\n\n```\nconst x = 1\n```',
			},
		})

		expect(result.ok).toBe(true)
		expect(captured).toHaveLength(1)
		expect(captured[0]!.url).toContain('/bottest-token/sendMessage')
		expect(captured[0]!.body.parse_mode).toBe('HTML')
		expect(captured[0]!.body.text).toContain('<b>Title</b>')
		expect(captured[0]!.body.text).toContain('<pre>const x = 1</pre>')
	})

	test('query_response escapes HTML inside inline code without double escaping', async () => {
		const captured: CapturedRequest[] = []
		const apiBaseUrl = startTelegramApi(captured)

		const result = await runHandler({
			op: 'notify.send',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: { api_base_url: apiBaseUrl, default_chat_id: '12345' },
			secrets: { bot_token: 'test-token' },
			payload: {
				event_type: 'query_response',
				summary: 'use `a < b` and [docs](https://example.com)',
			},
		})

		expect(result.ok).toBe(true)
		expect(captured).toHaveLength(1)
		expect(captured[0]!.body.text).toContain('<code>a &lt; b</code>')
		expect(captured[0]!.body.text).toContain('<a href="https://example.com">docs</a>')
	})
})
