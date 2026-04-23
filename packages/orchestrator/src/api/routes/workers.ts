import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
	ExternalActionSchema,
	ResolvedCapabilitiesSchema,
	SecretRefSchema,
	WorkerClaimRequestSchema,
	WorkerDeregisterRequestSchema,
	WorkerHeartbeatRequestSchema,
	WorkerRegisterRequestSchema,
} from '@questpie/autopilot-spec'
import type {
	ExternalAction,
	ResolvedCapabilities,
	SecretRef,
	StandaloneScript,
} from '@questpie/autopilot-spec'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { eventBus } from '../../events/event-bus'
import type { AppEnv } from '../app'

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

interface TaskContext {
	taskTitle: string | null
	taskDescription: string | null
	parentBranch: string | null
	workspaceMode: 'none' | 'isolated_worktree' | null
}

const NULL_TASK_CONTEXT: TaskContext = {
	taskTitle: null,
	taskDescription: null,
	parentBranch: null,
	workspaceMode: null,
}

async function resolveTaskContext(c: Context<AppEnv>, taskId: string | null): Promise<TaskContext> {
	if (!taskId) return NULL_TASK_CONTEXT

	const { taskService, taskGraphService } = c.get('services')
	const config = c.get('authoredConfig')

	const task = await taskService.get(taskId)

	let workspaceMode: TaskContext['workspaceMode'] = null
	if (task?.workflow_id) {
		workspaceMode = config.workflows.get(task.workflow_id)?.workspace?.mode ?? null
	}

	let parentBranch: string | null = null
	if (taskGraphService) {
		const parents = await taskGraphService.listParents(taskId)
		if (parents.length > 0) {
			const safeId = parents[0]!.id.replace(/[^a-zA-Z0-9_-]/g, '_')
			parentBranch = `autopilot/${safeId}`
		}
	}

	return {
		taskTitle: task?.title ?? null,
		taskDescription: task?.description ?? null,
		parentBranch,
		workspaceMode,
	}
}

async function resolveQueryWorkspaceMode(
	c: Context<AppEnv>,
	runId: string,
): Promise<'none' | null> {
	const { queryService } = c.get('services')
	const query = await queryService.getByRunIdAnyStatus(runId)
	return query?.allow_repo_mutation ? 'none' : null
}

async function resolveRunContext(
	c: Context<AppEnv>,
	run: { id: string; task_id: string | null },
): Promise<TaskContext> {
	if (run.task_id) {
		return resolveTaskContext(c, run.task_id)
	}
	return {
		...NULL_TASK_CONTEXT,
		workspaceMode: await resolveQueryWorkspaceMode(c, run.id),
	}
}

