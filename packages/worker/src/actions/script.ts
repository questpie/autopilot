/**
 * Script action executor — runs repo-owned scripts in the run workspace
 * with explicit env/secret injection and a structured result contract.
 */

import { resolve, join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { ScriptResultSchema } from '@questpie/autopilot-spec'
import type { ScriptAction, RunArtifact, WorkerEvent } from '@questpie/autopilot-spec'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScriptActionContext {
	/** Absolute path to the run workspace (worktree). */
	workspacePath: string
	/** Resolved secrets available for this run (name → plaintext). */
	secrets: Map<string, string>
	/** Artifacts from the just-completed run result (for input_artifacts matching). */
	runArtifacts: RunArtifact[]
}

export interface ScriptActionResult {
	/** Artifacts to append to the run completion. */
	artifacts: RunArtifact[]
	/** Outputs to merge into the run completion. Collision = hard failure. */
	outputs: Record<string, string>
	/** Optional summary override from the script. */
	summary?: string
}

// ─── Runner resolution ──────────────────────────────────────────────────────

const RUNNER_COMMANDS: Record<string, string> = {
	bun: 'bun',
	node: 'node',
	python3: 'python3',
	bash: 'bash',
}

function buildCommand(action: ScriptAction, scriptAbsPath: string): string[] {
	if (action.runner === 'exec') {
		return [scriptAbsPath, ...action.args]
	}
	const runner = RUNNER_COMMANDS[action.runner]
	if (!runner) {
		throw new Error(`Unknown runner: ${action.runner}`)
	}
	return [runner, scriptAbsPath, ...action.args]
}

// ─── Path safety ────────────────────────────────────────────────────────────

function resolveWorkspacePath(workspacePath: string, relPath: string): string {
	const abs = resolve(workspacePath, relPath)
	const root = resolve(workspacePath)
	if (!abs.startsWith(root + '/') && abs !== root) {
		throw new Error(`Path "${relPath}" escapes workspace root`)
	}
	return abs
}

// ─── Input artifact manifest ────────────────────────────────────────────────

function writeArtifactManifest(
	workspacePath: string,
	requestedTitles: string[],
	runArtifacts: RunArtifact[],
): string {
	const matched = runArtifacts.filter((a) => requestedTitles.includes(a.title))
	const manifestPath = join(workspacePath, '.autopilot-input-artifacts.json')
	writeFileSync(manifestPath, JSON.stringify(matched, null, 2))
	return manifestPath
}

// ─── Structured result parsing ──────────────────────────────────────────────

function parseStructuredResult(stdout: string): ScriptActionResult | null {
	const trimmed = stdout.trim()
	if (!trimmed.startsWith('{')) return null

	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch {
		// Not valid JSON — treat as plain text logging
		return null
	}

	const result = ScriptResultSchema.safeParse(parsed)
	if (!result.success) return null

	const { summary, artifacts = [], outputs = {} } = result.data
	return { summary, artifacts, outputs }
}

// ─── Execute ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 300_000 // 5 minutes

export async function executeScriptAction(
	action: ScriptAction,
	ctx: ScriptActionContext,
	emitEvent: (event: WorkerEvent) => void,
): Promise<ScriptActionResult> {
	// Resolve script path within workspace
	const scriptPath = resolveWorkspacePath(ctx.workspacePath, action.script)
	const cwd = action.cwd
		? resolveWorkspacePath(ctx.workspacePath, action.cwd)
		: ctx.workspacePath

	// Build process env: inherit nothing extra, only explicit allowlist
	const processEnv: Record<string, string> = {
		// Minimal safe defaults
		PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
		HOME: process.env.HOME ?? '/tmp',
	}

	// Static env
	if (action.env) {
		Object.assign(processEnv, action.env)
	}

	// Secret env — resolve named secrets from run context
	if (action.secret_env) {
		for (const [envVar, secretName] of Object.entries(action.secret_env)) {
			const value = ctx.secrets.get(secretName)
			if (value === undefined) {
				throw new Error(`Secret "${secretName}" for env var "${envVar}" not resolved`)
			}
			processEnv[envVar] = value
		}
	}

	// Input artifact manifest
	if (action.input_artifacts && action.input_artifacts.length > 0) {
		const manifestPath = writeArtifactManifest(
			ctx.workspacePath,
			action.input_artifacts,
			ctx.runArtifacts,
		)
		processEnv['AUTOPILOT_INPUT_ARTIFACTS_JSON'] = manifestPath
	}

	const command = buildCommand(action, scriptPath)
	const timeout = action.timeout_ms ?? DEFAULT_TIMEOUT_MS

	emitEvent({
		type: 'external_action',
		summary: `Script ${action.runner} ${action.script} starting`,
		metadata: {
			action_kind: 'script',
			script: action.script,
			runner: action.runner,
		},
	})

	const proc = Bun.spawn(command, {
		cwd,
		env: processEnv,
		stdout: 'pipe',
		stderr: 'pipe',
	})

	// Race: process completion vs timeout
	const timeoutSignal = new Promise<'timeout'>((resolve) =>
		setTimeout(() => resolve('timeout'), timeout),
	)
	const completion = (async () => {
		const [outText, errText] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		])
		const exitCode = await proc.exited
		return { stdout: outText, stderr: errText, exitCode } as const
	})()

	const outcome = await Promise.race([completion, timeoutSignal])

	if (outcome === 'timeout') {
		proc.kill()
		await proc.exited
		throw new Error(`Script timed out after ${timeout}ms`)
	}

	const { stdout, stderr, exitCode } = outcome

	if (exitCode !== 0) {
		const detail = stderr.trim() ? `\n${stderr.trim().slice(0, 2000)}` : ''
		throw new Error(`Script exited with code ${exitCode}${detail}`)
	}

	// Try structured result
	const structured = parseStructuredResult(stdout)
	if (structured) {
		return structured
	}

	// Plain text — log only, no merge
	if (stdout.trim()) {
		emitEvent({
			type: 'external_action',
			summary: `Script output: ${stdout.trim().slice(0, 500)}`,
			metadata: { action_kind: 'script', script: action.script },
		})
	}

	return { artifacts: [], outputs: {} }
}
