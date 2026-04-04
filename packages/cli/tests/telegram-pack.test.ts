import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
	PackManifestSchema,
	ProviderSchema,
} from '@questpie/autopilot-spec'
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
		const packYamlPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'pack.yaml')
		const raw = readFileSync(packYamlPath, 'utf-8')
		const manifest = PackManifestSchema.parse(parseYaml(raw))

		expect(manifest.id).toBe('telegram-surface')
		expect(manifest.category).toBe('surface')
		expect(manifest.version).toBe('1.0.0')
		expect(manifest.files.length).toBeGreaterThanOrEqual(2)
	})

	it('declares provider and handler files', () => {
		const packYamlPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'pack.yaml')
		const manifest = PackManifestSchema.parse(parseYaml(readFileSync(packYamlPath, 'utf-8')))

		const dests = manifest.files.map((f) => f.dest)
		expect(dests).toContain('providers/telegram.yaml')
		expect(dests).toContain('handlers/telegram.ts')
	})

	it('declares required env vars', () => {
		const packYamlPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'pack.yaml')
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
		const providerPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'providers', 'telegram.yaml')
		const raw = readFileSync(providerPath, 'utf-8')
		const provider = ProviderSchema.parse(parseYaml(raw))

		expect(provider.id).toBe('telegram')
		expect(provider.kind).toBe('conversation_channel')
		expect(provider.handler).toBe('handlers/telegram.ts')
	})

	it('declares conversation.ingest and notify.send capabilities', () => {
		const providerPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'providers', 'telegram.yaml')
		const provider = ProviderSchema.parse(parseYaml(readFileSync(providerPath, 'utf-8')))

		const ops = provider.capabilities.map((c) => c.op)
		expect(ops).toContain('conversation.ingest')
		expect(ops).toContain('notify.send')
	})

	it('has auth_secret and bot_token secret refs', () => {
		const providerPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'providers', 'telegram.yaml')
		const provider = ProviderSchema.parse(parseYaml(readFileSync(providerPath, 'utf-8')))

		const secretNames = provider.secret_refs.map((s) => s.name)
		expect(secretNames).toContain('bot_token')
		expect(secretNames).toContain('auth_secret')
	})

	it('handler path starts with handlers/', () => {
		const providerPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'providers', 'telegram.yaml')
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
		expect(result.resolved[0].manifest.id).toBe('telegram-surface')
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
		expect(readFileSync(join(tempDir, '.autopilot', 'providers', 'custom.yaml'), 'utf-8')).toBe('id: custom')
	})
})

// ─── Handler Behavior Tests ──────────────────────────────────────────────

describe('Telegram handler normalization', () => {
	const handlerPath = join(import.meta.dir, '..', '..', '..', 'packs', 'telegram-surface', 'handlers', 'telegram.ts')

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

describe('No Telegram hardcoding in core', () => {
	it('orchestrator core does not import or reference telegram', () => {
		// Check that the orchestrator source has no telegram-specific imports
		const orchestratorSrc = join(import.meta.dir, '..', '..', 'orchestrator', 'src')
		const result = Bun.spawnSync(['grep', '-r', '-i', 'telegram', orchestratorSrc], {
			stdout: 'pipe',
		})
		const output = new TextDecoder().decode(result.stdout)
		expect(output.trim()).toBe('')
	})
})