function runRequiresSharedCheckout(
	run: { task_id: string | null },
	opts: {
		sharedCheckoutEnabled: boolean
		sharedCheckoutLocked: boolean
		worktreeIsolationAvailable: boolean
		workspaceMode: 'none' | 'isolated_worktree' | null
	},
): boolean {
	if (!opts.sharedCheckoutEnabled || !opts.sharedCheckoutLocked) return false
	if (!run.task_id) return true
	if (!opts.worktreeIsolationAvailable) return true
	return opts.workspaceMode === 'none'
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
			return c.json(
				{ error: `Authenticated as ${authWorkerId} but body.worker_id is ${body.worker_id}` },
				403,
			)
		}

		await workerService.heartbeat(workerId)
		return c.json({ ok: true as const }, 200)
	})
	// POST /workers/claim — claim next pending run (one-at-a-time)
	.post('/claim', zValidator('json', WorkerClaimRequestSchema), async (c) => {
		const { runService, workerService, workflowEngine } = c.get('services')
		const authWorkerId = c.get('workerId')
		const body = c.req.valid('json')

		const { workerId, mismatch } = getAuthoritativeWorkerId(authWorkerId, body.worker_id)
		if (mismatch) {
			return c.json(
				{ error: `Authenticated as ${authWorkerId} but body.worker_id is ${body.worker_id}` },
				403,
			)
		}

		// Expire stale leases — prevents crashed workers from being stuck forever
		await workerService.expireStaleAndRecover(async (runId) => {
			const run = await runService.get(runId)
			await runService.complete(runId, { status: 'failed', error: 'lease expired' })
			if (run?.task_id) {
				await workflowEngine.handleRunFailure(run.task_id, runId)
			}
		})

		// Use worker capabilities for targeting-aware claim
		const workerRecord = await workerService.get(workerId)
		const workerCaps = workerRecord?.capabilities ? JSON.parse(workerRecord.capabilities) : []
		const sharedCheckoutLocked = body.shared_checkout_locked === true
		const sharedCheckoutEnabled = body.shared_checkout_enabled === true
		const worktreeIsolationAvailable = body.worktree_isolation_available === true
		const skippedRunIds = new Set<string>()

		let run = await runService.claim(workerId, body.runtime, workerCaps)
		let taskContext = run ? await resolveRunContext(c, run) : NULL_TASK_CONTEXT

		while (
			run &&
			runRequiresSharedCheckout(run, {
				sharedCheckoutEnabled,
				sharedCheckoutLocked,
				worktreeIsolationAvailable,
				workspaceMode: taskContext.workspaceMode,
			})
		) {
			await runService.releaseClaim(run.id)
			skippedRunIds.add(run.id)
			run = await runService.claim(workerId, body.runtime, workerCaps, {
				excludeRunIds: [...skippedRunIds],
			})
			taskContext = run ? await resolveRunContext(c, run) : NULL_TASK_CONTEXT
		}

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

		const { taskTitle, taskDescription, parentBranch, workspaceMode } = taskContext

		// Resolve agent identity from authored config
		const config = c.get('authoredConfig')
		const agent = config.agents.get(run.agent_id)
		const agentName = agent?.name ?? null
		const agentRole = agent?.role ?? null

		// Split targeting blob into constraints vs post-run hooks
		const { constraints, actions, secretRefs, resolvedCapabilities } = splitTargeting(run.targeting)
		const { scriptService } = c.get('services')
		const resolvedScripts = resolveStandaloneScripts(actions, scriptService)

		// ─── Context assembly ──────────────────────────────────────────
		// 1. Resolve injected context: capability_profiles.context names → actual content
		const contextMap = config.context ?? new Map<string, string>()
		const injectedContext: Record<string, string> = {}
		if (resolvedCapabilities?.context) {
			for (const name of resolvedCapabilities.context) {
				const content = contextMap.get(name)
				if (content) {
					injectedContext[name] = content
				} else {
					console.warn(
						`[workers/claim] context "${name}" referenced by capability profile but not found in .autopilot/context/`,
					)
				}
			}
		}

		// 2. Resolve context hints from company config
		const companyRoot = c.get('companyRoot')
		const companyHintsConfig = config.company.context_hints ?? {}
		const contextHints: Array<{
			type: string
			path: string
			description?: string
			files?: string[]
		}> = []
		for (const [hintType, relativePath] of Object.entries(companyHintsConfig)) {
			const absPath = resolve(companyRoot, relativePath)
			let files: string[] | undefined
			if (existsSync(absPath)) {
				try {
					const entries = await readdir(absPath)
					files = entries.filter((e) => !e.startsWith('.')).slice(0, 20)
				} catch (err) {
					console.warn(
						`[workers/claim] cannot read context hint dir "${absPath}":`,
						err instanceof Error ? err.message : String(err),
					)
				}
			}
			contextHints.push({
				type: hintType,
				path: absPath,
				files,
			})
		}

		// Resolve shared secret refs for worker delivery.
		// Workers receive only 'worker' scoped secrets.
		// 'provider' and 'orchestrator_only' scoped secrets stay orchestrator-side.
		const { secretService } = c.get('services')
		const sharedRefNames = secretRefs.filter((r) => r.source === 'shared').map((r) => r.name)
		const resolvedSharedSecrets =
			sharedRefNames.length > 0
				? Object.fromEntries(await secretService.resolveForScopes(sharedRefNames, ['worker']))
				: {}

		return c.json(
			{
				run: {
					id: run.id,
					agent_id: run.agent_id,
					task_id: run.task_id,
					project_id: run.project_id ?? null,
					runtime: run.runtime,
					model: run.model ?? null,
					provider: run.provider ?? null,
					variant: run.variant ?? null,
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
					resolved_scripts: resolvedScripts,
					resolved_shared_secrets: resolvedSharedSecrets,
					resolved_capabilities: resolvedCapabilities,
					workspace_mode: workspaceMode,
					parent_branch: parentBranch,
					injected_context: Object.keys(injectedContext).length > 0 ? injectedContext : undefined,
					context_hints: contextHints.length > 0 ? contextHints : undefined,
				},
				lease_id: leaseId,
			},
			200,
		)
	})
	// POST /workers/deregister — deregister a worker
	.post('/deregister', zValidator('json', WorkerDeregisterRequestSchema), async (c) => {
		const { workerService, runService, workflowEngine } = c.get('services')
		const authWorkerId = c.get('workerId')
		const body = c.req.valid('json')

		const { workerId, mismatch } = getAuthoritativeWorkerId(authWorkerId, body.worker_id)
		if (mismatch) {
			return c.json(
				{ error: `Authenticated as ${authWorkerId} but body.worker_id is ${body.worker_id}` },
				403,
			)
		}

		// Release all active leases for this worker — fail the associated runs
		// so they can be retried/rescheduled rather than waiting for lease expiry.
		const activeLeases = await workerService.getActiveLeasesForWorker(workerId)
		for (const lease of activeLeases) {
			await workerService.completeLease(lease.id, 'failed')
			await runService.complete(lease.run_id, {
				status: 'failed',
				error: 'worker deregistered',
			})
			const run = await runService.get(lease.run_id)
			if (run?.task_id) {
				await workflowEngine.handleRunFailure(run.task_id, lease.run_id)
			}
		}

		await workerService.setOffline(workerId)

		eventBus.emit({ type: 'worker_offline', workerId })

		return c.json({ ok: true as const }, 200)
	})

