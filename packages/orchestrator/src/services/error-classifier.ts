import type { RetryErrorType } from '@questpie/autopilot-spec'

/**
 * Pattern-based classification of run errors into retry-relevant categories.
 *
 * Conservative: unknown errors are NOT retried by default.
 * Only infra and timeout are retried unless explicitly configured.
 */

const INFRA_PATTERNS = [
	/lease expired/i,
	/worker offline/i,
	/worktree missing/i,
	/server restart/i,
	/connection refused/i,
	/econnrefused/i,
	/econnreset/i,
	/socket hang up/i,
	/worker deregistered/i,
	/process exited/i,
	/signal \d+/i,
	/spawn error/i,
]

const TIMEOUT_PATTERNS = [
	/max turns/i,
	/timed out/i,
	/timeout/i,
	/exceeded.*time/i,
	/deadline exceeded/i,
]

const RATE_LIMIT_PATTERNS = [
	/\b429\b/,
	/rate limit/i,
	/too many requests/i,
	/throttled/i,
]

const BUSINESS_PATTERNS = [
	/can'?t do this/i,
	/cannot complete/i,
	/refused to/i,
	/rejected/i,
	/validation failed/i,
	/not supported/i,
	/not possible/i,
]

export function classifyRunError(error: string | null | undefined): RetryErrorType {
	if (!error) return 'unknown'

	for (const pattern of INFRA_PATTERNS) {
		if (pattern.test(error)) return 'infra'
	}

	for (const pattern of TIMEOUT_PATTERNS) {
		if (pattern.test(error)) return 'timeout'
	}

	for (const pattern of RATE_LIMIT_PATTERNS) {
		if (pattern.test(error)) return 'rate_limit'
	}

	for (const pattern of BUSINESS_PATTERNS) {
		if (pattern.test(error)) return 'business'
	}

	return 'unknown'
}
