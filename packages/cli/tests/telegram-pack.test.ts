import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { PackManifestSchema, ProviderSchema } from '@questpie/autopilot-spec'
import { resolveAllPacks } from '../src/packs/resolver'
import { materializePacks } from '../src/packs/materializer'
import type { Registry } from '@questpie/autopilot-spec'

// ─── Helpers ──────────────────────────────────────────────────────────────

async function makeTempDir(prefix = 'autopilot-test-'): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix))
}

async function setupCompanyRoot(dir: string): Promise<void> {
	mkdirSync(join(dir, '.autopilot'), { recursive: true })
	writeFileSync(
		join(dir, '.autopilot', 'company.yaml'),
		stringifyYaml({ name: 'Test', slug: 'test' }),
	)
}

/**
 * Create a git registry from the repo's packs/ directory.
 * Copies the pack files into a fresh git repo with the registry layout.
 */
function createRegistryFromRepoPacks(registryDir: string): void {
	const repoPacksDir = join(import.meta.dir, '..', '..', '..', 'packs')
	mkdirSync(join(registryDir, 'packs'), { recursive: true })

	// Copy all packs from repo root packs/ into registry
	execSync(`cp -r "${repoPacksDir}/telegram-surface" "${registryDir}/packs/"`, { stdio: 'pipe' })

	execSync('git init --initial-branch=main', { cwd: registryDir, stdio: 'pipe' })
	execSync('git config user.email "test@test.com"', { cwd: registryDir, stdio: 'pipe' })
	execSync('git config user.name "Test"', { cwd: registryDir, stdio: 'pipe' })
	execSync('git add -A', { cwd: registryDir, stdio: 'pipe' })
	execSync('git commit -m "init"', { cwd: registryDir, stdio: 'pipe' })
}

// ─── Pack Manifest Tests ─────────────────────────────────────────────────

describe('Telegram pack manifest', () => {
	it('parses against PackManifestSchema', () => {
		const packYamlPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'pack.yaml',
		)
		const raw = readFileSync(packYamlPath, 'utf-8')
		const manifest = PackManifestSchema.parse(parseYaml(raw))

		expect(manifest.id).toBe('telegram-surface')
		expect(manifest.category).toBe('surface')
		expect(manifest.version).toBe('1.0.0')
		expect(manifest.files.length).toBeGreaterThanOrEqual(2)
	})

	it('declares provider and handler files', () => {
		const packYamlPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'pack.yaml',
		)
		const manifest = PackManifestSchema.parse(parseYaml(readFileSync(packYamlPath, 'utf-8')))

		const dests = manifest.files.map((f) => f.dest)
		expect(dests).toContain('providers/telegram.yaml')
		expect(dests).toContain('handlers/telegram.ts')
	})

	it('declares required env vars', () => {
		const packYamlPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'pack.yaml',
		)
		const manifest = PackManifestSchema.parse(parseYaml(readFileSync(packYamlPath, 'utf-8')))

		const envNames = manifest.required_env.map((e) => e.name)
		expect(envNames).toContain('TELEGRAM_BOT_TOKEN')
		expect(envNames).toContain('TELEGRAM_CHAT_ID')
		expect(envNames).toContain('TELEGRAM_WEBHOOK_SECRET')
	})
})

// ─── Provider Config Tests ───────────────────────────────────────────────

describe('Telegram provider config', () => {
	it('validates against ProviderSchema', () => {
		const providerPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'providers',
			'telegram.yaml',
		)
		const raw = readFileSync(providerPath, 'utf-8')
		const provider = ProviderSchema.parse(parseYaml(raw))

		expect(provider.id).toBe('telegram')
		expect(provider.kind).toBe('conversation_channel')
		expect(provider.handler).toBe('handlers/telegram.ts')
	})

	it('declares conversation.ingest and notify.send capabilities', () => {
		const providerPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'providers',
			'telegram.yaml',
		)
		const provider = ProviderSchema.parse(parseYaml(readFileSync(providerPath, 'utf-8')))

		const ops = provider.capabilities.map((c) => c.op)
		expect(ops).toContain('conversation.ingest')
		expect(ops).toContain('notify.send')
	})

	it('has auth_secret and bot_token secret refs', () => {
		const providerPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'providers',
			'telegram.yaml',
		)
		const provider = ProviderSchema.parse(parseYaml(readFileSync(providerPath, 'utf-8')))

		const secretNames = provider.secret_refs.map((s) => s.name)
		expect(secretNames).toContain('bot_token')
		expect(secretNames).toContain('auth_secret')
	})

	it('handler path starts with handlers/', () => {
		const providerPath = join(
			import.meta.dir,
			'..',
			'..',
			'..',
			'packs',
			'telegram-surface',
			'providers',
			'telegram.yaml',
		)
		const provider = ProviderSchema.parse(parseYaml(readFileSync(providerPath, 'utf-8')))

		expect(provider.handler.startsWith('handlers/')).toBe(true)
	})
})

// ─── Pack Install / Materialization Tests ────────────────────────────────

