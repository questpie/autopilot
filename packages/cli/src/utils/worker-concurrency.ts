import { loadCompany } from '@questpie/autopilot-orchestrator'

export const DEFAULT_LOCAL_WORKER_CONCURRENCY = 4

export async function resolveWorkerConcurrency(
	companyRoot: string,
	override?: string,
): Promise<number> {
	if (override !== undefined) {
		const parsed = Number.parseInt(override, 10)
		if (Number.isNaN(parsed) || parsed < 1) {
			throw new Error(`Invalid concurrency value: ${override} — must be a positive integer`)
		}
		return parsed
	}

	const company = await loadCompany(companyRoot)
	return company.settings?.max_concurrent_agents ?? DEFAULT_LOCAL_WORKER_CONCURRENCY
}