export { workers }

// ─── Helpers ──────────────────────────────────────────────────────────────

const TargetingBlobSchema = z
	.object({
		actions: z.array(ExternalActionSchema).default([]),
		secret_refs: z.array(SecretRefSchema).default([]),
		resolved_capabilities: ResolvedCapabilitiesSchema.optional(),
	})
	.passthrough()

/**
 * Split the JSON-serialized targeting blob into execution constraints
 * (what the claiming logic uses), post-run hooks, and capability intent.
 */
interface SplitTargetingResult {
	constraints: Record<string, unknown> | null
	actions: ExternalAction[]
	secretRefs: SecretRef[]
	resolvedCapabilities: ResolvedCapabilities | undefined
}

const EMPTY_TARGETING: SplitTargetingResult = {
	constraints: null,
	actions: [],
	secretRefs: [],
	resolvedCapabilities: undefined,
}

function resolveStandaloneScripts(
	actions: ExternalAction[],
	scriptService: { resolveRef(scriptId: string): StandaloneScript | undefined },
): StandaloneScript[] {
	const resolved = new Map<string, StandaloneScript>()
	for (const action of actions) {
		if (action.kind !== 'script_ref') continue
		const script = scriptService.resolveRef(action.script_id)
		if (!script) {
			console.warn(`[workers/claim] script_ref "${action.script_id}" not found in authored scripts`)
			continue
		}
		resolved.set(script.id, script)
	}
	return [...resolved.values()]
}

function splitTargeting(raw: string | null | undefined): SplitTargetingResult {
	if (!raw) return EMPTY_TARGETING

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (err) {
		console.warn(
			'[workers/claim] malformed targeting JSON — treating as empty:',
			err instanceof Error ? err.message : String(err),
		)
		return EMPTY_TARGETING
	}

	const result = TargetingBlobSchema.safeParse(parsed)
	if (!result.success) {
		// Valid JSON but not matching schema — pass through as opaque constraints
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			return { ...EMPTY_TARGETING, constraints: Object.fromEntries(Object.entries(parsed)) }
		}
		return EMPTY_TARGETING
	}

	const { actions, secret_refs, resolved_capabilities, ...rest } = result.data
	const hasConstraints = Object.keys(rest).some((k) => rest[k] !== undefined)

	return {
		constraints: hasConstraints ? rest : null,
		actions,
		secretRefs: secret_refs,
		resolvedCapabilities: resolved_capabilities,
	}
}
