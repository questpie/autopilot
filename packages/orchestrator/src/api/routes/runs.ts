import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import {
	WorkerEventSchema,
	RunCompletionSchema,
	CreateRunRequestSchema,
	ContinueRunRequestSchema,
	RunSteerRequestSchema,
	ArtifactKindSchema,
} from '@questpie/autopilot-spec'
import type { ResolvedCapabilities, CapabilityProfile } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { eventBus } from '../../events/event-bus'

const runs = new Hono<AppEnv>()
	// GET /runs — list runs (optional status/agent/task filter)
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				status: z.string().optional(),
				agent_id: z.string().optional(),
				task_id: z.string().optional(),
			}),
		),
		async (c) => {
			const { runService } = c.get('services')
			const filter = c.req.valid('query')
			const result = await runService.list(filter)
			return c.json(result, 200)
		},
	)
	// GET /runs/:id — get run detail
	.get(
		'/:id',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { runService } = c.get('services')
			const { id } = c.req.valid('param')
			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)
			return c.json(run, 200)
		},
	)
	// GET /runs/:id/events — get run events
	.get(
		'/:id/events',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { runService } = c.get('services')
			const { id } = c.req.valid('param')
			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)
			const events = await runService.getEvents(id)
			return c.json(events, 200)
		},
	)
	// GET /runs/:id/artifacts — get run artifacts (metadata only, blob content not inlined)
	.get(
		'/:id/artifacts',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { artifactService } = c.get('services')
			const { id } = c.req.valid('param')
			const arts = await artifactService.listForRun(id)
			// Sanitize blob-backed rows: replace internal pointer with empty string
			const sanitized = arts.map((a) => (a.blob_id ? { ...a, ref_value: '' } : a))
			return c.json(sanitized, 200)
		},
	)
	// GET /runs/:id/artifacts/:artId/content — resolve and return artifact content
	.get(
		'/:id/artifacts/:artId/content',
		zValidator('param', z.object({ id: z.string(), artId: z.string() })),
		async (c) => {
			const { artifactService } = c.get('services')
			const { artId } = c.req.valid('param')
			const row = await artifactService.get(artId)
			if (!row) return c.json({ error: 'artifact not found' }, 404)
			const content = await artifactService.resolveContent(row)
			const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8')
			return new Response(bytes, {
				headers: {
					'Content-Type': row.mime_type || 'application/octet-stream',
					'Content-Length': String(bytes.length),
				},
			})
		},
	)
	// POST /runs — create a new pending run
	.post('/', zValidator('json', CreateRunRequestSchema), async (c) => {
		const { runService } = c.get('services')
		const actor = c.get('actor')
		const authoredConfig = c.get('authoredConfig')
		const body = c.req.valid('json')
		const id = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
		const { targeting, ...rest } = body

		// Resolve agent-level capability profiles into the targeting blob
		const agent = authoredConfig.agents.get(body.agent_id)
		const agentProfiles = agent?.capability_profiles ?? []
		const resolvedCaps = agentProfiles.length > 0
			? resolveAgentCapabilities(agentProfiles, authoredConfig.capabilityProfiles)
			: undefined

		let targetingJson: string | undefined
		if (targeting || resolvedCaps) {
			targetingJson = JSON.stringify({
				...targeting,
				...(resolvedCaps && { resolved_capabilities: resolvedCaps }),
			})
		}

		const run = await runService.create({
			id,
			...rest,
			initiated_by: body.initiated_by ?? actor?.id ?? 'system',
			targeting: targetingJson,
		})
		if (!run) return c.json({ error: 'failed to create run' }, 500)

		eventBus.emit({
			type: 'task_changed',
			taskId: body.task_id ?? id,
			status: 'pending',
		})

		return c.json(run, 201)
	})
	// POST /runs/:id/events — append event (from worker)
	.post(
		'/:id/events',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', WorkerEventSchema),
		async (c) => {
			const { runService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			// Verify authenticated worker owns this run
			const authWorkerId = c.get('workerId')
			if (authWorkerId && run.worker_id && run.worker_id !== authWorkerId) {
				return c.json({ error: `Run ${id} belongs to worker ${run.worker_id}, not ${authWorkerId}` }, 403)
			}

			// If first event is 'started', transition to running
			if (run.status === 'claimed' && body.type === 'started') {
				await runService.start(id)
			}

			await runService.appendEvent(id, {
				type: body.type,
				summary: body.summary,
				metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
			})

			eventBus.emit({
				type: 'run_event',
				runId: id,
				eventType: body.type,
				summary: body.summary,
			})

			return c.json({ ok: true as const }, 200)
		},
	)
	// POST /runs/:id/complete — complete run (from worker)
	.post(
		'/:id/complete',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', RunCompletionSchema),
		async (c) => {
			const { runService, workerService, workflowEngine, artifactService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			// Verify authenticated worker owns this run
			const authWorkerId = c.get('workerId')
			if (authWorkerId && run.worker_id && run.worker_id !== authWorkerId) {
				return c.json({ error: `Run ${id} belongs to worker ${run.worker_id}, not ${authWorkerId}` }, 403)
			}

			const result = await runService.complete(id, {
				status: body.status,
				summary: body.summary,
				tokens_input: body.tokens?.input,
				tokens_output: body.tokens?.output,
				error: body.error,
				runtime_session_ref: body.runtime_session_ref,
				resumable: body.resumable,
			})

			// Register artifacts reported by the worker
			const validArtifactKinds = new Set(ArtifactKindSchema.options)
			let hasPreviewFiles = false
			let previewEntry: string | null = null
			const previewFileTitles: string[] = []
			if (body.artifacts?.length) {
				for (const art of body.artifacts) {
					const normalizedKind = validArtifactKinds.has(art.kind) ? art.kind : 'other'
					const artMetadata = art.metadata ? { ...art.metadata } : {}
					if (normalizedKind !== art.kind) {
						artMetadata.original_kind = art.kind
						console.debug(`[runs] normalized unknown artifact kind "${art.kind}" to "other"`)
					}
					await artifactService.create({
						id: `art-${Date.now()}-${randomBytes(6).toString('hex')}`,
						run_id: id,
						task_id: run.task_id ?? undefined,
						kind: normalizedKind,
						title: art.title,
						ref_kind: art.ref_kind,
						ref_value: art.ref_value,
						mime_type: art.mime_type,
						metadata: Object.keys(artMetadata).length > 0 ? JSON.stringify(artMetadata) : undefined,
					})
					if (normalizedKind === 'preview_file') {
						hasPreviewFiles = true
						previewFileTitles.push(art.title)
						if (!previewEntry && art.title.endsWith('index.html')) {
							previewEntry = art.title
						}
					}
					// Explicit entry from preview_dir manifest takes priority
					if (normalizedKind === 'other' && artMetadata.original_kind === 'preview_dir') {
						const manifestEntry = artMetadata.preview_entry
						if (typeof manifestEntry === 'string' && manifestEntry) {
							previewEntry = manifestEntry
						}
					}
				}
			}

			// Auto-create preview_url artifact if preview files were stored
			if (hasPreviewFiles) {
				const singleHtmlEntry = previewFileTitles.length === 1
					&& /\.(html?)$/i.test(previewFileTitles[0] ?? '')
					? previewFileTitles[0]!
					: null
				const entry = previewEntry ?? singleHtmlEntry ?? 'index.html'
				// Canonical orchestrator URL for rendered links — not request-derived (reverse proxy / spoofing safe).
				// Relative-path fallback only when orchestratorUrl is absent (tests, custom embed).
				const baseUrl = c.get('orchestratorUrl')
				const previewUrl = baseUrl ? `${baseUrl}/api/previews/${id}/${entry}` : `/api/previews/${id}/${entry}`
				await artifactService.create({
					id: `art-preview-${Date.now()}-${randomBytes(6).toString('hex')}`,
					run_id: id,
					task_id: run.task_id ?? undefined,
					kind: 'preview_url',
					title: 'Preview',
					ref_kind: 'url',
					ref_value: previewUrl,
					mime_type: 'text/html',
					metadata: JSON.stringify({ entry, run_id: id }),
				})
			}

			// Release worker lease for this run + update worker status
			if (run.worker_id) {
				const lease = await workerService.getActiveLeaseForRun(run.worker_id, id)
				if (lease) {
					await workerService.completeLease(lease.id, body.status)
				}
				// Only set online if no remaining active leases
				const remainingLeases = await workerService.getActiveLeaseCountForWorker(run.worker_id)
				if (remainingLeases === 0) {
					await workerService.setOnline(run.worker_id)
				}
			}

			eventBus.emit({
				type: 'run_completed',
				runId: id,
				status: body.status,
			})

			// Query completion: if this run belongs to a query, update the query record
			const { queryService } = c.get('services')
			if (queryService) {
				const queryRow = await queryService.getByRunId(id)
				if (queryRow) {
					const hasMutation = body.artifacts?.some((a) => a.kind === 'changed_file') ?? false
					await queryService.complete(queryRow.id, {
						status: body.status,
						summary: body.summary,
						mutated_repo: hasMutation,
						runtime_session_ref: body.runtime_session_ref,
						error: body.error,
					})
				}
			}

			// Workflow progression: advance on success, mark failed on failure
			if (run.task_id) {
				if (body.status === 'completed') {
					await workflowEngine.advance(run.task_id, body.outputs, id)
				} else if (body.status === 'failed') {
					await workflowEngine.handleRunFailure(run.task_id, id)
				}

				// Queue release: if the completed task belongs to a queue, trigger next
				const { taskService } = c.get('services')
				const completedTask = await taskService.get(run.task_id)
				if (completedTask?.queue) {
					workflowEngine.triggerNextInQueue(completedTask.queue).catch((err) => {
						console.error('[runs] queue release error:', err instanceof Error ? err.message : String(err))
					})
				}
			}

			return c.json(result, 200)
		},
	)
	// POST /runs/:id/cancel — cancel a pending/claimed/running run
	.post(
		'/:id/cancel',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', z.object({ reason: z.string().optional() }).optional()),
		async (c) => {
			const { runService, workerService, workflowEngine } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			const result = await runService.cancel(id, body?.reason)
			if (!result) {
				return c.json({ error: `run ${id} is already ${run.status} — cannot cancel` }, 400)
			}

			// Release worker lease for this run if claimed/running
			if (run.worker_id) {
				const lease = await workerService.getActiveLeaseForRun(run.worker_id, id)
				if (lease) {
					await workerService.completeLease(lease.id, 'failed')
				}
				// Only set online if no remaining active leases
				const remainingLeases = await workerService.getActiveLeaseCountForWorker(run.worker_id)
				if (remainingLeases === 0) {
					await workerService.setOnline(run.worker_id)
				}
			}

			// Normalize failure signal — same path as run completion with status: failed
			if (run.task_id) {
				await workflowEngine.handleRunFailure(run.task_id, id)
			}

			eventBus.emit({ type: 'run_completed', runId: id, status: 'failed' })

			return c.json(result, 200)
		},
	)
	// POST /runs/:id/continue — create a continuation run
	.post(
		'/:id/continue',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', ContinueRunRequestSchema),
		async (c) => {
			const { runService, workerService } = c.get('services')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')
			const actor = c.get('actor')

			const original = await runService.get(id)
			if (!original) return c.json({ error: 'run not found' }, 404)

			if (original.status !== 'completed' && original.status !== 'failed') {
				return c.json({ error: 'can only continue completed or failed runs' }, 400)
			}

			if (!original.resumable) {
				return c.json({ error: 'run is not resumable (no local session)' }, 400)
			}

			// Check if preferred worker is online
			if (original.worker_id) {
				const worker = await workerService.get(original.worker_id)
				if (!worker || worker.status === 'offline') {
					return c.json(
						{
							error: `original worker ${original.worker_id} is offline — cannot resume session`,
						},
						409,
					)
				}
			}

			const continuation = await runService.createContinuation(id, {
				message: body.message,
				initiated_by: body.initiated_by ?? actor?.id ?? 'system',
			})

			if (!continuation) {
				return c.json({ error: 'failed to create continuation run' }, 500)
			}

			eventBus.emit({
				type: 'task_changed',
				taskId: continuation.task_id ?? continuation.id,
				status: 'pending',
			})

			return c.json(continuation, 201)
		},
	)

	// POST /runs/:id/steer — send a steering message to a running run (user auth)
	.post(
		'/:id/steer',
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', RunSteerRequestSchema),
		async (c) => {
			const { runService, steerService } = c.get('services')
			const actor = c.get('actor')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			if (run.status !== 'running' && run.status !== 'claimed') {
				return c.json({ error: `Run ${id} is ${run.status} — can only steer running/claimed runs` }, 400)
			}

			const steer = await steerService.create({
				run_id: id,
				message: body.message,
				created_by: body.created_by ?? actor?.id ?? 'system',
			})

			eventBus.emit({
				type: 'run_event',
				runId: id,
				eventType: 'steer',
				summary: `Steering message: ${body.message.slice(0, 100)}`,
			})

			return c.json(steer, 201)
		},
	)
	// POST /runs/:id/steers/claim — worker claims pending steer messages (worker auth)
	.post(
		'/:id/steers/claim',
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const { runService, steerService } = c.get('services')
			const { id } = c.req.valid('param')

			const run = await runService.get(id)
			if (!run) return c.json({ error: 'run not found' }, 404)

			// Verify authenticated worker owns this run
			const authWorkerId = c.get('workerId')
			if (authWorkerId && run.worker_id && run.worker_id !== authWorkerId) {
				return c.json({ error: `Run ${id} belongs to worker ${run.worker_id}, not ${authWorkerId}` }, 403)
			}

			const steers = await steerService.claimPending(id)
			return c.json({ steers }, 200)
		},
	)

export { runs }

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveAgentCapabilities(
	profileIds: string[],
	profiles: Map<string, CapabilityProfile>,
): ResolvedCapabilities {
	const skills = new Set<string>()
	const mcpServers = new Set<string>()
	const context = new Set<string>()
	const prompts: string[] = []

	for (const id of profileIds) {
		const profile = profiles.get(id)
		if (!profile) continue
		for (const s of profile.skills) skills.add(s)
		for (const m of profile.mcp_servers) mcpServers.add(m)
		for (const c of profile.context) context.add(c)
		for (const p of profile.prompts) prompts.push(p)
	}

	return {
		skills: [...skills],
		skill_hints: [],
		mcp_servers: [...mcpServers],
		context: [...context],
		prompts,
	}
}