describe('Telegram pack installation', () => {
	let tempDir: string
	let registryDir: string
	let testRegistry: Registry

	beforeEach(async () => {
		tempDir = await makeTempDir()
		registryDir = await makeTempDir('autopilot-registry-')
		await setupCompanyRoot(tempDir)
		createRegistryFromRepoPacks(registryDir)
		testRegistry = { id: 'questpie', type: 'git', url: registryDir, default: true, priority: 0 }
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
		await rm(registryDir, { recursive: true, force: true })
	})

	it('resolves telegram-surface from registry', () => {
		const result = resolveAllPacks(
			[{ ref: 'questpie/telegram-surface', version: 'latest' }],
			[testRegistry],
			tempDir,
		)
		expect(result.resolved).toHaveLength(1)
		expect(result.errors).toHaveLength(0)
		expect(result.resolved[0]?.manifest.id).toBe('telegram-surface')
	})

	it('materializes provider and handler into .autopilot/', () => {
		const { resolved } = resolveAllPacks(
			[{ ref: 'questpie/telegram-surface', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		const result = materializePacks(resolved, tempDir)

		expect(result.installed).toContain('questpie/telegram-surface')
		expect(result.conflicts).toHaveLength(0)

		// Provider materialized
		const providerPath = join(tempDir, '.autopilot', 'providers', 'telegram.yaml')
		expect(existsSync(providerPath)).toBe(true)
		const provider = ProviderSchema.parse(parseYaml(readFileSync(providerPath, 'utf-8')))
		expect(provider.id).toBe('telegram')

		// Handler materialized
		const handlerPath = join(tempDir, '.autopilot', 'handlers', 'telegram.ts')
		expect(existsSync(handlerPath)).toBe(true)
		const handlerContent = readFileSync(handlerPath, 'utf-8')
		expect(handlerContent).toContain('conversation.ingest')
		expect(handlerContent).toContain('notify.send')
	})

	it('does not conflict with user-owned files', () => {
		// Pre-create a different provider
		mkdirSync(join(tempDir, '.autopilot', 'providers'), { recursive: true })
		writeFileSync(join(tempDir, '.autopilot', 'providers', 'custom.yaml'), 'id: custom')

		const { resolved } = resolveAllPacks(
			[{ ref: 'questpie/telegram-surface', version: 'latest' }],
			[testRegistry],
			tempDir,
		)

		const result = materializePacks(resolved, tempDir)

		expect(result.installed).toContain('questpie/telegram-surface')
		// Custom file untouched
		expect(readFileSync(join(tempDir, '.autopilot', 'providers', 'custom.yaml'), 'utf-8')).toBe(
			'id: custom',
		)
	})
})

// ─── Handler Behavior Tests ──────────────────────────────────────────────

describe('Telegram handler normalization', () => {
	const handlerPath = join(
		import.meta.dir,
		'..',
		'..',
		'..',
		'packs',
		'telegram-surface',
		'handlers',
		'telegram.ts',
	)

	function runHandler(envelope: Record<string, unknown>): Promise<Record<string, unknown>> {
		const proc = Bun.spawn(['bun', 'run', handlerPath], {
			stdin: new Blob([JSON.stringify(envelope)]),
			stdout: 'pipe',
			stderr: 'pipe',
		})
		return new Response(proc.stdout).text().then((t) => JSON.parse(t.trim()))
	}

	// Outbound tests (notify.send) — require real bot token, skip with mock

	it('outbound fails gracefully without bot_token', async () => {
		const result = await runHandler({
			op: 'notify.send',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: {},
			payload: { title: 'Test' },
		})

		expect(result.ok).toBe(false)
		expect(result.error).toContain('bot_token')
	})

	it('outbound skips when no chat_id available', async () => {
		const result = await runHandler({
			op: 'notify.send',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: { title: 'Test' },
		})

		expect(result.ok).toBe(true)
		expect((result.metadata as Record<string, unknown>)?.skipped).toBe(true)
	})

	// ── Outbound rendering with mock Telegram API ──────────────────────────

	it('renders inline buttons from payload.actions', async () => {
		const received: Record<string, unknown>[] = []
		const mockServer = Bun.serve({
			port: 0,
			async fetch(req) {
				received.push(await req.json())
				return Response.json({ ok: true, result: { message_id: 42 } })
			},
		})

		try {
			const result = await runHandler({
				op: 'notify.send',
				provider_id: 'telegram',
				provider_kind: 'conversation_channel',
				config: { api_base_url: `http://localhost:${mockServer.port}` },
				secrets: { bot_token: 'test-token' },
				payload: {
					event_type: 'task_blocked',
					severity: 'warning',
					title: 'Review needed',
					summary: 'Deploy requires approval',
					task_id: 'task-123',
					conversation_id: '99999',
					actions: [
						{ action: 'task.approve', label: 'Approve', style: 'primary', requires_message: false },
						{ action: 'task.reject', label: 'Reject', style: 'danger', requires_message: false },
						{ action: 'task.reply', label: 'Reply', style: 'secondary', requires_message: true },
					],
				},
			})

			expect(result.ok).toBe(true)
			expect(received).toHaveLength(1)

			const body = received[0]
			expect(body.chat_id).toBe('99999')
			expect(body.text).toContain('Review needed')

			// Should have inline keyboard with Approve and Reject buttons (reply is requires_message, so text hint)
			const markup = JSON.parse(body.reply_markup as string) as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
			expect(markup.inline_keyboard).toHaveLength(1)
			const buttons = markup.inline_keyboard[0]
			expect(buttons).toHaveLength(2)
			expect(buttons[0].callback_data).toBe('approve:task-123')
			expect(buttons[1].callback_data).toBe('reject:task-123')

			// Reply hint should be in the message text
			expect(body.text).toContain('reply')
		} finally {
			mockServer.stop()
		}
	})

	it('renders no buttons when actions is absent', async () => {
		const received: Record<string, unknown>[] = []
		const mockServer = Bun.serve({
			port: 0,
			async fetch(req) {
				received.push(await req.json())
				return Response.json({ ok: true, result: { message_id: 43 } })
			},
		})

		try {
			const result = await runHandler({
				op: 'notify.send',
				provider_id: 'telegram',
				provider_kind: 'conversation_channel',
				config: { api_base_url: `http://localhost:${mockServer.port}` },
				secrets: { bot_token: 'test-token' },
				payload: {
					event_type: 'run_completed',
					severity: 'info',
					title: 'Run done',
					summary: 'All good',
					conversation_id: '99999',
				},
			})

			expect(result.ok).toBe(true)
			expect(received).toHaveLength(1)
			// No reply_markup when no actions
			expect(received[0].reply_markup).toBeUndefined()
		} finally {
			mockServer.stop()
		}
	})

	// Inbound tests (conversation.ingest)

	it('normalizes callback_query approve button', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				callback_query: {
					id: 'cb123',
					data: 'approve:task-1',
					message: { chat: { id: 12345 }, message_id: 100 },
				},
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('task.approve')
		expect(meta.conversation_id).toBe('12345')
	})

	it('normalizes callback_query reject button', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				callback_query: {
					id: 'cb456',
					data: 'reject:task-1',
					message: { chat: { id: 12345 }, message_id: 100 },
				},
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('task.reject')
		expect(meta.conversation_id).toBe('12345')
	})

	it('normalizes /approve text command', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				message: {
					chat: { id: 99999 },
					text: '/approve',
				},
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('task.approve')
		expect(meta.conversation_id).toBe('99999')
	})

	it('normalizes /reject with reason', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				message: {
					chat: { id: 99999 },
					text: '/reject Not good enough',
				},
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('task.reject')
		expect(meta.message).toBe('Not good enough')
	})

	it('normalizes plain text as task.reply', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				message: {
					chat: { id: 99999 },
					text: 'Please also add tests for the edge case',
				},
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('task.reply')
		expect(meta.message).toBe('Please also add tests for the edge case')
	})

	it('returns noop for empty message', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				message: {
					chat: { id: 99999 },
					text: '',
				},
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('noop')
	})

	it('returns noop for unknown update type', async () => {
		const result = await runHandler({
			op: 'conversation.ingest',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {
				edited_message: { text: 'edited' },
			},
		})

		expect(result.ok).toBe(true)
		const meta = result.metadata as Record<string, unknown>
		expect(meta.action).toBe('noop')
	})

	it('errors on unknown op', async () => {
		const result = await runHandler({
			op: 'unknown.op',
			provider_id: 'telegram',
			provider_kind: 'conversation_channel',
			config: {},
			secrets: { bot_token: 'fake-token' },
			payload: {},
		})

		expect(result.ok).toBe(false)
		expect(result.error).toContain('Unknown op')
	})
})

// ─── No Core Hardcoding ─────────────────────────────────────────────────

describe('Minimal Telegram awareness in core', () => {
	it('orchestrator has no telegram imports or telegram-specific service code', () => {
		// The conversation route accepts Telegram's webhook header as a thin auth shim.
		// This test verifies no deeper Telegram integration exists (imports, services, models).
		// We search for actual code references (import/require/class/function), not doc comments.
		const orchestratorSrc = join(import.meta.dir, '..', '..', 'orchestrator', 'src')
		const result = Bun.spawnSync(
			[
				'grep',
				'-r',
				'-l',
				'--include=*.ts',
				'-P',
				'(?i)(?<!\\*.*|//.*|"|\'|`)telegram(?!_)',
				orchestratorSrc,
			],
			{ stdout: 'pipe' },
		)
		const files = new TextDecoder().decode(result.stdout).trim().split('\n').filter(Boolean)

		// Only the conversation route and binding service should reference Telegram
		// (header acceptance + comment). No services, models, or provider-specific code.
		const allowed = ['conversations.ts', 'conversation-bindings.ts']
		for (const f of files) {
			if (!allowed.some((a) => f.includes(a))) {
				throw new Error(`Unexpected Telegram reference in ${f}`)
			}
		}
	})
})
