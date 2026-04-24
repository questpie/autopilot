/**
 * Dashboard v2 chat-session routes.
 *
 * GET  /api/chat-sessions              — list dashboard sessions
 * GET  /api/chat-sessions/:id          — get session detail
 * GET  /api/chat-sessions/:id/messages — get messages for session
 * POST /api/chat-sessions              — create new chat session
 * POST /api/chat-sessions/:id/messages — continue existing session
 * PATCH /api/chat-sessions/:id/stream-offset — persist stream offset
 */
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { QueryInstructionAttachment } from '../../services/queries'
import { buildQueryInstructions } from '../../services/queries'
import type { AppEnv } from '../app'

function safeParseJson(raw: string | null | undefined): Record<string, unknown> {
	if (!raw) return {}
	try {
		return JSON.parse(raw) as Record<string, unknown>
	} catch {
		return {}
	}
}

function isTextLikeContent(
	mimeType: string | null | undefined,
	refKind: string | undefined,
): boolean {
	if (refKind === 'inline') return true
	if (!mimeType) return false
	return (
		mimeType.startsWith('text/') ||
		mimeType.includes('json') ||
		mimeType.includes('yaml') ||
		mimeType.includes('xml') ||
		mimeType.includes('markdown') ||
		mimeType.includes('javascript') ||
		mimeType.includes('typescript')
	)
}

async function resolveArtifactTextContent(
	services: AppEnv['Variables']['services'],
	artifactId: string,
): Promise<string | undefined> {
	const artifact = await services.artifactService.get(artifactId)
	if (!artifact) return undefined
	if (!isTextLikeContent(artifact.mime_type, artifact.ref_kind)) return undefined

	try {
		const content = await services.artifactService.resolveContent(artifact)
		return typeof content === 'string' ? content : Buffer.from(content).toString('utf-8')
	} catch {
		return undefined
	}
}

