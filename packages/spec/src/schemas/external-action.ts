import { z } from 'zod'

/** A side-effecting external action executed by the worker after a run step. */
export const ExternalActionSchema = z.object({
	kind: z.literal('webhook'),
	/** Secret ref name whose resolved value is the URL. */
	url_ref: z.string().min(1),
	method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
	/** Secret ref name for headers JSON. */
	headers_ref: z.string().optional(),
	/** Static body template. */
	body: z.string().optional(),
	/** Idempotency key to prevent duplicate executions. */
	idempotency_key: z.string().optional(),
	/** Environment to resolve secret refs from. */
	environment: z.string().optional(),
})
