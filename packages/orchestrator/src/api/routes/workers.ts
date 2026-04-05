import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import {
	WorkerRegisterRequestSchema,
	WorkerHeartbeatRequestSchema,
	WorkerClaimRequestSchema,
	WorkerDeregisterRequestSchema,
	ExternalActionSchema,
	SecretRefSchema,
} from '@questpie/autopilot-spec'
import type { ExternalAction, SecretRef } from '@questpie/autopilot-spec'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

/**
 * Get the authoritative worker ID for this request.
 * If machine auth resolved a workerId, that is authoritative.
 * In local dev bypass (workerId=null), fall back to body value.
 */
function getAuthoritativeWorkerId(
	authWorkerId: string | null,
	bodyWorkerId: string,
): { workerId: string; mismatch: boolean } {
	if (authWorkerId === null) {
		// Local dev bypass — trust body
		return { workerId: bodyWorkerId, mismatch: false }
	}
	return {
		workerId: authWorkerId,
		mismatch: bodyWorkerId !== authWorkerId && bodyWorkerId !== '',
	}
}

const workers = new Hono<AppEnv>()
	// GET /workers — list all workers
	.get('/', async (c) => {
		const { workerService } = c.get('services')
		const result = await workerService.list()
		return c.json(result, 200)
	})
	// POST /workers/register — register a worker
	.post('/register', zValidator('json', WorkerRegisterRequestSchema), async (c) => {
		const { workerService } = c.get('services')
		const authWorkerId = c.get('workerId')
		const body = c.req.valid('json')

		const { workerId, mismatch } = getAuthoritativeWorkerId(authWorkerId, body.id)
		if (mismatch) {
			return c.json({ error: `Authenticated as ${authWorkerId} but body.id is ${body.id}` }, 403)
		}

		const worker = await workerService.register({
			...body,
			id: workerId,
			capabilities: JSON.stringify(body.capabilities),
		})
		if (!worker) return c.json({ error: 'failed to register worker' }, 500)

		eventBus.emit({ type: 'worker_registered', workerId })

		return c.json({ workerId: worker.id, status: worker.status }, 201)
	})
	// POST /workers/heartbeat — worker heartbeat
	.post('/heartbeat', zValidator('json', WorkerHeartbeatRequestSchema), async (c) => {
		const { workerService } = c.get('services')
		const authWorkerId = c.get('workerId')
		const body = c.req.valid('json')

		const { workerId, mismatch } = getAuthoritativeWorkerId(authWorkerId, body.worker_id)
		if (mismatch) {
			return c.json({ error: `Authenticated as ${authWorkerId} but body.worker_id is ${body.worker_id}` }, 403)
		}

		await workerService.heartbeat(workerId)
		return c.json({ ok: true as const }, 200)
	})
	// POST /workers/claim — claim next pending run (one-at-a-time)
	.post('/claim', zValidator('json', WorkerClaimRequestSchema), async (c) => {
		const { runService, workerService, taskService, workflowEngine } = c.get('services')
		const authWorkerId = c.get('workerId')
		const body = c.req.valid('json')

		const { workerId, mismatch } = getAuthoritativeWorkerId(authWorkerId, body.worker_id)
		if (mismatch) {
			return c.json({ error: `Authenticated as ${authWorkerId} but body.worker_id is ${body.worker_id}` }, 403)
		}

		// Expire stale leases — prevents crashed workers from being stuck forever
		await workerService.expireStaleAndRecover(async (runId) => {
			const run = await runService.get(runId)
			await runService.complete(runId, { status: 'failed', error: 'lease expired' })
			if (run?.task_id) {
				await workflowEngine.handleRunFailure(run.task_id, runId)
			}
		})

		// Concurrency guard: one active run per worker
		const activeLease = await workerService.getActiveLeaseForWorker(workerId)
		if (activeLease) {
			return c.json({ run: null, lease_id: null }, 200)
		}

		// Look up worker capabilities for targeting-aware claim
		const workerRecord = await workerService.get(workerId)
		const workerCaps = workerRecord?.capabilities
			? JSON.parse(workerRecord.capabilities)
			: []

		const run = await runService.claim(workerId, body.runtime, workerCaps)
		if (!run) return c.json({ run: null, lease_id: null }, 200)

		// Create a lease for the claimed run
		const leaseId = `lease-${Date.now()}-${randomBytes(6).toString('hex')}`
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
		await workerService.createLease({
			id: leaseId,
			worker_id: workerId,
			run_id: run.id,
			expires_at: expiresAt,
		})
		await workerService.setBusy(workerId)

		// Look up task context if task_id exists
		let taskTitle: string | null = null
		let taskDescription: string | null = null
		if (run.task_id) {
			const task = await taskService.get(run.task_id)
			if (task) {
				taskTitle = task.title
				taskDescription = task.description ?? null
			}
		}

		// Resolve agent identity from authored config
		const config = c.get('authoredConfig')
		const agent = config.agents.get(run.agent_id)
		const agentName = agent?.name ?? null
		const agentRole = agent?.role ?? null

		// Split targeting blob into constraints vs post-run hooks
		const { constraints, actions, secretRefs } = splitTargeting(run.targeting)

		// Resolve shared secret refs for worker delivery.
		// Workers receive only 'worker' scoped secrets.
		// 'provider' and 'orchestrator_only' scoped secrets stay orchestrator-side.
		const { secretService } = c.get('services')
		const sharedRefNames = secretRefs
			.filter((r) => r.source === 'shared')
			.map((r) => r.name)
		const resolvedSharedSecrets = sharedRefNames.length > 0
			? Object.fromEntries(
				await secretService.resolveForScopes(sharedRefNames, ['worker']),
			)
			: {}

		return c.json(
			{
				run: {
					id: run.id,
					agent_id: run.agent_id,
					task_id: run.task_id,
					runtime: run.runtime,
					status: run.status,
					task_title: taskTitle,
					task_description: taskDescription,
					agent_name: agentName,
					agent_role: agentRole,
					instructions: run.instructions ?? null,
					runtime_session_ref: run.runtime_session_ref ?? null,
					resumed_from_run_id: run.resumed_from_run_id ?? null,
					targeting: constraints,
					actions,
					secret_refs: secretRefs,
					resolved_shared_secrets: resolvedSharedSecrets,
				},
				lease_id: leaseId,
			},
			200,
		)
	})
	// POST /workers/deregister — deregister a worker
	.post('/deregister', zValidator('json', WorkerDeregisterRequestSchema), async (c) => {
		const { workerService } = c.get('services')
		const authWorkerId = c.get('workerId')
		const body = c.req.valid('json')

		const { workerId, mismatch } = getAuthoritativeWorkerId(authWorkerId, body.worker_id)
		if (mismatch) {
			return c.json({ error: `Authenticated as ${authWorkerId} but body.worker_id is ${body.worker_id}` }, 403)
		}

		await workerService.setOffline(workerId)

		eventBus.emit({ type: 'worker_offline', workerId })

		return c.json({ ok: true as const }, 200)
	})

export { workers }

// ─── Helpers ──────────────────────────────────────────────────────────────

const TargetingBlobSchema = z.object({
	actions: z.array(ExternalActionSchema).default([]),
	secret_refs: z.array(SecretRefSchema).default([]),
}).passthrough()

/**
 * Split the JSON-serialized targeting blob into execution constraints
 * (what the claiming logic uses) and post-run hooks (what the worker executes after).
 */
function splitTargeting(raw: string | null | undefined): {
	constraints: Record<string, unknown> | null
	actions: ExternalAction[]
	secretRefs: SecretRef[]
} {
	if (!raw) return { constraints: null, actions: [], secretRefs: [] }

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return { constraints: null, actions: [], secretRefs: [] }
	}

	const result = TargetingBlobSchema.safeParse(parsed)
	if (!result.success) {
		return { constraints: parsed as Record<string, unknown>, actions: [], secretRefs: [] }
	}

	const { actions, secret_refs, ...rest } = result.data
	const hasConstraints = Object.keys(rest).some((k) => rest[k] !== undefined)

	return {
		constraints: hasConstraints ? rest : null,
		actions,
		secretRefs: secret_refs,
	}
}
