import { z } from 'zod'

// ─── Query Request ────────────────────────────────────────────────────────

/**
 * Input contract for a non-task assistant query.
 *
 * A query is operator-assistant work that does NOT require task creation.
 * It can inspect repo + operational state, brainstorm, draft, and optionally
 * mutate repo/company config when explicitly allowed.
 */
export const QueryRequestSchema = z.object({
	/** The operator's prompt / question. */
	prompt: z.string().min(1),

	/** Agent to handle the query. Falls back to company default if omitted. */
	agent_id: z.string().optional(),

	/**
	 * When true, the query may directly edit repo/company files on the worker filesystem.
	 * When false (default), the query may only inspect/draft without changing files.
	 */
	allow_repo_mutation: z.boolean().default(false),

	// ─── Thin continuity (foundation for Pass 24.9) ──────────────────

	/** Continue from a prior query. Provides carryover context. */
	continue_from: z.string().optional(),

	// ─── Runtime hints ───────────────────────────────────────────────

	/** Explicit runtime override (e.g. 'claude-code'). Uses company default if omitted. */
	runtime: z.string().optional(),
})

// ─── Query Result ─────────────────────────────────────────────────────────

/**
 * V1 result contract for a completed query.
 *
 * This is the real surface — matches what GET /api/queries/:id returns.
 * Artifacts and changed_files are derived from the associated run's artifacts
 * (not stored separately on the query row).
 */
export const QueryResultSchema = z.object({
	/** Unique query identifier. */
	query_id: z.string(),

	/** Text summary of the query result. */
	summary: z.string().nullable(),

	/** Whether the query actually mutated repo/company files (detected from changed_file artifacts). */
	mutated_repo: z.boolean(),

	/** Status of the query. */
	status: z.enum(['pending', 'running', 'completed', 'failed']),

	/** Associated run ID (for inspection — use GET /runs/:id/artifacts for full artifact list). */
	run_id: z.string().nullable(),

	/** Error message if failed. */
	error: z.string().nullable().optional(),

	// ─── Thin continuity ─────────────────────────────────────────────
	/** Prior query this continues from. */
	continue_from: z.string().nullable(),
})

// ─── Query Row (DB persistence shape) ─────────────────────────────────────

/**
 * Minimal persistence record for query invocations.
 * Not a full session — just enough to inspect, continue, and audit.
 */
export const QueryRowSchema = z.object({
	id: z.string(),
	prompt: z.string(),
	agent_id: z.string(),
	run_id: z.string().nullable(),
	status: z.enum(['pending', 'running', 'completed', 'failed']),
	allow_repo_mutation: z.boolean(),
	mutated_repo: z.boolean(),
	summary: z.string().nullable(),

	// ─── Thin continuity ─────────────────────────────────────────────
	/** ID of the prior query this continues from. */
	continue_from: z.string().nullable(),
	/** Short derived summary from the prior query (for context carryover). */
	carryover_summary: z.string().nullable(),
	/** Runtime session handle for optional adapter-level resume. */
	runtime_session_ref: z.string().nullable(),

	created_by: z.string(),
	created_at: z.string(),
	ended_at: z.string().nullable(),
	metadata: z.string(),
})
