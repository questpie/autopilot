import { z } from 'zod'

/** Deployment modes for QUESTPIE Autopilot. */
export const DEPLOYMENT_MODES = ['selfhosted', 'cloud'] as const

export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number]

export const DeploymentModeSchema = z.enum(DEPLOYMENT_MODES).default('selfhosted')

/**
 * Resolve deployment mode from environment.
 *
 * Reads `DEPLOYMENT_MODE` env var, defaults to `'selfhosted'`.
 */
export function resolveDeploymentMode(): DeploymentMode {
	const raw = process.env.DEPLOYMENT_MODE
	const parsed = DeploymentModeSchema.safeParse(raw)
	return parsed.success ? parsed.data : 'selfhosted'
}
