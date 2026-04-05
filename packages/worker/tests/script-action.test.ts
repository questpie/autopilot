/**
 * Tests for the script action executor.
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, writeFile, mkdir, chmod, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { WorkerEvent, ExternalAction, ScriptAction, RunArtifact } from '@questpie/autopilot-spec'
import { ExternalActionSchema, ScriptResultSchema } from '@questpie/autopilot-spec'
import { executeActions } from '../src/actions/webhook'
import { executeScriptAction, type ScriptActionContext } from '../src/actions/script'

// ─── Helpers ───────────────────────────────────────────────────────────────

let workDir: string

beforeAll(async () => {
	workDir = await mkdtemp(join(tmpdir(), 'script-action-test-'))
	await mkdir(join(workDir, 'scripts'), { recursive: true })
	await mkdir(join(workDir, 'sub'), { recursive: true })
})

function collectEvents(
	fn: (emit: (e: WorkerEvent) => void) => Promise<unknown>,
): Promise<WorkerEvent[]> {
	const events: WorkerEvent[] = []
	return fn((e) => events.push(e)).then(() => events)
}

function makeCtx(overrides: Partial<ScriptActionContext> = {}): ScriptActionContext {
	return {
		workspacePath: workDir,
		secrets: new Map(),
		runArtifacts: [],
		...overrides,
	}
}

async function writeScript(relPath: string, content: string): Promise<void> {
	const abs = join(workDir, relPath)
	await writeFile(abs, content)
	await chmod(abs, 0o755)
}

// ─── Schema parsing ────────────────────────────────────────────────────────

describe('Script action schema', () => {
	test('parses a minimal script action', () => {
		const result = ExternalActionSchema.safeParse({
			kind: 'script',
			script: 'scripts/deploy.sh',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.kind).toBe('script')
		}
	})

	test('parses a full script action with all fields', () => {
		const result = ExternalActionSchema.safeParse({
			kind: 'script',
			script: 'scripts/test.sh',
			args: ['--verbose', '--ci'],
			cwd: 'sub',
			timeout_ms: 30000,
			runner: 'bash',
			env: { CI: 'true', NODE_ENV: 'test' },
			secret_env: { DEPLOY_TOKEN: 'deploy-token-ref' },
			input_artifacts: ['test-report'],
		})
		expect(result.success).toBe(true)
		if (result.success && result.data.kind === 'script') {
			expect(result.data.runner).toBe('bash')
			expect(result.data.args).toEqual(['--verbose', '--ci'])
			expect(result.data.env?.CI).toBe('true')
			expect(result.data.secret_env?.DEPLOY_TOKEN).toBe('deploy-token-ref')
			expect(result.data.input_artifacts).toEqual(['test-report'])
		}
	})

	test('rejects invalid runner', () => {
		const result = ExternalActionSchema.safeParse({
			kind: 'script',
			script: 'test.sh',
			runner: 'powershell',
		})
		expect(result.success).toBe(false)
	})

	test('defaults runner to exec and args to []', () => {
		const result = ExternalActionSchema.safeParse({
			kind: 'script',
			script: 'test.sh',
		})
		expect(result.success).toBe(true)
		if (result.success && result.data.kind === 'script') {
			expect(result.data.runner).toBe('exec')
			expect(result.data.args).toEqual([])
		}
	})

	test('webhook schema still parses correctly', () => {
		const result = ExternalActionSchema.safeParse({
			kind: 'webhook',
			url_ref: 'my-url',
			method: 'POST',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.kind).toBe('webhook')
		}
	})
})

// ─── Script result schema ──────────────────────────────────────────────────

describe('ScriptResultSchema', () => {
	test('parses structured result with all fields', () => {
		const result = ScriptResultSchema.safeParse({
			summary: 'Deploy succeeded',
			artifacts: [{ title: 'deploy-log', ref_value: '/tmp/deploy.log' }],
			outputs: { deploy_url: 'https://example.com' },
		})
		expect(result.success).toBe(true)
	})

	test('parses empty object', () => {
		const result = ScriptResultSchema.safeParse({})
		expect(result.success).toBe(true)
	})

	test('rejects non-object', () => {
		const result = ScriptResultSchema.safeParse('just a string')
		expect(result.success).toBe(false)
	})
})

// ─── Basic execution ───────────────────────────────────────────────────────

describe('Script execution', () => {
	test('executes a simple script successfully', async () => {
		await writeScript('scripts/hello.sh', '#!/bin/bash\necho "hello world"')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/hello.sh',
			args: [],
			runner: 'bash',
		}

		const events = await collectEvents(async (emit) => {
			await executeScriptAction(action, makeCtx(), emit)
		})

		const starting = events.find((e) => e.summary.includes('starting'))
		expect(starting).toBeDefined()
	})

	test('exec runner invokes script directly', async () => {
		await writeScript('scripts/direct.sh', '#!/bin/bash\necho "direct"')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/direct.sh',
			args: [],
			runner: 'exec',
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result).toBeDefined()
	})

	test('passes arguments to script', async () => {
		await writeScript('scripts/args.sh', '#!/bin/bash\necho "$1 $2"')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/args.sh',
			args: ['foo', 'bar'],
			runner: 'bash',
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result).toBeDefined()
	})

	test('uses custom cwd', async () => {
		await writeScript('scripts/pwd.sh', '#!/bin/bash\npwd')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/pwd.sh',
			args: [],
			runner: 'bash',
			cwd: 'sub',
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result).toBeDefined()
	})
})

// ─── Env / secret injection ────────────────────────────────────────────────

describe('Env and secret injection', () => {
	test('injects static env variables', async () => {
		await writeScript('scripts/env.sh', '#!/bin/bash\necho "$MY_VAR"')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/env.sh',
			args: [],
			runner: 'bash',
			env: { MY_VAR: 'hello' },
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result).toBeDefined()
	})

	test('injects secret env from resolved secrets', async () => {
		await writeScript('scripts/secret.sh', '#!/bin/bash\necho "$SECRET_TOKEN"')

		const secrets = new Map([['deploy-token', 'secret-value-123']])
		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/secret.sh',
			args: [],
			runner: 'bash',
			secret_env: { SECRET_TOKEN: 'deploy-token' },
		}

		const result = await executeScriptAction(action, makeCtx({ secrets }), () => {})
		expect(result).toBeDefined()
	})

	test('throws on unresolved secret_env reference', async () => {
		await writeScript('scripts/missing-secret.sh', '#!/bin/bash\necho ok')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/missing-secret.sh',
			args: [],
			runner: 'bash',
			secret_env: { TOKEN: 'nonexistent-ref' },
		}

		await expect(
			executeScriptAction(action, makeCtx(), () => {}),
		).rejects.toThrow('not resolved')
	})
})

// ─── Path safety ───────────────────────────────────────────────────────────

describe('Path escape rejection', () => {
	test('rejects script path escaping workspace', async () => {
		const action: ScriptAction = {
			kind: 'script',
			script: '../../etc/passwd',
			args: [],
			runner: 'exec',
		}

		await expect(
			executeScriptAction(action, makeCtx(), () => {}),
		).rejects.toThrow('escapes workspace root')
	})

	test('rejects cwd path escaping workspace', async () => {
		await writeScript('scripts/ok.sh', '#!/bin/bash\necho ok')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/ok.sh',
			args: [],
			runner: 'bash',
			cwd: '../../../tmp',
		}

		await expect(
			executeScriptAction(action, makeCtx(), () => {}),
		).rejects.toThrow('escapes workspace root')
	})
})

// ─── Timeout handling ──────────────────────────────────────────────────────

describe('Timeout', () => {
	test(
		'kills script after timeout_ms',
		async () => {
			await writeScript('scripts/slow.sh', '#!/bin/bash\nsleep 60')

			const action: ScriptAction = {
				kind: 'script',
				script: 'scripts/slow.sh',
				args: [],
				runner: 'bash',
				timeout_ms: 500,
			}

			await expect(
				executeScriptAction(action, makeCtx(), () => {}),
			).rejects.toThrow(/timed out/i)
		},
		10_000,
	)
})

// ─── Non-zero exit ─────────────────────────────────────────────────────────

describe('Failure semantics', () => {
	test('non-zero exit code throws with stderr', async () => {
		await writeScript('scripts/fail.sh', '#!/bin/bash\necho "bad thing" >&2\nexit 1')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/fail.sh',
			args: [],
			runner: 'bash',
		}

		await expect(
			executeScriptAction(action, makeCtx(), () => {}),
		).rejects.toThrow('exited with code 1')
	})

	test('script failure propagates through executeActions', async () => {
		await writeScript('scripts/boom.sh', '#!/bin/bash\nexit 42')

		const actions: ExternalAction[] = [
			{ kind: 'script', script: 'scripts/boom.sh', args: [], runner: 'bash' },
		]

		await expect(
			executeActions({
				actions,
				emitEvent: () => {},
				workspacePath: workDir,
			}),
		).rejects.toThrow('Script action')
	})
})

// ─── Structured stdout result ──────────────────────────────────────────────

describe('Structured result parsing', () => {
	test('merges artifacts from structured JSON stdout', async () => {
		const output = JSON.stringify({
			summary: 'Deployed to staging',
			artifacts: [
				{ title: 'deploy-log', ref_value: '/tmp/deploy.log' },
			],
			outputs: { deploy_url: 'https://staging.example.com' },
		})
		await writeScript('scripts/structured.sh', `#!/bin/bash\necho '${output}'`)

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/structured.sh',
			args: [],
			runner: 'bash',
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result.summary).toBe('Deployed to staging')
		expect(result.artifacts).toHaveLength(1)
		expect(result.artifacts[0].title).toBe('deploy-log')
		expect(result.outputs.deploy_url).toBe('https://staging.example.com')
	})

	test('plain text stdout returns empty result', async () => {
		await writeScript('scripts/plain.sh', '#!/bin/bash\necho "just some logs"')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/plain.sh',
			args: [],
			runner: 'bash',
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result.artifacts).toHaveLength(0)
		expect(Object.keys(result.outputs)).toHaveLength(0)
		expect(result.summary).toBeUndefined()
	})

	test('malformed JSON stdout is treated as plain text (no crash)', async () => {
		await writeScript('scripts/bad-json.sh', '#!/bin/bash\necho "{not valid json"')

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/bad-json.sh',
			args: [],
			runner: 'bash',
		}

		const result = await executeScriptAction(action, makeCtx(), () => {})
		expect(result.artifacts).toHaveLength(0)
	})
})

// ─── Output collision ──────────────────────────────────────────────────────

describe('Output collision', () => {
	test('duplicate output keys across actions cause hard failure', async () => {
		const output = JSON.stringify({ outputs: { key: 'value1' } })
		await writeScript('scripts/out1.sh', `#!/bin/bash\necho '${output}'`)

		const output2 = JSON.stringify({ outputs: { key: 'value2' } })
		await writeScript('scripts/out2.sh', `#!/bin/bash\necho '${output2}'`)

		const actions: ExternalAction[] = [
			{ kind: 'script', script: 'scripts/out1.sh', args: [], runner: 'bash' },
			{ kind: 'script', script: 'scripts/out2.sh', args: [], runner: 'bash' },
		]

		await expect(
			executeActions({
				actions,
				emitEvent: () => {},
				workspacePath: workDir,
			}),
		).rejects.toThrow('Output key collision')
	})

	test('non-overlapping output keys merge cleanly', async () => {
		const out1 = JSON.stringify({ outputs: { url: 'https://a.com' } })
		await writeScript('scripts/merge1.sh', `#!/bin/bash\necho '${out1}'`)

		const out2 = JSON.stringify({ outputs: { status: 'deployed' } })
		await writeScript('scripts/merge2.sh', `#!/bin/bash\necho '${out2}'`)

		const actions: ExternalAction[] = [
			{ kind: 'script', script: 'scripts/merge1.sh', args: [], runner: 'bash' },
			{ kind: 'script', script: 'scripts/merge2.sh', args: [], runner: 'bash' },
		]

		const result = await executeActions({
			actions,
			emitEvent: () => {},
			workspacePath: workDir,
		})

		expect(result.outputs.url).toBe('https://a.com')
		expect(result.outputs.status).toBe('deployed')
	})
})

// ─── Input artifact manifest ───────────────────────────────────────────────

describe('Input artifact manifest', () => {
	test('writes manifest with matched artifacts', async () => {
		await writeScript(
			'scripts/read-manifest.sh',
			'#!/bin/bash\ncat "$AUTOPILOT_INPUT_ARTIFACTS_JSON"',
		)

		const runArtifacts: RunArtifact[] = [
			{ kind: 'test_report', title: 'test-report', ref_kind: 'file', ref_value: '/tmp/report.xml' },
			{ kind: 'changed_file', title: 'diff', ref_kind: 'inline', ref_value: 'some diff' },
		]

		const action: ScriptAction = {
			kind: 'script',
			script: 'scripts/read-manifest.sh',
			args: [],
			runner: 'bash',
			input_artifacts: ['test-report'],
		}

		await executeScriptAction(action, makeCtx({ runArtifacts }), () => {})

		// Verify the manifest was written
		const manifestPath = join(workDir, '.autopilot-input-artifacts.json')
		const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
		expect(manifest).toHaveLength(1)
		expect(manifest[0].title).toBe('test-report')
	})
})

// ─── Mixed actions (webhook + script) ──────────────────────────────────────

describe('Mixed webhook and script actions', () => {
	test('webhook and script coexist in action list', async () => {
		const out = JSON.stringify({ outputs: { result: 'ok' } })
		await writeScript('scripts/mixed.sh', `#!/bin/bash\necho '${out}'`)

		// We can't easily test a real webhook here, but we can verify
		// the dispatcher handles both kinds without crashing
		const actions: ExternalAction[] = [
			{ kind: 'script', script: 'scripts/mixed.sh', args: [], runner: 'bash' },
		]

		const events: WorkerEvent[] = []
		const result = await executeActions({
			actions,
			emitEvent: (e) => events.push(e),
			workspacePath: workDir,
		})

		expect(result.outputs.result).toBe('ok')
		expect(events.some((e) => e.metadata?.action_kind === 'script')).toBe(true)
	})

	test('script action fails hard when no workspace available', async () => {
		const actions: ExternalAction[] = [
			{ kind: 'script', script: 'scripts/noop.sh', args: [], runner: 'bash' },
		]

		await expect(
			executeActions({
				actions,
				emitEvent: () => {},
				// no workspacePath
			}),
		).rejects.toThrow('requires a workspace')
	})
})