async function hydrateAttachments(
	services: AppEnv['Variables']['services'],
	attachments: QueryInstructionAttachment[] | undefined,
): Promise<QueryInstructionAttachment[] | undefined> {
	if (!attachments || attachments.length === 0) return attachments

	return Promise.all(
		attachments.map(async (attachment) => {
			if (attachment.refType === 'task' && attachment.refId) {
				const task = await services.taskService.get(attachment.refId)
				if (!task) return attachment

				const description = task.description?.trim()
				const taskContext = [
					`Task ID: ${task.id}`,
					`Title: ${task.title}`,
					`Status: ${task.status}`,
					`Type: ${task.type}`,
					task.priority ? `Priority: ${task.priority}` : null,
					task.assigned_to ? `Assigned to: ${task.assigned_to}` : null,
					task.workflow_id ? `Workflow: ${task.workflow_id}` : null,
					task.workflow_step ? `Workflow step: ${task.workflow_step}` : null,
					description ? `Description:\n${description}` : null,
				]
					.filter((line): line is string => !!line)
					.join('\n')

				return {
					...attachment,
					name: attachment.name ?? task.title,
					label: attachment.label ?? task.title,
					content: attachment.content ?? taskContext,
					metadata: {
						...(attachment.metadata ?? {}),
						taskId: task.id,
						title: task.title,
						status: task.status,
						type: task.type,
						priority: task.priority,
						assigned_to: task.assigned_to,
						workflow_id: task.workflow_id,
						workflow_step: task.workflow_step,
					},
				}
			}

			if (attachment.refType === 'file' || attachment.refType === 'directory') {
				const path =
					typeof attachment.metadata?.path === 'string'
						? attachment.metadata.path
						: typeof attachment.refId === 'string'
							? attachment.refId
							: null
				if (!path) return attachment

				const runId =
					typeof attachment.metadata?.runId === 'string' ? attachment.metadata.runId : null
				const uri = runId ? `workspace://run/${runId}/${path}` : null

				if (attachment.refType === 'file') {
					try {
						const file = runId
							? await services.vfsService.read(uri!)
							: await services.knowledgeService?.read(path)
						if (!file) return attachment
						const mimeType = 'mimeType' in file ? file.mimeType : file.mime_type
						const size = 'size' in file ? file.size : file.content.length
						const isText =
							'isText' in file ? file.isText : /(^text\/)|markdown|yaml|json/.test(mimeType)
						const content = isText ? Buffer.from(file.content).toString('utf-8') : undefined

						return {
							...attachment,
							name: attachment.name ?? path.split('/').pop() ?? path,
							label: attachment.label ?? path,
							mimeType: attachment.mimeType ?? mimeType,
							size: attachment.size ?? size,
							content: attachment.content ?? content,
							metadata: {
								...(attachment.metadata ?? {}),
								path,
								runId,
								...(uri ? { uri } : {}),
								isText,
							},
						}
					} catch {
						return attachment
					}
				}

				try {
					const entries = runId
						? (await services.vfsService.list(uri!)).entries
						: ((await services.knowledgeService?.list({ path })) ?? []).map((doc) => ({
								name: doc.path.split('/').pop() ?? doc.path,
								path: doc.path,
								type: 'file' as const,
								mime_type: doc.mime_type,
							}))
					const visibleEntries = entries.slice(0, 40)
					const directoryContext = [
						`Directory: ${path}`,
						`Entries: ${entries.length}`,
						...visibleEntries.map((entry) => {
							const kind = entry.type === 'directory' ? 'dir' : 'file'
							const size =
								'size' in entry && typeof entry.size === 'number' ? ` (${entry.size} B)` : ''
							return `- ${kind}: ${entry.path}${size}`
						}),
					].join('\n')

					return {
						...attachment,
						name: attachment.name ?? path.split('/').pop() ?? path,
						label: attachment.label ?? path,
						content: attachment.content ?? directoryContext,
						metadata: {
							...(attachment.metadata ?? {}),
							path,
							runId,
							...(uri ? { uri } : {}),
							entryCount: entries.length,
						},
					}
				} catch {
					return attachment
				}
			}

			if (attachment.refType === 'run') {
				const runId =
					typeof attachment.metadata?.runId === 'string'
						? attachment.metadata.runId
						: typeof attachment.refId === 'string'
							? attachment.refId
							: null
				if (!runId) return attachment

				const run = await services.runService.get(runId)
				if (!run) return attachment

				const [events, artifacts] = await Promise.all([
					services.runService.getEvents(runId),
					services.artifactService.listForRun(runId),
				])

				const recentEvents = events
					.filter((event) => event.summary)
					.slice(-10)
					.map((event) => `- ${event.type}: ${event.summary}`)

				const artifactLines = artifacts
					.slice(0, 10)
					.map((artifact) => `- ${artifact.kind}: ${artifact.title}`)

				const runContext = [
					`Run ID: ${run.id}`,
					`Status: ${run.status}`,
					`Agent: ${run.agent_id}`,
					`Runtime: ${run.runtime}`,
					run.model ? `Model: ${run.model}` : null,
					run.task_id ? `Task ID: ${run.task_id}` : null,
					run.summary ? `Summary:\n${run.summary}` : null,
					run.error ? `Error:\n${run.error}` : null,
					recentEvents.length > 0 ? 'Recent events:' : null,
					...recentEvents,
					artifactLines.length > 0 ? 'Artifacts:' : null,
					...artifactLines,
				]
					.filter((line): line is string => !!line)
					.join('\n')

				return {
					...attachment,
					label: attachment.label ?? `Run ${run.id.slice(0, 8)}`,
					content: attachment.content ?? runContext,
					metadata: {
						...(attachment.metadata ?? {}),
						runId: run.id,
						status: run.status,
						agent_id: run.agent_id,
						runtime: run.runtime,
						model: run.model,
						taskId: run.task_id,
						artifactCount: artifacts.length,
					},
				}
			}

			if (attachment.refType === 'artifact') {
				const artifactId =
					typeof attachment.metadata?.artifactId === 'string'
						? attachment.metadata.artifactId
						: typeof attachment.refId === 'string'
							? attachment.refId
							: null
				if (!artifactId) return attachment

				const artifact = await services.artifactService.get(artifactId)
				if (!artifact) return attachment

				const textContent = await resolveArtifactTextContent(services, artifactId)
				const artifactMeta = safeParseJson(artifact.metadata)
				const artifactContext = [
					`Artifact ID: ${artifact.id}`,
					`Title: ${artifact.title}`,
					`Kind: ${artifact.kind}`,
					`Ref kind: ${artifact.ref_kind}`,
					`Run ID: ${artifact.run_id}`,
					artifact.task_id ? `Task ID: ${artifact.task_id}` : null,
					artifact.mime_type ? `MIME: ${artifact.mime_type}` : null,
					artifact.ref_kind === 'url' ? `URL: ${artifact.ref_value}` : null,
					textContent ? `Content:\n${textContent}` : null,
				]
					.filter((line): line is string => !!line)
					.join('\n')

				return {
					...attachment,
					name: attachment.name ?? artifact.title,
					label: attachment.label ?? artifact.title,
					mimeType: attachment.mimeType ?? artifact.mime_type ?? undefined,
					content: attachment.content ?? artifactContext,
					metadata: {
						...(attachment.metadata ?? {}),
						artifactId: artifact.id,
						runId: artifact.run_id,
						taskId: artifact.task_id,
						kind: artifact.kind,
						refKind: artifact.ref_kind,
						...artifactMeta,
					},
				}
			}

			return attachment
		}),
	)
}

