import { join } from 'node:path'
import type { Schedule, Webhook } from '@questpie/autopilot-spec'
import { loadCompany, loadAgents } from './fs'
import { reloadRoles } from './auth/roles'
import { spawnAgent } from './agent'
import { evaluateTransition, advanceWorkflow } from './workflow'
import { WorkflowLoader } from './workflow'
import { Watcher } from './watcher'
import type { WatchEvent } from './watcher'
import { Scheduler } from './scheduler'
import { WebhookServer, webhookHandlerRegistry } from './webhook'
import { telegramWebhookHandler } from './webhook'
import { createApp } from './api'
import { eventBus } from './events'
import { GitManager } from './git/git-manager'

import { container, configureContainer } from './container'
import { dbFactory } from './db'
import { authFactory } from './auth'
import { storageFactory } from './fs/sqlite-backend'
import { embeddingServiceFactory } from './embeddings'
import { streamManagerFactory } from './session/stream'
import { indexerFactory } from './db/indexer'
import { notifierFactory } from './notifier'

/** Configuration options for the {@link Orchestrator}. */
export interface OrchestratorOptions {
	/** Absolute path to the company root directory on disk. */
	companyRoot: string
	/** Port for the incoming-webhook HTTP server (default `7777`). */
	webhookPort?: number
	/** Port for the read-only REST API server (default `7778`). */
	apiPort?: number
	/** @deprecated Storage is always SQLite now. */
	storageMode?: 'sqlite'
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
	private webhookServer: WebhookServer | null = null
	private apiServer: ReturnType<typeof Bun.serve> | null = null
	private gitManager: GitManager | null = null
	private running = false
	private activeAgentCount = 0
	private maxConcurrentAgents = 5
	private processingTasks = new Set<string>()

	constructor(private options: OrchestratorOptions) {}

	/**
	 * Boot every subsystem (watcher, scheduler, webhook server, API server).
	 *
	 * The method is idempotent — calling it on an already-running orchestrator
	 * is a no-op.
	 */
	async start(): Promise<void> {
		if (this.running) {
			console.log('[orchestrator] already running')
			return
		}

		const root = this.options.companyRoot

		// Configure DI container with company root
		configureContainer(root)

		// 1. Verify company directory
		let company: Awaited<ReturnType<typeof loadCompany>>
		try {
			company = await loadCompany(root)
			console.log(`[orchestrator] loaded company: ${company.name} (${company.slug})`)
		} catch (err) {
			console.error('[orchestrator] failed to load company.yaml — is this a valid company directory?')
			throw err
		}

		// 2. Resolve core services from container (ordered by deps automatically)
		try {
			await container.resolveAsync([
				storageFactory, dbFactory, authFactory, embeddingServiceFactory
			])
			console.log('[orchestrator] core services initialized')
		} catch (err) {
			console.error('[orchestrator] failed to initialize core services:', err)
		}

		// 3. Indexer (triggers reindexAll inside factory)
		try {
			await container.resolveAsync([indexerFactory])
		} catch (err) {
			console.error('[orchestrator] indexer failed:', err)
		}

		// 4. Notifier + StreamManager
		await container.resolveAsync([notifierFactory, streamManagerFactory])

		// 5. Start watcher
		this.watcher = new Watcher({
			companyRoot: root,
			onEvent: (event) => this.handleWatchEvent(event),
		})
		try {
			await this.watcher.start()
			console.log('[orchestrator] watcher started (watching tasks/, comms/, dashboard/, team/)')
		} catch (err) {
			console.error('[orchestrator] failed to start watcher:', err)
		}

		// 6. Start scheduler
		this.scheduler = new Scheduler({
			companyRoot: root,
			onTrigger: (schedule) => this.handleScheduleTrigger(schedule),
		})
		try {
			await this.scheduler.start()
			const jobs = this.scheduler.getActiveJobs()
			console.log(`[orchestrator] scheduler started (${jobs.length} active jobs)`)
		} catch (err) {
			console.error('[orchestrator] failed to start scheduler:', err)
		}

		// 7. Register webhook handlers
		webhookHandlerRegistry.register(telegramWebhookHandler)

		// 8. Start webhook server
		const port = this.options.webhookPort ?? 7777
		this.webhookServer = new WebhookServer({
			port,
			companyRoot: root,
			onWebhook: (webhook, payload) => this.handleWebhook(webhook, payload),
		})
		try {
			await this.webhookServer.start()
			console.log(`[orchestrator] webhook server started on port ${port}`)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes('EADDRINUSE') || msg.includes('in use')) {
				console.warn(`[orchestrator] webhook port ${port} already in use — skipping (kill the other process or use --webhook-port)`)
			} else {
				console.error('[orchestrator] failed to start webhook server:', msg)
			}
		}

