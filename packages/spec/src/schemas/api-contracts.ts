import { z } from 'zod'

// ─── Worker Registration ────────────────────────────────────────────────────

export const WorkerRegisterRequestSchema = z.object({
	id: z.string().min(1),
	device_id: z.string().optional(),
	name: z.string().optional(),
	capabilities: z
		.array(
			z.object({
				runtime: z.string(),
				models: z.array(z.string()).default([]),
				maxConcurrent: z.number().int().default(1),
			}),
		)
		.default([]),
})

export const WorkerRegisterResponseSchema = z.object({
	workerId: z.string(),
	status: z.string(),
})

// ─── Worker Heartbeat ───────────────────────────────────────────────────────

export const WorkerHeartbeatRequestSchema = z.object({
	worker_id: z.string().min(1),
})

// ─── Worker Claim ───────────────────────────────────────────────────────────

export const WorkerClaimRequestSchema = z.object({
	worker_id: z.string().min(1),
	runtime: z.string().optional(),
})

/** What the worker gets back when it successfully claims a run. */
export const ClaimedRunSchema = z.object({
	id: z.string(),
	agent_id: z.string(),
	task_id: z.string().nullable(),
	runtime: z.string(),
	status: z.string(),
	// Execution context the worker needs
	task_title: z.string().nullable().optional(),
	task_description: z.string().nullable().optional(),
	instructions: z.string().nullable().optional(),
})

export const WorkerClaimResponseSchema = z.object({
	run: ClaimedRunSchema.nullable(),
	lease_id: z.string().nullable(),
})

// ─── Worker Deregister ──────────────────────────────────────────────────────

export const WorkerDeregisterRequestSchema = z.object({
	worker_id: z.string().min(1),
})

// ─── Run Event POST ─────────────────────────────────────────────────────────
// Uses WorkerEventSchema from worker-event.ts

// ─── Run Completion POST ────────────────────────────────────────────────────
// Uses RunCompletionSchema from worker-event.ts

// ─── Run Creation ───────────────────────────────────────────────────────────

export const CreateRunRequestSchema = z.object({
	agent_id: z.string().min(1),
	task_id: z.string().optional(),
	runtime: z.string().min(1).default('claude-code'),
	initiated_by: z.string().optional(),
	instructions: z.string().optional(),
})