const attachmentSchema = z
	.object({
		type: z.string(),
		name: z.string().optional(),
		url: z.string().optional(),
		content: z.string().optional(),
		mimeType: z.string().optional(),
	})
	.passthrough()

const chatSessions = new Hono<AppEnv>()
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				limit: z.string().optional(),
				offset: z.string().optional(),
			}),
		),
		async (c) => {
			const { sessionService } = c.get('services')
			const query = c.req.valid('query')
			const limit = query.limit ? Number.parseInt(query.limit, 10) : 20
			const offset = query.offset ? Number.parseInt(query.offset, 10) : 0

			const all = await sessionService.list({ provider_id: 'dashboard', status: 'active' })
			const sessions = all.slice(offset, offset + limit)
			return c.json({ sessions }, 200)
		},
	)
	.get('/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
		const { sessionService } = c.get('services')
		const { id } = c.req.valid('param')
		const session = await sessionService.get(id)
		if (!session) return c.json({ error: 'session not found' }, 404)
		return c.json(session, 200)
	})
	.get(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'query',
			z.object({
				limit: z.string().optional(),
				offset: z.string().optional(),
			}),
		),
		async (c) => {
			const { sessionMessageService } = c.get('services')
			const { id } = c.req.valid('param')
			const query = c.req.valid('query')
			const limit = query.limit ? Number.parseInt(query.limit, 10) : 200

			const messages = await sessionMessageService.listRecent(id, limit)
			const enriched = messages.map((msg) => {
				const meta = safeParseJson(msg.metadata)
				const attachments = Array.isArray(meta.attachments) ? meta.attachments : null
				return { ...msg, attachments }
			})

			// Sort chronologically
			enriched.sort((a, b) => a.created_at.localeCompare(b.created_at))

			return c.json(enriched, 200)
		},
	)
	.post(
		'/',
		zValidator(
			'json',
			z.object({
				agentId: z.string(),
				message: z.string(),
				attachments: z.array(attachmentSchema).optional(),
			}),
		),
		async (c) => {
			const services = c.get('services')
			const { sessionService, sessionMessageService, queryService, runService } = services
			const authoredConfig = c.get('authoredConfig')
			const body = c.req.valid('json')
			const hydratedAttachments = await hydrateAttachments(services, body.attachments)

			const externalConversationId = crypto.randomUUID()
			const session = await sessionService.findOrCreate({
				provider_id: 'dashboard',
				external_conversation_id: externalConversationId,
				external_thread_id: '__chat__',
			})

			const msgMetadata = hydratedAttachments
				? JSON.stringify({ attachments: hydratedAttachments })
				: undefined
			const userMsg = await sessionMessageService.create({
				session_id: session.id,
				role: 'user',
				content: body.message,
				metadata: msgMetadata,
			})

			const agentId = body.agentId || authoredConfig.defaults.task_assignee
			if (!agentId) {
				return c.json({ error: 'No agent specified and no default agent configured' }, 400)
			}
			const agentConfig = authoredConfig.agents.get(agentId)

			const instructions = buildQueryInstructions(body.message, {
				sessionMessages: [],
				allowMutation: true,
				hasResume: false,
				currentAttachments: hydratedAttachments,
			})

			const query = await queryService.create({
				prompt: body.message,
				agent_id: agentId,
				allow_repo_mutation: true,
				session_id: session.id,
				created_by: 'dashboard',
			})

			await sessionMessageService.markConsumed([userMsg.id], query.id)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: authoredConfig.defaults.runtime,
				model: agentConfig?.model,
				provider: agentConfig?.provider,
				variant: agentConfig?.variant,
				initiated_by: 'dashboard',
				instructions,
			})

			await queryService.linkRun(query.id, runId)

			return c.json(
				{
					session_id: session.id,
					query_id: query.id,
					run_id: runId,
				},
				200,
			)
		},
	)
	.post(
		'/:id/messages',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				message: z.string(),
				attachments: z.array(attachmentSchema).optional(),
			}),
		),
		async (c) => {
			const { sessionService, sessionMessageService, queryService, runService, workerService } =
				c.get('services')
			const services = c.get('services')
			const authoredConfig = c.get('authoredConfig')
			const { id } = c.req.valid('param')
			const body = c.req.valid('json')
			const hydratedAttachments = await hydrateAttachments(services, body.attachments)

			const session = await sessionService.get(id)
			if (!session) return c.json({ error: 'session not found' }, 404)

			const msgMetadata = hydratedAttachments
				? JSON.stringify({ attachments: hydratedAttachments })
				: undefined
			const userMsg = await sessionMessageService.create({
				session_id: session.id,
				role: 'user',
				content: body.message,
				metadata: msgMetadata,
			})

			const activeQuery = await queryService.findActiveForSession(session.id)
			if (activeQuery?.run_id) {
				const activeRun = await runService.get(activeQuery.run_id)
				if (
					activeRun &&
					(activeRun.status === 'pending' ||
						activeRun.status === 'claimed' ||
						activeRun.status === 'running')
				) {
					return c.json(
						{
							queued: true as const,
							session_id: session.id,
							query_id: activeQuery.id,
							run_id: activeQuery.run_id,
							streamUrl: null,
							streamOffset: null,
						},
						200,
					)
				}
			}

			const agentId = authoredConfig.defaults.task_assignee
			if (!agentId) {
				return c.json({ error: 'No default agent configured' }, 400)
			}
			const agentConfig = authoredConfig.agents.get(agentId)

			const hasResume = !!session.runtime_session_ref
			let effectiveResume = hasResume
			if (hasResume && session.preferred_worker_id) {
				const worker = await workerService.get(session.preferred_worker_id)
				if (workerService.isUnavailable(worker, 90_000)) {
					await sessionService.updateResumeState(session.id, null, null)
					effectiveResume = false
				}
			}

			const recent = await sessionMessageService.listRecent(session.id)
			const instructionMessages = effectiveResume ? [] : recent.filter((m) => m.id !== userMsg.id)

			const instructions = buildQueryInstructions(body.message, {
				sessionMessages: instructionMessages,
				allowMutation: true,
				hasResume: effectiveResume,
				currentAttachments: hydratedAttachments,
			})

			const query = await queryService.create({
				prompt: body.message,
				agent_id: agentId,
				allow_repo_mutation: true,
				session_id: session.id,
				created_by: 'dashboard',
			})

			await sessionMessageService.markConsumed([userMsg.id], query.id)

			const runId = `run-${Date.now()}-${randomBytes(6).toString('hex')}`
			await runService.create({
				id: runId,
				agent_id: agentId,
				runtime: authoredConfig.defaults.runtime,
				model: agentConfig?.model,
				provider: agentConfig?.provider,
				variant: agentConfig?.variant,
				initiated_by: 'dashboard',
				instructions,
				runtime_session_ref: effectiveResume
					? (session.runtime_session_ref ?? undefined)
					: undefined,
				preferred_worker_id: effectiveResume
					? (session.preferred_worker_id ?? undefined)
					: undefined,
			})

			await queryService.linkRun(query.id, runId)

			return c.json(
				{
					session_id: session.id,
					query_id: query.id,
					run_id: runId,
					streamUrl: null,
					streamOffset: null,
				},
				200,
			)
		},
	)
	.patch(
		'/:id/stream-offset',
		zValidator('param', z.object({ id: z.string() })),
		zValidator(
			'json',
			z.object({
				offset: z.string(),
			}),
		),
		async (c) => {
			const { sessionService } = c.get('services')
			const { id } = c.req.valid('param')
			const { offset } = c.req.valid('json')

			const session = await sessionService.get(id)
			if (!session) return c.json({ error: 'session not found' }, 404)

			const existing = safeParseJson(session.metadata)
			const updated = { ...existing, streamOffset: offset }
			await sessionService.updateMetadata(id, updated)

			return c.json({ streamOffset: offset }, 200)
		},
	)

export { chatSessions }