		// 9. Start API server (Hono)
		const apiPort = this.options.apiPort ?? 7778
		const authSettings = company.settings.auth
		try {
			const app = createApp({
				authEnabled: authSettings.enabled,
				corsOrigin: authSettings.cors_origin,
			})
			this.apiServer = Bun.serve({
				port: apiPort,
				fetch: app.fetch,
			})
			console.log(`[orchestrator] api server started on port ${apiPort}`)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes('EADDRINUSE') || msg.includes('in use')) {
				console.warn(`[orchestrator] api port ${apiPort} already in use — skipping (kill the other process or use --api-port)`)
			} else {
				console.error('[orchestrator] failed to start api server:', msg)
			}
		}

		// 10. Initialize GitManager
		try {
			const gitConfig = (company as Record<string, unknown>).settings as Record<string, unknown> | undefined
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
			console.error('[orchestrator] failed to initialize git manager:', err instanceof Error ? err.message : err)
		}

		// 11. Startup scan: process existing tasks from SQLite
		try {
			const { storage } = await container.resolveAsync([storageFactory])
			const activeTasks = await storage.listTasks({ status: 'in_progress' })
			const backlogTasks = await storage.listTasks({ status: 'backlog' })
			const allTasks = [...activeTasks, ...backlogTasks]
			for (const task of allTasks) {
				await this.handleTaskChange(task.id)
			}
			if (allTasks.length > 0) {
				console.log(`[orchestrator] startup scan: processed ${allTasks.length} existing tasks`)
			}
		} catch {
			// storage might not be ready
		}

		this.running = true
		console.log('[orchestrator] startup complete')
	}

	/** Gracefully shut down all subsystems. */
	async stop(): Promise<void> {
		if (!this.running) return

		console.log('[orchestrator] shutting down...')

		if (this.gitManager) {
			try {
				await this.gitManager.stop()
			} catch (err) {
				console.error('[orchestrator] error stopping git manager:', err)
			}
			this.gitManager = null
		}

		if (this.watcher) {
			try {
				await this.watcher.stop()
			} catch (err) {
				console.error('[orchestrator] error stopping watcher:', err)
			}
			this.watcher = null
		}

		if (this.scheduler) {
			try {
				this.scheduler.stop()
			} catch (err) {
				console.error('[orchestrator] error stopping scheduler:', err)
			}
			this.scheduler = null
		}

		if (this.webhookServer) {
			try {
				this.webhookServer.stop()
			} catch (err) {
				console.error('[orchestrator] error stopping webhook server:', err)
			}
			this.webhookServer = null
		}

		if (this.apiServer) {
			try {
				this.apiServer.stop(true)
			} catch (err) {
				console.error('[orchestrator] error stopping api server:', err)
			}
			this.apiServer = null
		}

		// Close storage via container before clearing instances
		try {
			const { storage } = await container.resolveAsync([storageFactory])
			await storage.close()
		} catch (err) {
			console.error('[orchestrator] error closing storage:', err)
		}

		// Clear all cached singleton instances from the container
		container.clearAllInstances()

		this.running = false
		console.log('[orchestrator] shutdown complete')
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

	/** Whether the orchestrator is currently running. */
	isRunning(): boolean {
		return this.running
	}

	private async handleWatchEvent(event: WatchEvent): Promise<void> {
		try {
			switch (event.type) {
				case 'task_changed':
					console.log(`[orchestrator] task changed: ${event.taskId}`)
					await this.handleTaskChange(event.taskId)
					break
				case 'message_received':
					console.log(`[orchestrator] message received in channel: ${event.channel}`)
					await this.handleMessage(event.channel, event.path)
					break
				case 'pin_changed':
					console.log(`[orchestrator] pin changed: ${event.pinId}`)
					break
				case 'dashboard_changed':
					console.log(`[orchestrator] dashboard files changed: ${event.file}`)
					await this.handleDashboardChange()
					break
				case 'config_changed':
					console.log(`[orchestrator] config changed: ${event.file}`)
					if (event.file === 'schedules.yaml' && this.scheduler) {
						console.log('[orchestrator] reloading scheduler...')
						await this.scheduler.reload()
					}
					if (event.file === 'roles.yaml') {
						await reloadRoles(this.options.companyRoot)
						console.log('[orchestrator] roles reloaded')
					}
					break
			}
		} catch (err) {
			console.error(`[orchestrator] error handling watch event (${event.type}):`, err)
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
			console.log('[orchestrator] auto-rebuilding dashboard (prod mode)...')
			try {
				const proc = Bun.spawn(['bunx', 'vite', 'build'], {
					cwd: dashboardDir,
					stdout: 'ignore',
					stderr: 'ignore',
				})
				const exitCode = await proc.exited
				if (exitCode === 0) {
					console.log('[orchestrator] dashboard rebuild complete')
				} else {
					console.error(`[orchestrator] dashboard rebuild failed (exit ${exitCode})`)
				}
			} catch (err) {
				console.error('[orchestrator] dashboard rebuild error:', err instanceof Error ? err.message : err)
			}
		}, 1000)
	}

	private async handleMessage(channel: string, filePath: string): Promise<void> {
		const root = this.options.companyRoot
		try {
			const { readYamlUnsafe } = await import('./fs/yaml')
			const msg = await readYamlUnsafe(filePath) as Record<string, unknown>
			const content = (msg?.content as string) ?? ''
			const from = (msg?.from as string) ?? 'unknown'

			// Check for @mentions — spawn mentioned agent with message context
			const mentionPattern = /@([a-z0-9-]+)/g
			const mentions: string[] = []
			let match: RegExpExecArray | null = mentionPattern.exec(content)
			while (match) {
				mentions.push(match[1]!)
				match = mentionPattern.exec(content)
			}

			if (mentions.length === 0) return

			const agents = await loadAgents(root)
			const company = await loadCompany(root)
			const { storage } = await container.resolveAsync([storageFactory])

			for (const mentionedId of mentions) {
				const agent = agents.find(a => a.id === mentionedId)
				if (!agent) continue
				if (agent.id === from) continue // don't spawn agent that sent the message

				console.log(`[orchestrator] @${mentionedId} mentioned in #${channel} by ${from} — spawning`)
				spawnAgent({
					agent,
					company,
					allAgents: agents,
					storage,
					trigger: { type: 'mention' },
				}).then(result => {
					console.log(`[orchestrator] agent ${agent.id} finished mention response: ${result.toolCalls} tool calls`)
				}).catch(err => {
					console.error(`[orchestrator] agent ${agent.id} failed:`, err instanceof Error ? err.message : err)
				})
			}
		} catch (err) {
			// Ignore parse errors — might be a partial write
		}
	}

	private async handleScheduleTrigger(schedule: Schedule): Promise<void> {
		try {
			console.log(`[orchestrator] schedule triggered: ${schedule.id} (agent: ${schedule.agent})`)

			const { notifier } = await container.resolveAsync([notifierFactory])
			await notifier.notify({
				type: 'task_assigned',
				title: `Schedule triggered: ${schedule.id}`,
				message: `Scheduled task for agent ${schedule.agent}: ${schedule.description}`,
				priority: 'normal',
				agentId: schedule.agent,
			})
		} catch (err) {
			console.error(`[orchestrator] error handling schedule trigger (${schedule.id}):`, err)
		}
	}

	private async handleWebhook(webhook: Webhook, payload: unknown): Promise<void> {
		try {
			console.log(`[orchestrator] webhook received: ${webhook.id} (agent: ${webhook.agent})`)

			const { notifier } = await container.resolveAsync([notifierFactory])

			// Dispatch to registered webhook handlers
			if (webhookHandlerRegistry.has(webhook.id)) {
				const result = await webhookHandlerRegistry.dispatch(webhook.id, payload, {
					companyRoot: this.options.companyRoot,
				})
				if (result.handled) {
					await notifier.notify({
						type: 'alert',
						title: `Webhook handled: ${webhook.id}`,
						message: `Webhook ${webhook.id} routed to agent ${result.agentId ?? 'unknown'}`,
						priority: 'normal',
						agentId: result.agentId,
					})
				}
				return
			}

			await notifier.notify({
				type: 'alert',
				title: `Webhook received: ${webhook.id}`,
				message: `Webhook ${webhook.id} triggered for agent ${webhook.agent}`,
				priority: webhook.action.priority === 'urgent' ? 'urgent' : 'normal',
				agentId: webhook.agent,
			})
		} catch (err) {
			console.error(`[orchestrator] error handling webhook (${webhook.id}):`, err)
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
		// Release lock after a short delay to absorb rapid file changes
		setTimeout(() => this.processingTasks.delete(taskId), 2000)

		const root = this.options.companyRoot
		const { storage } = await container.resolveAsync([storageFactory])
		const { notifier } = await container.resolveAsync([notifierFactory])
		const workflowLoader = new WorkflowLoader(root)

		// 1. Read the task
		const task = await storage.readTask(taskId)
		if (!task) {
			console.log(`[orchestrator] task not found: ${taskId}`)
			return
		}

		console.log(`[orchestrator] processing task: ${task.id} (status: ${task.status}, workflow_step: ${task.workflow_step ?? 'none'})`)

		// 2. If task has a workflow but no step, initialize to first step and continue
		if (task.workflow && !task.workflow_step) {
			try {
				const workflow = await workflowLoader.load(task.workflow)
				const firstStep = workflow.steps[0]
				if (firstStep) {
					await storage.updateTask(taskId, {
						workflow_step: firstStep.id,
						status: 'assigned',
					}, 'system')
					await storage.moveTask(taskId, 'assigned', 'system')
					console.log(`[orchestrator] initialized ${taskId} to workflow step: ${firstStep.id}`)
					// Update local task reference and fall through to evaluation
					task.workflow_step = firstStep.id
					task.status = 'assigned'
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				console.error(`[orchestrator] failed to initialize workflow for ${taskId}: ${msg}`)
				return
			}
		}

		// 3. If task has a workflow and step, evaluate what to do
		if (task.workflow && task.workflow_step) {
			try {
				const workflow = await workflowLoader.load(task.workflow)
				const agents = await loadAgents(root)

				let result: import('./workflow').WorkflowTransitionResult

				if (task.status === 'done') {
					// Task finished current step → advance to next step
					result = advanceWorkflow(workflow, task, 'done', agents)
					if (result.nextStep && result.nextStep !== task.workflow_step) {
						await storage.updateTask(taskId, { workflow_step: result.nextStep, status: 'assigned' }, 'system')
						await storage.moveTask(taskId, 'assigned', 'system')
						eventBus.emit({ type: 'workflow_advanced', taskId, from: task.workflow_step!, to: result.nextStep })
						console.log(`[orchestrator] advanced ${taskId}: ${task.workflow_step} → ${result.nextStep}`)
					} else if (result.action === 'complete') {
						console.log(`[orchestrator] task ${taskId} workflow complete`)
					} else {
						// Can't advance — don't respawn
						console.log(`[orchestrator] task ${taskId} done but can't advance: ${result.error ?? 'unknown'}`)
						return
					}
				} else if (task.status === 'blocked') {
					// Don't respawn blocked tasks
					console.log(`[orchestrator] task ${taskId} is blocked — waiting for human`)
					return
				} else if (task.status === 'assigned' || task.status === 'in_progress') {
					result = evaluateTransition(workflow, task, agents)
				} else {
					return
				}

				console.log(`[orchestrator] workflow evaluation for ${taskId}:`, {
					action: result.action,
					nextStep: result.nextStep,
					assignTo: result.assignTo,
					assignRole: result.assignRole,
					gate: result.gate,
					error: result.error,
				})

				// Log notifications based on result
				switch (result.action) {
					case 'assign_agent': {
						const assignedAgentId = result.assignTo ?? agents.find(a => a.role === result.assignRole)?.id
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
							const agent = agents.find(a => a.id === assignedAgentId)
							if (agent) {
								const company = await loadCompany(root)
								console.log(`[orchestrator] spawning agent: ${agent.id} (${agent.role}) for task ${taskId}`)
								spawnAgent({
									agent,
									company,
									allAgents: agents,
									task,
									storage,
									trigger: { type: 'task_assigned', task_id: taskId },
								}).then(result => {
									console.log(`[orchestrator] agent ${agent.id} finished: ${result.toolCalls} tool calls${result.error ? `, error: ${result.error}` : ''}`)
								}).catch(err => {
									console.error(`[orchestrator] agent ${agent.id} failed:`, err instanceof Error ? err.message : err)
								})
							}
						}
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
						await notifier.notify({
							type: 'task_completed',
							title: `Task completed: ${task.title}`,
							message: `Task ${taskId} reached terminal step`,
							priority: 'normal',
							taskId,
						})
						break
					case 'error':
						console.error(`[orchestrator] workflow error for ${taskId}: ${result.error}`)
						break
				}
			} catch (err) {
				console.error(`[orchestrator] failed to evaluate workflow for task ${taskId}:`, err)
			}
		}
	}
}
