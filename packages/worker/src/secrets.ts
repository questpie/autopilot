/**
 * Secret resolution — resolves SecretRef definitions to actual values on the worker.
 *
 * Local refs (env/file/exec) are resolved on the worker machine.
 * Shared refs are pre-resolved by the orchestrator and delivered in the claim payload.
 */

import { readFileSync } from 'node:fs'
import type { SecretRef } from '@questpie/autopilot-spec'

export interface SecretResolutionResult {
	resolved: Map<string, string>
	errors: string[]
}

/**
 * Resolve a list of SecretRef definitions to their actual values.
 *
 * Local refs (env/file/exec) are resolved on this machine.
 * Shared refs are looked up from the pre-resolved map delivered at claim time.
 *
 * @param refs - Secret refs from the claimed run
 * @param preResolved - Shared secret values delivered by the orchestrator (from resolved_shared_secrets)
 */
export function resolveSecretRefs(
	refs: SecretRef[],
	preResolved?: Record<string, string>,
): SecretResolutionResult {
	const resolved = new Map<string, string>()
	const errors: string[] = []

	for (const ref of refs) {
		try {
			resolved.set(ref.name, resolveOne(ref, preResolved))
		} catch (err) {
			const detail = ref.source === 'shared'
				? `(shared)`
				: `(${ref.source}:${ref.key})`
			errors.push(
				`Secret "${ref.name}" ${detail}: ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}

	return { resolved, errors }
}

function resolveOne(ref: SecretRef, preResolved?: Record<string, string>): string {
	switch (ref.source) {
		case 'shared': {
			const val = preResolved?.[ref.name]
			if (val === undefined) {
				throw new Error('Shared secret not delivered by orchestrator (missing or scope mismatch)')
			}
			return val
		}
		case 'env': {
			const val = process.env[ref.key]
			if (val === undefined) throw new Error(`Environment variable "${ref.key}" not set`)
			return val
		}
		case 'file':
			return readFileSync(ref.key, 'utf-8').trim()
		case 'exec': {
			const result = Bun.spawnSync(['sh', '-c', ref.key], {
				stdout: 'pipe',
				stderr: 'pipe',
				timeout: 10_000,
			})
			if (result.exitCode !== 0) {
				throw new Error(`Command failed (exit ${result.exitCode}): ${result.stderr.toString().trim()}`)
			}
			return result.stdout.toString().trim()
		}
	}
}

/** Validate that all required secret refs can be resolved. Returns error list. */
export function validateSecretRefs(
	refs: SecretRef[],
	preResolved?: Record<string, string>,
): string[] {
	return resolveSecretRefs(refs, preResolved).errors
}
