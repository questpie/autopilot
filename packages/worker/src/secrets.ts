/**
 * Secret resolution — resolves SecretRef definitions to actual values locally on the worker.
 * Values never leave the machine. The orchestrator only stores ref metadata.
 */

import { readFileSync } from 'node:fs'
import type { SecretRef } from '@questpie/autopilot-spec'

export interface SecretResolutionResult {
	resolved: Map<string, string>
	errors: string[]
}

/**
 * Resolve a list of SecretRef definitions to their actual values.
 * Runs locally on the worker — values never leave the machine.
 */
export function resolveSecretRefs(refs: SecretRef[]): SecretResolutionResult {
	const resolved = new Map<string, string>()
	const errors: string[] = []

	for (const ref of refs) {
		try {
			resolved.set(ref.name, resolveOne(ref))
		} catch (err) {
			errors.push(
				`Secret "${ref.name}" (${ref.source}:${ref.key}): ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}

	return { resolved, errors }
}

function resolveOne(ref: SecretRef): string {
	switch (ref.source) {
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
		default: {
			const _exhaustive: never = ref.source
			throw new Error(`Unknown source type: ${_exhaustive}`)
		}
	}
}

/** Validate that all required secret refs can be resolved. Returns error list. */
export function validateSecretRefs(refs: SecretRef[]): string[] {
	return resolveSecretRefs(refs).errors
}
