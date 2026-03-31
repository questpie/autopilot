import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	AgentSchema,
	HumanSchema,
	ScheduleSchema,
	WebhookSchema,
	WorkflowSchema,
} from '@questpie/autopilot-spec'
import type { Schedule } from '@questpie/autopilot-spec'
import dotenv from 'dotenv'
import { parse as parseYaml } from 'yaml'
import { spawnAgent } from './agent'
import { createApp } from './api'
import { reloadRoles } from './auth/roles'
import { eventBus } from './events'
import { loadAgents, loadCompany } from './fs'
import { GitManager } from './git/git-manager'
import { Scheduler } from './scheduler'
import { Watcher } from './watcher'
import type { WatchEvent } from './watcher'
import { webhookHandlerRegistry } from './webhook'
import { telegramWebhookHandler } from './webhook'
import {
	advanceWorkflow,
	buildWorkflowRunId,
	evaluateTransition,
	workflowRuntimeStoreFactory,
} from './workflow'
import { WorkflowLoader } from './workflow'
import type { CompiledWorkflowStep } from './workflow'

import { BLOCKED_TASK_CLASSIFIER, classify } from './agent/micro-agent'
import { aiProviderFactory } from './ai'
import { authFactory } from './auth'
import { configureContainer, container } from './container'
import { dbFactory } from './db'
import { indexerFactory } from './db/indexer'
import { embeddingServiceFactory } from './embeddings'
import { storageFactory } from './fs/sqlite-backend'
import { logger } from './logger'
import { NotificationDispatcher } from './notifications'
import { notifierFactory } from './notifier'
import { streamManagerFactory } from './session/stream'

const LEGACY_TEAM_CONFIG_FILES = [
	'agents.yaml',
	'humans.yaml',
	'webhooks.yaml',
	'schedules.yaml',
] as const

const WORKFLOW_EVENT_STREAM_PREFIX = 'workflow'

function toContextString(value: unknown): string {
	if (typeof value === 'string') return value
	try {
		return JSON.stringify(value) ?? String(value)
	} catch {
		return String(value)
	}
}

function readTaskBinding(task: import('./fs/storage').Task, expression: string): unknown {
	switch (expression) {
		case 'id':
		case 'task.id':
			return task.id
		case 'title':
		case 'task.title':
			return task.title
		case 'description':
		case 'task.description':
			return task.description
		case 'type':
		case 'task.type':
			return task.type
		case 'priority':
		case 'task.priority':
			return task.priority
		case 'workflow':
		case 'task.workflow':
			return task.workflow
		case 'workflow_step':
		case 'task.workflow_step':
			return task.workflow_step
		default:
			break
	}

	if (expression.startsWith('context.')) {
		return task.context[expression.slice('context.'.length)]
	}

	if (expression.startsWith('metadata.')) {
		const metadata = (task.metadata ?? {}) as Record<string, unknown>
		return metadata[expression.slice('metadata.'.length)]
	}

	return undefined
}

function resolveTaskBinding(task: import('./fs/storage').Task, expression: string): string {
	const directValue = readTaskBinding(task, expression)
	if (directValue !== undefined) {
		return toContextString(directValue)
	}

	if (!expression.includes('{{')) return expression

	return expression.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, token: string) => {
		const value = readTaskBinding(task, token.trim())
		return value === undefined ? '' : toContextString(value)
	})
}

function sanitizeIdSegment(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return normalized.slice(0, 40) || 'step'
}

function buildSubWorkflowTaskId(
	parentTaskId: string,
	stepId: string,
	workflowId: string,
	idempotencyKey?: string,
): string {
	const source = idempotencyKey ?? `${parentTaskId}:${stepId}:${workflowId}`
	const hash = createHash('sha1').update(source).digest('hex').slice(0, 10)
	return `subwf-${sanitizeIdSegment(parentTaskId)}-${sanitizeIdSegment(stepId)}-${hash}`
}

function legacyConfigMigrationHint(file: string): string {
	const base = file.replace(/\.ya?ml$/, '')
	return `legacy file team/${file} is no longer supported; migrate to team/${base}/<id>.yaml files`
}

/** Configuration options for the {@link Orchestrator}. */
export interface OrchestratorOptions {
	/** Absolute path to the company root directory on disk. */
	companyRoot: string
	/** Port for the unified HTTP server (default 7778). */
	port?: number
}

/**
 * Top-level runtime that boots and coordinates every orchestrator subsystem.
 *
 * Lifecycle: call {@link start} to spin up the file-system watcher, cron
 * scheduler, webhook server, and API server. Call {@link stop} to tear
 * everything down gracefully.
 */
export class Orchestrator {
	private watcher: Watcher | null = null
	private scheduler: Scheduler | null = null
	private apiServer: ReturnType<typeof Bun.serve> | null = null
	private gitManager: GitManager | null = null
	private running = false
	private activeAgentCount = 0
	private maxConcurrentAgents = 5
	private processingTasks = new Set<string>()

	constructor(private options: OrchestratorOptions) {}

	/**
	 * D4: Guarded agent spawn — enforces maxConcurrentAgents limit.
	 * Returns the spawn promise, or logs a warning and returns null if at capacity.
	 */
	private guardedSpawn(
		opts: Parameters<typeof spawnAgent>[0],
	): Promise<Awaited<ReturnType<typeof spawnAgent>>> | null {
		if (this.activeAgentCount >= this.maxConcurrentAgents) {
			logger.warn(
				'orchestrator',
				`max concurrent agents (${this.maxConcurrentAgents}) reached — skipping spawn for ${opts.agent.id}`,
			)
			return null
		}
		this.activeAgentCount++
		return spawnAgent(opts).finally(() => {
			this.activeAgentCount--
		})
	}

