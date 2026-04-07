/**
 * Handler runtime — executes provider Bun handler scripts.
 *
 * Contract:
 * - Handler receives a JSON envelope on stdin
 * - Handler writes a JSON result to stdout
 * - Handler exits 0 on success, non-zero on crash
 * - Timeout: 30s default
 */
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { HandlerResultSchema } from '@questpie/autopilot-spec'
import type { HandlerEnvelope, HandlerResult, Provider, SecretRef } from '@questpie/autopilot-spec'
import type { SecretService } from '../services/secrets'

export interface HandlerRuntimeConfig {
	/** Company root — handler paths are resolved relative to .autopilot/ */
	companyRoot: string
	/** Timeout in ms (default 30_000). */
	timeout?: number
}

/**
 * Resolve secret refs on the orchestrator host.
 *
 * Local refs (env/file/exec) are resolved on the host machine.
 * Shared refs are resolved from the orchestrator's encrypted secret store.
 * Orchestrator can resolve all scopes (worker, provider, orchestrator_only).
 */
export async function resolveSecrets(
	refs: SecretRef[],
	secretService?: SecretService,
): Promise<Map<string, string>> {
	const resolved = new Map<string, string>()

	// Batch-resolve shared refs from the encrypted store
	const sharedNames = refs.filter((r) => r.source === 'shared').map((r) => r.name)
	if (sharedNames.length > 0 && !secretService) {
		throw new Error(
			`Cannot resolve shared secret refs [${sharedNames.join(', ')}]: SecretService not available`,
		)
	}
	const sharedValues = sharedNames.length > 0
		? await secretService!.resolveForScopes(sharedNames, ['provider', 'orchestrator_only'])
		: new Map<string, string>()

	for (const ref of refs) {
		switch (ref.source) {
			case 'shared': {
				const val = sharedValues.get(ref.name)
				if (val !== undefined) resolved.set(ref.name, val)
				break
			}
			case 'env': {
				const val = process.env[ref.key]
				if (val !== undefined) resolved.set(ref.name, val)
				break
			}
			case 'file': {
				try {
					const content = await Bun.file(ref.key).text()
					resolved.set(ref.name, content.trim())
				} catch {
					// skip unresolvable
				}
				break
			}
			case 'exec': {
				try {
					const proc = Bun.spawn(['sh', '-c', ref.key], {
						stdout: 'pipe',
						stderr: 'pipe',
					})
					const exitCode = await proc.exited
					if (exitCode === 0) {
						const out = await new Response(proc.stdout).text()
						resolved.set(ref.name, out.trim())
					}
				} catch {
					// skip unresolvable
				}
				break
			}
		}
	}

	return resolved
}

/**
 * Execute a provider handler with a typed envelope.
 * Returns a typed HandlerResult or an error result on failure.
 */
export async function executeHandler(
	provider: Provider,
	envelope: HandlerEnvelope,
	config: HandlerRuntimeConfig,
): Promise<HandlerResult> {
	const handlersDir = resolve(config.companyRoot, '.autopilot', 'handlers')
	const handlerPath = resolve(config.companyRoot, '.autopilot', provider.handler)

	// Defense-in-depth: ensure handler resolves inside .autopilot/handlers/
	if (!handlerPath.startsWith(handlersDir)) {
		return {
			ok: false,
			error: `Handler path escapes handlers directory: ${provider.handler}`,
		}
	}

	if (!existsSync(handlerPath)) {
		return {
			ok: false,
			error: `Handler not found: ${handlerPath}`,
		}
	}

	const timeout = config.timeout ?? 30_000
	const input = JSON.stringify(envelope)

	try {
		const proc = Bun.spawn(['bun', 'run', handlerPath], {
			stdin: 'pipe',
			stdout: 'pipe',
			stderr: 'pipe',
			cwd: config.companyRoot,
		})

		// Write envelope to stdin
		proc.stdin.write(input)
		proc.stdin.flush()
		proc.stdin.end()

		// Race between completion and timeout
		const exitCode = await Promise.race([
			proc.exited,
			new Promise<never>((_, reject) =>
				setTimeout(() => {
					proc.kill()
					reject(new Error(`Handler timed out after ${timeout}ms`))
				}, timeout),
			),
		])

		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text()
			return {
				ok: false,
				error: `Handler exited with code ${exitCode}: ${stderr.slice(0, 500)}`,
			}
		}

		const stdout = await new Response(proc.stdout).text()
		const parsed = HandlerResultSchema.safeParse(JSON.parse(stdout))

		if (!parsed.success) {
			return {
				ok: false,
				error: `Invalid handler output: ${parsed.error.message.slice(0, 300)}`,
			}
		}

		return parsed.data
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

/**
 * Build a full envelope and execute a handler for a provider.
 */
export async function invokeProvider(
	provider: Provider,
	op: string,
	payload: Record<string, unknown>,
	config: HandlerRuntimeConfig,
	secretService?: SecretService,
): Promise<HandlerResult> {
	const secrets = await resolveSecrets(provider.secret_refs, secretService)

	const envelope: HandlerEnvelope = {
		op,
		provider_id: provider.id,
		provider_kind: provider.kind,
		config: provider.config,
		secrets: Object.fromEntries(secrets),
		payload,
	}

	return executeHandler(provider, envelope, config)
}