	private assertNoLegacyTeamConfig(root: string): void {
		const legacyFiles = LEGACY_TEAM_CONFIG_FILES.filter((file) =>
			existsSync(join(root, 'team', file)),
		)
		if (legacyFiles.length === 0) return

		for (const file of legacyFiles) {
			logger.error('orchestrator', legacyConfigMigrationHint(file))
		}

		const firstLegacyFile = legacyFiles[0]
		if (!firstLegacyFile) return
		throw new Error(legacyConfigMigrationHint(firstLegacyFile))
	}

	/**
	 * Boot every subsystem (watcher, scheduler, webhook server, API server).
	 *
	 * The method is idempotent — calling it on an already-running orchestrator
	 * is a no-op.
	 */
	async start(): Promise<void> {
		if (this.running) {
			logger.info('orchestrator', 'already running')
			return
		}

		const root = this.options.companyRoot

		// Load .env from company root (SMTP, API keys, etc.)
		const envPath = join(root, '.env')
		if (existsSync(envPath)) {
			dotenv.config({ path: envPath, override: false })
			logger.info('orchestrator', `loaded env from ${envPath}`)
		}

		// Configure DI container with company root
		configureContainer(root)

		// 1. Verify company directory
		let company: Awaited<ReturnType<typeof loadCompany>>
		try {
			company = await loadCompany(root)
			logger.info('orchestrator', `loaded company: ${company.name} (${company.slug})`)
			this.assertNoLegacyTeamConfig(root)
		} catch (err) {
			logger.error(
				'orchestrator',
				'failed to load company.yaml — is this a valid company directory?',
			)
			throw err
		}

		// 2. Resolve core services from container (ordered by deps automatically)
		try {
			await container.resolveAsync([
				storageFactory,
				dbFactory,
				authFactory,
				embeddingServiceFactory,
			])
			logger.info('orchestrator', 'core services initialized')
		} catch (err) {
			logger.error('orchestrator', 'failed to initialize core services', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 3. Indexer (triggers reindexAll inside factory)
		try {
			await container.resolveAsync([indexerFactory])
		} catch (err) {
			logger.error('orchestrator', 'indexer failed', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 4. Load roles (needed for RBAC before first request)
		try {
			const { loadRoles } = await import('./auth/roles')
			await loadRoles(root)
			logger.info('orchestrator', 'roles loaded')
		} catch (err) {
			logger.error('orchestrator', 'failed to load roles', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 5. Notifier + StreamManager
		await container.resolveAsync([notifierFactory, streamManagerFactory])

		// 5b. Wire NotificationDispatcher into EventBus
		try {
			const { db: dbResult } = await container.resolveAsync([dbFactory])
			const dispatcher = new NotificationDispatcher(root, dbResult.db)
			eventBus.subscribe((event) => {
				// Fire-and-forget — dispatcher handles its own errors
				dispatcher.handle(event).catch((err) => {
					logger.error('orchestrator', 'notification dispatcher error', {
						error: err instanceof Error ? err.message : String(err),
					})
				})
			})
			logger.info('orchestrator', 'notification dispatcher wired to event bus')
		} catch (err) {
			logger.error('orchestrator', 'failed to wire notification dispatcher', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 5c. Seed default data if DB is fresh
		try {
			const { storage } = await container.resolveAsync([storageFactory])
			const channels = await storage.listChannels()
			if (channels.length === 0) {
				logger.info('orchestrator', 'seeding default channels...')
				const now = new Date().toISOString()
				await storage.createChannel({
					id: 'general',
					name: 'General',
					type: 'group',
					description: 'General team discussion',
					created_by: 'system',
					created_at: now,
					updated_at: now,
					metadata: {},
				})
				await storage.createChannel({
					id: 'dev',
					name: 'Development',
					type: 'group',
					description: 'Development discussion',
					created_by: 'system',
					created_at: now,
					updated_at: now,
					metadata: {},
				})
				// Add all agents as members of default channels
				const agents = await loadAgents(root)
				for (const agent of agents) {
					await storage.addChannelMember('general', agent.id, 'agent', 'member').catch(() => {})
					await storage.addChannelMember('dev', agent.id, 'agent', 'member').catch(() => {})
				}
				logger.info('orchestrator', `seeded 2 default channels with ${agents.length} agent members`)
			}
		} catch (err) {
			logger.error('orchestrator', 'failed to seed defaults', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 6. Start watcher
		this.watcher = new Watcher({
			companyRoot: root,
			onEvent: (event) => this.handleWatchEvent(event),
		})
		try {
			await this.watcher.start()
			logger.info(
				'orchestrator',
				'watcher started (watching dashboard/, team/, knowledge/, artifacts/, company.yaml)',
			)
		} catch (err) {
			logger.error('orchestrator', 'failed to start watcher', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 6. Start scheduler
		this.scheduler = new Scheduler({
			companyRoot: root,
			onTrigger: (schedule) => this.handleScheduleTrigger(schedule),
		})
		try {
			await this.scheduler.start()
			const jobs = this.scheduler.getActiveJobs()
			logger.info('orchestrator', `scheduler started (${jobs.length} active jobs)`)
		} catch (err) {
			logger.error('orchestrator', 'failed to start scheduler', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 7. Register webhook handlers
		webhookHandlerRegistry.register(telegramWebhookHandler)

		// 8. Start Durable Streams server (session persistence)
		try {
			const { startDurableStreamServer } = await import('./session/durable')
			await startDurableStreamServer(root)
		} catch (err) {
			logger.warn(
				'orchestrator',
				'durable streams server failed to start (sessions will use in-memory only)',
				{
					error: err instanceof Error ? err.message : String(err),
				},
			)
		}

		// 9. Start unified HTTP server (API + webhooks + dashboard)
		const apiPort = this.options.port ?? 7778
		const authSettings = company.settings.auth
		try {
			const app = createApp({
				corsOrigin: authSettings.cors_origin,
			})
			this.apiServer = Bun.serve({
				port: apiPort,
				fetch: app.fetch,
			})
			logger.info('orchestrator', `server started on port ${apiPort}`)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes('EADDRINUSE') || msg.includes('in use')) {
				logger.warn(
					'orchestrator',
					`port ${apiPort} already in use — skipping (kill the other process or use --port)`,
				)
			} else {
				logger.error('orchestrator', 'failed to start server', { error: msg })
			}
		}

		// 10. Initialize GitManager
		try {
			const gitConfig = (company as Record<string, unknown>).settings as
				| Record<string, unknown>
				| undefined
			const gitSettings = (gitConfig?.git ?? {}) as Record<string, unknown>

			this.gitManager = new GitManager({
				companyRoot: root,
				enabled: gitSettings.auto_commit !== false,
				batchIntervalMs: (gitSettings.commit_batch_interval as number) ?? 5000,
				autoPush: (gitSettings.auto_push as boolean) ?? false,
				remote: (gitSettings.remote as string) ?? '',
				branch: (gitSettings.branch as string) ?? 'main',
			})
			await this.gitManager.initialize()
		} catch (err) {
			logger.error('orchestrator', 'failed to initialize git manager', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// 11. Startup scan: process existing tasks from SQLite
		try {
			const { storage } = await container.resolveAsync([storageFactory])
			const activeTasks = await storage.listTasks({ status: 'in_progress' })
			const backlogTasks = await storage.listTasks({ status: 'backlog' })
			const blockedTasks = await storage.listTasks({ status: 'blocked' })
			const allTasks = [...activeTasks, ...backlogTasks]
			for (const task of allTasks) {
				await this.handleTaskChange(task.id)
			}
			// Check escalation for blocked tasks at startup
			for (const task of blockedTasks) {
				await this.checkEscalation(task)
			}
			const totalProcessed = allTasks.length + blockedTasks.length
			if (totalProcessed > 0) {
				logger.info(
					'orchestrator',
					`startup scan: processed ${allTasks.length} active tasks, ${blockedTasks.length} blocked tasks`,
				)
			}
		} catch {
			// storage might not be ready
		}

		this.running = true
		logger.info('orchestrator', 'startup complete')
	}

	/** Gracefully shut down all subsystems. */
	async stop(): Promise<void> {
		if (!this.running) return

		logger.info('orchestrator', 'shutting down...')

		if (this.gitManager) {
			try {
				await this.gitManager.stop()
			} catch (err) {
				logger.error('orchestrator', 'error stopping git manager', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
			this.gitManager = null
		}

		if (this.watcher) {
			try {
				await this.watcher.stop()
			} catch (err) {
				logger.error('orchestrator', 'error stopping watcher', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
			this.watcher = null
		}

		if (this.scheduler) {
			try {
				this.scheduler.stop()
			} catch (err) {
				logger.error('orchestrator', 'error stopping scheduler', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
			this.scheduler = null
		}

		if (this.apiServer) {
			try {
				this.apiServer.stop(true)
			} catch (err) {
				logger.error('orchestrator', 'error stopping api server', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
			this.apiServer = null
		}

		// Close storage via container before clearing instances
		try {
			const { storage } = await container.resolveAsync([storageFactory])
			await storage.close()
		} catch (err) {
			logger.error('orchestrator', 'error closing storage', {
				error: err instanceof Error ? err.message : String(err),
			})
		}

		// Clear all cached singleton instances from the container
		container.clearAllInstances()

		this.running = false
		logger.info('orchestrator', 'shutdown complete')
	}

	/** Return the shared session stream manager (used by `attach`). */
	getStreamManager(): import('./session').SessionStreamManager {
		const { streamManager } = container.resolve([streamManagerFactory])
		return streamManager
	}

	/** Return the workflow loader (used by the API layer). */
	getWorkflowLoader(): WorkflowLoader {
		return new WorkflowLoader(this.options.companyRoot)
	}

	/** Return the storage backend (used by tools and API). */
	async getStorage(): Promise<import('./fs/storage').StorageBackend | null> {
		try {
			const { storage } = await container.resolveAsync([storageFactory])
			return storage
		} catch {
			return null
		}
	}

	/** Return the embedding service (used by tools and search). */
	async getEmbeddingService(): Promise<import('./embeddings').EmbeddingService | null> {
		try {
			const { embeddingService } = await container.resolveAsync([embeddingServiceFactory])
			return embeddingService
		} catch {
			return null
		}
	}

	private async emitWorkflowEvent(taskId: string, event: Record<string, unknown>): Promise<void> {
		if (!this.running) return
		try {
			const { createSessionStream, appendToSessionStream } = await import('./session/durable')
			const streamId = `${WORKFLOW_EVENT_STREAM_PREFIX}-${taskId}`
			await createSessionStream(streamId)
			await appendToSessionStream(streamId, {
				...event,
				at: Date.now(),
			})
		} catch {
			// Best-effort only — durable streams are a replay aid, not the source of truth.
		}
	}

	private buildSubWorkflowContext(
		task: import('./fs/storage').Task,
		step: CompiledWorkflowStep,
	): Record<string, string> {
		const mapped = Object.fromEntries(
			Object.entries(step.spawnWorkflow?.inputMap ?? {}).map(([key, expression]) => [
				key,
				resolveTaskBinding(task, expression),
			]),
		)

		return {
			...task.context,
			parent_task_id: task.id,
			parent_workflow: task.workflow ?? '',
			parent_workflow_step: task.workflow_step ?? '',
			...mapped,
		}
	}

	private queueTaskReevaluation(taskId: string): void {
		if (!this.running) return
		setTimeout(() => {
			void this.handleTaskChange(taskId)
		}, 0)
	}

	/** Whether the orchestrator is currently running. */
	isRunning(): boolean {
		return this.running
	}

	private async handleWatchEvent(event: WatchEvent): Promise<void> {
		try {
			switch (event.type) {
				case 'dashboard_changed':
					logger.info('orchestrator', `dashboard files changed: ${event.file}`)
					await this.handleDashboardChange()
					this.gitManager?.queueCommit([event.path], `dashboard: update ${event.file}`)
					break
				case 'config_changed':
					logger.info('orchestrator', `config changed: ${event.file}`)
					await this.handleConfigChanged(event.file, event.path)
					this.gitManager?.queueCommit([event.path], `config: update ${event.file}`)
					break
				case 'knowledge_changed':
					logger.info('orchestrator', `knowledge changed: ${event.file}`)
					await this.handleKnowledgeChanged(event.file, event.path)
					this.gitManager?.queueCommit([event.path], `knowledge: update ${event.file}`)
					break
				case 'artifact_changed':
					logger.info('orchestrator', `artifact registered: ${event.artifactId}`)
					eventBus.emit({
						type: 'artifact_changed',
						artifactId: event.artifactId,
						action: 'registered',
					})
					this.gitManager?.queueCommit([event.path], `artifact: register ${event.artifactId}`)
					break
			}
		} catch (err) {
			logger.error('orchestrator', `error handling watch event (${event.type})`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	/** TM-008: Validate config files with Zod before reloading. */
	private async handleConfigChanged(file: string, path: string): Promise<void> {
		try {
			if ((LEGACY_TEAM_CONFIG_FILES as readonly string[]).includes(file)) {
				throw new Error(legacyConfigMigrationHint(file))
			}

			const content = readFileSync(path, 'utf-8')
			const parsed = parseYaml(content)

			// Validate with Zod schemas depending on file type
			if (file.startsWith('agents/')) {
				AgentSchema.parse(parsed)
			} else if (file.startsWith('humans/')) {
				HumanSchema.parse(parsed)
			} else if (file.startsWith('webhooks/')) {
				WebhookSchema.parse(parsed)
			} else if (file.startsWith('schedules/')) {
				ScheduleSchema.parse(parsed)
			} else if (file.startsWith('workflows/')) {
				WorkflowSchema.parse(parsed)
			}

			// Valid config — proceed with reload
			if (file.startsWith('schedules/') && this.scheduler) {
				logger.info('orchestrator', 'reloading scheduler...')
				await this.scheduler.reload()
			}
			if (file === 'roles.yaml') {
				await reloadRoles(this.options.companyRoot)
				logger.info('orchestrator', 'roles reloaded')
			}

			eventBus.emit({ type: 'settings_changed' })
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			logger.error('watcher', `invalid config: ${file}`, { error: msg })
			eventBus.emit({ type: 'validation_error', file, error: msg })
			// Old config stays active (safe fallback)
		}
	}

	/** TM-005: Reindex knowledge files when they change on disk. */
	private async handleKnowledgeChanged(file: string, filePath: string): Promise<void> {
		try {
			const { indexer } = await container.resolveAsync([indexerFactory])
			const content = readFileSync(filePath, 'utf-8')
			const titleMatch = content.match(/^#\s+(.+)$/m)
			const title = titleMatch?.[1]?.trim() ?? file.replace(/\.md$/, '')
			await indexer.indexOne('knowledge', file, title, content)
			eventBus.emit({ type: 'knowledge_changed', path: file, action: 'updated' })
		} catch (err) {
			logger.error('orchestrator', `failed to reindex knowledge file ${file}`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	private dashboardBuildTimer: ReturnType<typeof setTimeout> | null = null

	private async handleDashboardChange(): Promise<void> {
		// Debounce: wait 1s after last change before triggering rebuild
		if (this.dashboardBuildTimer) clearTimeout(this.dashboardBuildTimer)
		this.dashboardBuildTimer = setTimeout(async () => {
			this.dashboardBuildTimer = null
			const root = this.options.companyRoot
			const dashboardDir = join(root, 'dashboard')
			logger.info('orchestrator', 'auto-rebuilding dashboard (prod mode)...')
			try {
				const proc = Bun.spawn(['bunx', 'vite', 'build'], {
					cwd: dashboardDir,
					stdout: 'ignore',
					stderr: 'ignore',
				})
				const exitCode = await proc.exited
				if (exitCode === 0) {
					logger.info('orchestrator', 'dashboard rebuild complete')
				} else {
					logger.error('orchestrator', `dashboard rebuild failed (exit ${exitCode})`)
				}
			} catch (err) {
				logger.error('orchestrator', 'dashboard rebuild error', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}, 1000)
	}

	private async handleMessage(channel: string, filePath: string): Promise<void> {
		const root = this.options.companyRoot
		try {
			const { readYamlUnsafe } = await import('./fs/yaml')
			const msg = (await readYamlUnsafe(filePath)) as Record<string, unknown>
			const content = (msg?.content as string) ?? ''
			const from = (msg?.from as string) ?? 'unknown'

			// Check for @mentions — spawn mentioned agent with message context
			const mentionPattern = /@([a-z0-9-]+)/g
			const mentions: string[] = []
			let match: RegExpExecArray | null = mentionPattern.exec(content)
			while (match) {
				const mentionId = match[1]
				if (mentionId) mentions.push(mentionId)
				match = mentionPattern.exec(content)
			}

			if (mentions.length === 0) return

			const agents = await loadAgents(root)
			const company = await loadCompany(root)
			const { storage } = await container.resolveAsync([storageFactory])

			for (const mentionedId of mentions) {
				const agent = agents.find((a) => a.id === mentionedId)
				if (!agent) continue
				if (agent.id === from) continue // don't spawn agent that sent the message

				logger.info(
					'orchestrator',
					`@${mentionedId} mentioned in #${channel} by ${from} — spawning`,
				)
				this.guardedSpawn({
					agent,
					company,
					allAgents: agents,
					storage,
					trigger: { type: 'mention' },
				})
					?.then((result) => {
						logger.info('orchestrator', `agent ${agent.id} finished mention response`, {
							toolCalls: result.toolCalls,
						})
					})
					.catch((err) => {
						logger.error('orchestrator', `agent ${agent.id} failed`, {
							error: err instanceof Error ? err.message : String(err),
						})
					})
			}
		} catch (err) {
			// Ignore parse errors — might be a partial write
		}
	}

	private async handleScheduleTrigger(schedule: Schedule): Promise<void> {
		try {
			logger.info('orchestrator', `schedule triggered: ${schedule.id} (agent: ${schedule.agent})`)

			const root = this.options.companyRoot
			const { storage } = await container.resolveAsync([storageFactory])
			const { notifier } = await container.resolveAsync([notifierFactory])

			if (schedule.create_task) {
				// Create a task from the schedule's task_template and let the workflow engine handle it
				const now = new Date().toISOString()
				const template = schedule.task_template ?? {}
				const templateWorkflow =
					typeof template.workflow === 'string' ? template.workflow : undefined
				const workflowId = schedule.workflow ?? templateWorkflow

				if (workflowId) {
					const workflowLoader = new WorkflowLoader(root)
					try {
						await workflowLoader.load(workflowId)
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err)
						logger.error(
							'orchestrator',
							`schedule ${schedule.id} references missing workflow: ${workflowId}`,
							{ error: msg },
						)
						eventBus.emit({
							type: 'validation_error',
							file: `schedules/${schedule.id}.yaml`,
							error: `workflow '${workflowId}' not found`,
						})
						return
					}
				}

				const workflowInputs = schedule.workflow_inputs ?? {}
				const serializedWorkflowInputs = Object.fromEntries(
					Object.entries(workflowInputs).map(([key, value]) => [key, toContextString(value)]),
				)

				const templateContext =
					typeof template.context === 'object' && template.context !== null
						? (template.context as Record<string, unknown>)
						: {}
				const serializedTemplateContext = Object.fromEntries(
					Object.entries(templateContext).map(([key, value]) => [key, toContextString(value)]),
				)

				const taskId = `sched-${schedule.id}-${Date.now()}`
				const task = await storage.createTask({
					id: taskId,
					title: template.title ?? `Scheduled: ${schedule.description || schedule.id}`,
					description: template.description ?? schedule.description,
					type: (template.type as 'intent') ?? 'intent',
					status: 'backlog',
					priority: (template.priority as 'medium') ?? 'medium',
					created_by: 'scheduler',
					assigned_to: template.assigned_to ?? schedule.agent,
					workflow: workflowId,
					context: {
						...serializedTemplateContext,
						...serializedWorkflowInputs,
					},
					metadata:
						Object.keys(workflowInputs).length > 0
							? { schedule_workflow_inputs: workflowInputs }
							: {},
					created_at: now,
					updated_at: now,
				})
				logger.info('orchestrator', `schedule ${schedule.id} created task ${task.id}`)

				// Process the task through the workflow engine (spawns agents, etc.)
				await this.handleTaskChange(task.id)
			} else {
				// No task creation — spawn the agent directly with schedule context
				const agents = await loadAgents(root)
				const agent = agents.find((a) => a.id === schedule.agent)
				if (agent) {
					const company = await loadCompany(root)
					logger.info('orchestrator', `spawning agent ${agent.id} for schedule ${schedule.id}`)
					this.guardedSpawn({
						agent,
						company,
						allAgents: agents,
						storage,
						trigger: { type: 'schedule', schedule_id: schedule.id },
						message: `Scheduled task (${schedule.id}): ${schedule.description || 'No description'}. Check your current tasks and act accordingly.`,
					})
						?.then((result) => {
							logger.info('orchestrator', `agent ${agent.id} finished schedule ${schedule.id}`, {
								toolCalls: result.toolCalls,
							})
						})
						.catch((err) => {
							logger.error('orchestrator', `agent ${agent.id} failed schedule ${schedule.id}`, {
								error: err instanceof Error ? err.message : String(err),
							})
						})
				} else {
					logger.warn(
						'orchestrator',
						`schedule ${schedule.id} references unknown agent: ${schedule.agent}`,
					)
				}
			}

			// Notify that the schedule fired (secondary effect)
			await notifier.notify({
				type: 'task_assigned',
				title: `Schedule triggered: ${schedule.id}`,
				message: `Scheduled task for agent ${schedule.agent}: ${schedule.description}`,
				priority: 'normal',
				agentId: schedule.agent,
			})
		} catch (err) {
			logger.error('orchestrator', `error handling schedule trigger (${schedule.id})`, {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	/**
	 * React to a task file changing on disk.
	 *
	 * Reads the task, evaluates its workflow (if any), and dispatches the
	 * appropriate notification (assign, approve, complete, or error).
	 */
	async handleTaskChange(taskId: string): Promise<void> {
		// Debounce: skip if already processing this task
		if (this.processingTasks.has(taskId)) return
		this.processingTasks.add(taskId)
		try {
			const root = this.options.companyRoot
			const { storage } = await container.resolveAsync([storageFactory])
			const { notifier } = await container.resolveAsync([notifierFactory])
			const { workflowRuntimeStore } = await container.resolveAsync([workflowRuntimeStoreFactory])
			const workflowLoader = new WorkflowLoader(root)

			// 1. Read the task
			const task = await storage.readTask(taskId)
			if (!task) {
				logger.info('orchestrator', `task not found: ${taskId}`)
				return
			}

			logger.info('orchestrator', `processing task: ${task.id}`, {
				status: task.status,
				workflowStep: task.workflow_step ?? 'none',
			})

			if (task.workflow && task.status === 'cancelled') {
				await workflowRuntimeStore.archiveWorkflowRunByTaskId(taskId, 'task_cancelled', {
					final_status: 'cancelled',
				})
				return
			}

			// 2. If task has a workflow but no step, initialize to first step and continue
			if (task.workflow && !task.workflow_step) {
				try {
					const workflow = await workflowLoader.load(task.workflow)
					const firstStep = workflow.steps[0]
					if (firstStep) {
						await storage.updateTask(
							taskId,
							{
								workflow_step: firstStep.id,
							},
							'system',
						)
						await storage.moveTask(taskId, 'assigned', 'system')
						logger.info('orchestrator', `initialized ${taskId} to workflow step: ${firstStep.id}`)
						// Update local task reference and fall through to evaluation
						task.workflow_step = firstStep.id
						task.status = 'assigned'
						await workflowRuntimeStore.ensureWorkflowRun({
							task,
							workflow,
							triggerSource: 'task_change',
							status: 'active',
							currentStepId: firstStep.id,
							lastEvent: 'workflow_initialized',
						})
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					logger.error('orchestrator', `failed to initialize workflow for ${taskId}: ${msg}`)
					return
				}
			}

			// 3. If task has a workflow and step, evaluate what to do
			if (task.workflow && task.workflow_step) {
				try {
					const workflow = await workflowLoader.load(task.workflow)
					const agents = await loadAgents(root)
					const currentStep = workflow.steps.find((step) => step.id === task.workflow_step)
					let runtimeState:
						| Awaited<ReturnType<typeof workflowRuntimeStore.recordEvaluation>>
						| undefined

					let result: import('./workflow').WorkflowTransitionResult

					if (task.status === 'done') {
						// Task finished current step → advance to next step
						result = advanceWorkflow(workflow, task, 'done', agents)
						if (result.nextStep && result.nextStep !== task.workflow_step) {
							if (currentStep) {
								await workflowRuntimeStore.recordAdvance(task, workflow, currentStep, result)
							}
							await storage.updateTask(taskId, { workflow_step: result.nextStep }, 'system')
							await storage.moveTask(taskId, 'assigned', 'system')
							eventBus.emit({
								type: 'workflow_advanced',
								taskId,
								from: task.workflow_step ?? 'unknown',
								to: result.nextStep,
							})
							logger.info(
								'orchestrator',
								`advanced ${taskId}: ${task.workflow_step} -> ${result.nextStep}`,
							)
							await this.emitWorkflowEvent(taskId, {
								type: 'workflow_advanced',
								from: task.workflow_step ?? 'unknown',
								to: result.nextStep,
								workflowRunId: buildWorkflowRunId(task.id),
							})
						} else if (result.action === 'complete') {
							if (currentStep) {
								await workflowRuntimeStore.recordAdvance(task, workflow, currentStep, result)
							}
							logger.info('orchestrator', `task ${taskId} workflow complete`)
						} else {
							// Can't advance — don't respawn
							logger.info(
								'orchestrator',
								`task ${taskId} done but can't advance: ${result.error ?? 'unknown'}`,
							)
							return
						}
					} else if (task.status === 'blocked') {
						// Check if task has been blocked long enough to escalate
						await this.checkEscalation(task)
						return
					} else if (task.status === 'assigned' || task.status === 'in_progress') {
						result = evaluateTransition(workflow, task, agents)
						if (currentStep) {
							runtimeState = await workflowRuntimeStore.recordEvaluation(
								task,
								workflow,
								currentStep,
								result,
								{
									taskStatus: task.status,
								},
							)
						}
					} else {
						return
					}

					logger.info('orchestrator', `workflow evaluation for ${taskId}`, {
						action: result.action,
						nextStep: result.nextStep,
						assignTo: result.assignTo,
						assignRole: result.assignRole,
						gate: result.gate,
						modelPolicy: result.modelPolicy,
						validationMode: result.validationMode,
						failureAction: result.failureAction,
						workflowRunId: runtimeState?.workflowRun.id ?? buildWorkflowRunId(task.id),
						stepRunId: runtimeState?.stepRun.id,
						error: result.error,
					})
					await this.emitWorkflowEvent(taskId, {
						type: 'workflow_evaluated',
						step: task.workflow_step ?? 'none',
						action: result.action,
						nextStep: result.nextStep,
						workflowId: result.workflowId,
						workflowRunId: runtimeState?.workflowRun.id ?? buildWorkflowRunId(task.id),
						stepRunId: runtimeState?.stepRun.id,
						modelPolicy: result.modelPolicy,
						validationMode: result.validationMode,
						failureAction: result.failureAction,
					})

					// Log notifications based on result
					switch (result.action) {
						case 'assign_agent': {
							const assignedAgentId =
								result.assignTo ?? agents.find((a) => a.role === result.assignRole)?.id
							await notifier.notify({
								type: 'task_assigned',
								title: `Task assigned: ${task.title}`,
								message: `Task ${taskId} assigned to ${assignedAgentId ?? result.assignRole ?? 'unknown'}`,
								priority: task.priority === 'critical' ? 'urgent' : 'normal',
								taskId,
								agentId: assignedAgentId,
							})

							// Actually spawn the agent
							if (assignedAgentId) {
								const agent = agents.find((a) => a.id === assignedAgentId)
								if (agent) {
									const company = await loadCompany(root)
									logger.info(
										'orchestrator',
										`spawning agent: ${agent.id} (${agent.role}) for task ${taskId}`,
										{ modelPolicy: result.modelPolicy ?? 'agent-default' },
									)
									this.guardedSpawn({
										agent,
										company,
										allAgents: agents,
										task,
										storage,
										trigger: { type: 'task_assigned', task_id: taskId },
									})
										?.then((result) => {
											logger.info('orchestrator', `agent ${agent.id} finished`, {
												toolCalls: result.toolCalls,
												error: result.error,
											})
										})
										.catch((err) => {
											logger.error('orchestrator', `agent ${agent.id} failed`, {
												error: err instanceof Error ? err.message : String(err),
											})
										})
								}
							}
							break
						}
						case 'spawn_workflow': {
							if (!currentStep?.spawnWorkflow || !result.workflowId) {
								logger.error(
									'orchestrator',
									`sub-workflow step ${task.workflow_step ?? 'unknown'} is missing workflow config`,
								)
								break
							}

							const resolvedIdempotencyKey = result.idempotencyKey
								? resolveTaskBinding(task, result.idempotencyKey)
								: undefined
							const childTaskId = buildSubWorkflowTaskId(
								task.id,
								currentStep.id,
								result.workflowId,
								resolvedIdempotencyKey,
							)
							const existingChild = await storage.readTask(childTaskId)

							if (existingChild) {
								if (runtimeState?.stepRun) {
									await workflowRuntimeStore.updateStepRun(runtimeState.stepRun.id, {
										status: existingChild.status === 'done' ? 'completed' : 'waiting_child',
										childTaskId,
										childWorkflowId: result.workflowId,
										metadata: { childStatus: existingChild.status },
										completedAt: existingChild.status === 'done' ? new Date().toISOString() : null,
									})
								}
								logger.info('orchestrator', `sub-workflow already exists for ${taskId}`, {
									childTaskId,
									childStatus: existingChild.status,
									workflowId: result.workflowId,
								})
								await this.emitWorkflowEvent(taskId, {
									type: 'sub_workflow_exists',
									step: currentStep.id,
									childTaskId,
									childStatus: existingChild.status,
									workflowId: result.workflowId,
								})

								if (existingChild.status === 'done') {
									const parentAdvance = advanceWorkflow(workflow, task, 'done', agents)
									if (parentAdvance.nextStep && parentAdvance.nextStep !== task.workflow_step) {
										await workflowRuntimeStore.recordAdvance(
											task,
											workflow,
											currentStep,
											parentAdvance,
										)
										await storage.updateTask(
											taskId,
											{ workflow_step: parentAdvance.nextStep },
											'system',
										)
										await storage.moveTask(taskId, 'assigned', 'system')
										eventBus.emit({
											type: 'workflow_advanced',
											taskId,
											from: task.workflow_step ?? 'unknown',
											to: parentAdvance.nextStep,
										})
										await this.emitWorkflowEvent(taskId, {
											type: 'sub_workflow_completed',
											step: currentStep.id,
											childTaskId,
											to: parentAdvance.nextStep,
											workflowRunId: buildWorkflowRunId(task.id),
										})
										this.queueTaskReevaluation(taskId)
									}
								}
								break
							}

							const now = new Date().toISOString()
							const childTask = await storage.createTask({
								id: childTaskId,
								title: `${task.title} / ${currentStep.name ?? currentStep.id}`,
								description: currentStep.instructions || currentStep.description,
								type: task.type,
								status: 'backlog',
								priority: task.priority,
								created_by: 'system',
								parent: task.id,
								workflow: result.workflowId,
								context: this.buildSubWorkflowContext(task, currentStep),
								labels: task.labels,
								project: task.project,
								milestone: task.milestone,
								metadata: {
									parent_task_id: task.id,
									parent_workflow_step: currentStep.id,
									sub_workflow_idempotency_key:
										resolvedIdempotencyKey ?? `${task.id}:${currentStep.id}:${result.workflowId}`,
								},
								created_at: now,
								updated_at: now,
							})

							logger.info('orchestrator', `spawned sub-workflow for ${taskId}`, {
								childTaskId,
								workflowId: result.workflowId,
							})
							if (runtimeState?.stepRun) {
								await workflowRuntimeStore.updateStepRun(runtimeState.stepRun.id, {
									status: 'waiting_child',
									childTaskId,
									childWorkflowId: result.workflowId,
									metadata: { childStatus: childTask.status },
								})
							}
							await this.emitWorkflowEvent(taskId, {
								type: 'sub_workflow_spawned',
								step: currentStep.id,
								childTaskId,
								workflowId: result.workflowId,
								workflowRunId: runtimeState?.workflowRun.id ?? buildWorkflowRunId(task.id),
								stepRunId: runtimeState?.stepRun.id,
							})
							await notifier.notify({
								type: 'task_assigned',
								title: `Sub-workflow spawned: ${childTask.title}`,
								message: `Task ${taskId} spawned child workflow ${result.workflowId} as ${childTaskId}`,
								priority: task.priority === 'critical' ? 'urgent' : 'normal',
								taskId: childTaskId,
							})
							this.queueTaskReevaluation(childTask.id)
							break
						}
						case 'notify_human':
							await notifier.notify({
								type: 'approval_needed',
								title: `Human approval needed: ${task.title}`,
								message: `Task ${taskId} requires human approval at gate: ${result.gate ?? 'unknown'}`,
								priority: 'high',
								taskId,
							})
							break
						case 'complete':
							if (task.status !== 'done') {
								await storage.moveTask(taskId, 'done', 'system')
								task.status = 'done'
							}
							await workflowRuntimeStore.archiveWorkflowRunByTaskId(taskId, 'workflow_completed', {
								final_status: 'completed',
								workflow_step: task.workflow_step,
							})
							await notifier.notify({
								type: 'task_completed',
								title: `Task completed: ${task.title}`,
								message: `Task ${taskId} reached terminal step`,
								priority: 'normal',
								taskId,
							})
							break
						case 'error':
							logger.error('orchestrator', `workflow error for ${taskId}: ${result.error}`)
							break
					}
				} catch (err) {
					logger.error('orchestrator', `failed to evaluate workflow for task ${taskId}`, {
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}
		} finally {
			this.processingTasks.delete(taskId)
		}
	}

	/**
	 * Check if a blocked task should be escalated, reassigned, or left alone.
	 * Uses a lightweight micro-agent classifier. Safe default: do nothing if
	 * the classifier is unavailable.
	 */
	private async checkEscalation(task: import('./fs/storage').Task): Promise<void> {
		// Find the most recent status_change to 'blocked' in history
		const blockedSince = [...(task.history ?? [])]
			.reverse()
			.find(
				(h: { action: string; to?: string }) => h.action === 'status_change' && h.to === 'blocked',
			)
		if (!blockedSince) return

		const blockedAt = new Date(blockedSince.at)
		const blockedMinutes = (Date.now() - blockedAt.getTime()) / 60_000

		// Read escalation threshold from company config (default 30 minutes)
		let threshold = 30
		try {
			const company = await loadCompany(this.options.companyRoot)
			threshold = company.settings.micro_agents.escalation_threshold
		} catch {
			// use default
		}
		if (blockedMinutes < threshold) return

		try {
			const { aiProvider } = await container.resolveAsync([aiProviderFactory])
			const result = await classify(
				aiProvider,
				BLOCKED_TASK_CLASSIFIER,
				JSON.stringify({
					taskId: task.id,
					title: task.title,
					status: task.status,
					blockedMinutes: Math.round(blockedMinutes),
					blockers: task.blockers,
					assignedTo: task.assigned_to,
				}),
			)

			if (!result) return // AI unavailable — do nothing

			if (result.action === 'escalate') {
				// Notify owner/admins about the stuck task
				eventBus.emit({
					type: 'task_changed',
					taskId: task.id,
					status: 'blocked',
				})
				logger.info(
					'orchestrator',
					`escalation: task ${task.id} blocked ${Math.round(blockedMinutes)}min`,
					{
						recommendation: result.action,
						reason: result.reason,
					},
				)
			} else if (result.action === 'reassign' && result.reassign_to) {
				// Auto-reassign to a different agent
				const { storage } = await container.resolveAsync([storageFactory])
				await storage.updateTask(task.id, { assigned_to: result.reassign_to }, 'system')
				logger.info('orchestrator', `escalation: reassigned ${task.id} to ${result.reassign_to}`, {
					reason: result.reason,
				})
			}
			// 'wait' action = do nothing, check again next time
		} catch {
			// Micro-agent failed — no escalation, just log
			logger.warn('orchestrator', `escalation check failed for ${task.id}`)
		}
	}
}
