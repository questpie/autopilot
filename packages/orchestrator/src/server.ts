/**
 * Server bootstrap for the QUESTPIE Autopilot orchestrator.
 *
 * 1. Resolve scopes (.autopilot/company.yaml + .autopilot/project.yaml)
 * 2. Load dotenv from company root
 * 3. Create company.db + index.db
 * 4. Build resolved config (company + project merge)
 * 5. Create services
 * 6. Create auth
 * 7. Create Hono app
 * 8. Bun.serve on port 7778
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import dotenv from 'dotenv'
import { createApp } from './api'
import type { Services } from './api/app'
import { createAuth } from './auth'
import { createCompanyDb, createIndexDb } from './db'
import { getEnv } from './env'
import { discoverScopes, resolveConfig } from './config/scope-resolver'
import { ConfigManager } from './config/config-manager'
import {
	TaskService,
	RunService,
	WorkerService,
	EnrollmentService,
	WorkflowEngine,
	ActivityService,
	ArtifactService,
	ConversationBindingService,
	TaskRelationService,
	TaskGraphService,
	ParentJoinBridge,
	DependencyBridge,
	SecretService,
	QueryService,
	SessionService,
	SessionMessageService,
	ScheduleService,
	SchedulerDaemon,
	ScriptService,
	SteerService,
	VfsService,
	DefaultWorkerRegistry,
} from './services'
import { Indexer } from './services/indexer'
import type { AuthoredConfig } from './services'
import { NotificationBridge, QueryResponseBridge, TaskProgressBridge } from './providers'
import { eventBus } from './events/event-bus'
import { hasMasterKey, MasterKeyError } from './crypto'

export interface StartServerOptions {
	/** Absolute path to start scope discovery from. Defaults to first CLI arg or cwd. */
	companyRoot?: string
	/** HTTP port. Defaults to 7778. */
	port?: number
	/** Allow X-Local-Dev bypass for worker auth. Only for `autopilot start` convenience. */
	allowLocalDevBypass?: boolean
}

export async function startServer(options?: StartServerOptions) {
	const startDir = resolve(options?.companyRoot ?? process.argv[2] ?? process.cwd())
	const port = options?.port ?? 7778

	// ── 1. Discover scopes (.autopilot/company.yaml + .autopilot/project.yaml) ──
	const chain = await discoverScopes(startDir)

	if (!chain.companyRoot) {
		throw new Error(
			`No .autopilot/company.yaml found walking up from ${startDir}.\n` +
				'Create one with: autopilot init',
		)
	}

	const companyRoot = chain.companyRoot

	console.log(`[server] company root: ${companyRoot}`)
	if (chain.projectRoot && chain.projectRoot !== companyRoot) {
		console.log(`[server] project root: ${chain.projectRoot}`)
	}

	// ── 2. Load .env from company root ───────────────────────────────────
	const envPath = join(companyRoot, '.env')
	if (existsSync(envPath)) {
		dotenv.config({ path: envPath, override: false })
	}

	const env = getEnv()
	console.log(`[server] NODE_ENV: ${env.NODE_ENV}`)

	// ── 3. Create databases ──────────────────────────────────────────────
	const { db: companyDb } = await createCompanyDb(companyRoot)
	const { db: indexDb, raw: indexDbRaw } = await createIndexDb(companyRoot)
	console.log('[server] databases initialized')

	// ── 4. Build resolved config (company + project merge) ───────────────
	const resolved = await resolveConfig(chain)

	const authoredConfig: AuthoredConfig = {
		company: resolved.company,
		agents: resolved.agents,
		workflows: resolved.workflows,
		environments: resolved.environments,
		providers: resolved.providers,
		capabilityProfiles: resolved.capabilityProfiles,
		skills: resolved.skills,
		context: resolved.context,
		scripts: resolved.scripts,
		defaults: resolved.defaults,
		queues: resolved.company.queues ?? {},
	}
	console.log(
		`[server] config loaded: ${resolved.agents.size} agents, ${resolved.workflows.size} workflows, ${resolved.environments.size} environments, ${resolved.providers.size} providers, ${resolved.skills.size} skills, ${resolved.context.size} context files, ${resolved.scripts.size} scripts`,
	)

	// ── 5. Create auth ───────────────────────────────────────────────────
	const auth = await createAuth(companyDb, companyRoot)

	// ── 6. Create services + workflow engine ─────────────────────────────
	const taskService = new TaskService(companyDb)
	const runService = new RunService(companyDb)
	const workerService = new WorkerService(companyDb)
	const enrollmentService = new EnrollmentService(companyDb)
	const activityService = new ActivityService(companyDb)
	const { BlobStore } = await import('./services/blob-store')
	const blobStore = new BlobStore(join(companyRoot, '.data'))
	const artifactService = new ArtifactService(companyDb, blobStore)
	taskService.setArtifactService(artifactService)
	const conversationBindingService = new ConversationBindingService(companyDb)
	const taskRelationService = new TaskRelationService(companyDb)
	const secretService = new SecretService(companyDb)
	const queryService = new QueryService(companyDb)
	const sessionService = new SessionService(companyDb)
	const sessionMessageService = new SessionMessageService(companyDb)
	const scheduleService = new ScheduleService(companyDb)
	const scriptService = new ScriptService(authoredConfig)
	const steerService = new SteerService(companyDb)

	const workerRegistry = new DefaultWorkerRegistry()
	const vfsService = new VfsService(companyRoot, workerRegistry)

	// ── 6b. Validate master key if shared secrets are in use ────────────
	if (!hasMasterKey()) {
		const hasSharedRefs = [...authoredConfig.providers.values()].some((p) =>
			p.secret_refs.some((r) => r.source === 'shared'),
		)
		const hasStoredSecrets = await secretService.hasAny()

		if (hasSharedRefs || hasStoredSecrets) {
			throw new MasterKeyError(
				`AUTOPILOT_MASTER_KEY is not set but shared secrets are in use.\n
				${hasSharedRefs ? '  - Authored config contains source:shared secret refs\n' : ''}
				${hasStoredSecrets ? '  - Encrypted shared secrets exist in the database\n' : ''}
				Set AUTOPILOT_MASTER_KEY (64-char hex) or remove shared secret usage.\n
				Generate one with: openssl rand -hex 32`,
			)
		}
	}

	const workflowEngine = new WorkflowEngine(
		authoredConfig,
		taskService,
		runService,
		activityService,
		artifactService,
	)
	const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)

	// Wire child rollup into workflow engine (breaks circular init dependency)
	workflowEngine.setChildRollupFn((taskId, relationType) =>
		taskGraphService.childRollup(taskId, relationType),
	)

	// Validate config references
	const configIssues = workflowEngine.validate()
	for (const issue of configIssues) {
		console.warn(`[server] config warning: ${issue}`)
	}

	const services: Services = {
		taskService,
		runService,
		workerService,
		enrollmentService,
		activityService,
		artifactService,
		conversationBindingService,
		taskRelationService,
		taskGraphService,
		workflowEngine,
		secretService,
		queryService,
		sessionService,
		sessionMessageService,
		scheduleService,
		scriptService,
		steerService,
		vfsService,
	}

	// Wire VFS registry — resolves which worker holds a run's active lease
	workerRegistry.setLeaseLookup((runId) => workerService.findActiveLeaseByRunId(runId))

	// ── 7. Start notification bridge ─────────────────────────────────────
	const orchestratorUrl = env.ORCHESTRATOR_URL ?? `http://localhost:${port}`

	if (!env.ORCHESTRATOR_URL && env.NODE_ENV === 'production') {
		console.warn(
			'[server] ⚠ ORCHESTRATOR_URL not set in production — preview links, notification URLs, and email links will point to localhost.\n' +
				'         Set ORCHESTRATOR_URL to the public base URL of this orchestrator (e.g. https://autopilot.example.com).',
		)
	}
	const notificationBridge = new NotificationBridge(
		eventBus,
		authoredConfig,
		runService,
		taskService,
		artifactService,
		conversationBindingService,
		{ companyRoot, orchestratorUrl },
		secretService,
		sessionService,
		sessionMessageService,
	)
	const queryResponseBridge = new QueryResponseBridge(
		eventBus,
		authoredConfig,
		queryService,
		runService,
		sessionService,
		{ companyRoot, orchestratorUrl },
		secretService,
		sessionMessageService,
		artifactService,
	)
	const taskProgressBridge = new TaskProgressBridge(
		eventBus,
		authoredConfig,
		runService,
		taskService,
		artifactService,
		conversationBindingService,
		{ companyRoot, orchestratorUrl },
		secretService,
		sessionService,
		sessionMessageService,
	)
	if (authoredConfig.providers.size > 0) {
		notificationBridge.start()
		queryResponseBridge.start()
		taskProgressBridge.start()
	}

	// ── 7b. Start parent join bridge ────────────────────────────────────
	const parentJoinBridge = new ParentJoinBridge(eventBus, taskRelationService, workflowEngine)
	parentJoinBridge.start()

	// ── 7b2. Start dependency bridge ────────────────────────────────────
	const dependencyBridge = new DependencyBridge(
		eventBus,
		taskRelationService,
		taskService,
		workflowEngine,
	)
	dependencyBridge.start()

	// Wire dependency check into workflow engine
	workflowEngine.setCheckDependenciesFn((taskId) => dependencyBridge.checkDependencies(taskId))

	// ── 7c. Start scheduler daemon ─────────────────────────────────────
	const schedulerDaemon = new SchedulerDaemon(
		scheduleService,
		workflowEngine,
		queryService,
		runService,
		activityService,
		authoredConfig,
	)
	schedulerDaemon.start()

	// ── 7d. Start search indexer ──────────────────────────────────────
	const indexer = new Indexer({ companyDb, indexDb, authoredConfig })
	indexer.start().catch((err) => {
		console.error(
			'[server] indexer startup error:',
			err instanceof Error ? err.message : String(err),
		)
	})

	// ── 8. Config hot reload manager ────────────────────────────────────
	const configManager = new ConfigManager(authoredConfig, {
		companyRoot,
		onReload: (_cfg) => {
			workflowEngine.refreshDefaults()
			const issues = workflowEngine.validate()
			for (const issue of issues) {
				console.warn(`[config] post-reload warning: ${issue}`)
			}
		},
	})

	// ── 9. Create Hono app ───────────────────────────────────────────────
	const effectiveBypass = options?.allowLocalDevBypass && env.NODE_ENV !== 'production'
	if (options?.allowLocalDevBypass) {
		console.log(
			effectiveBypass
				? '[server] local dev bypass ENABLED (development mode only)'
				: '[server] ⚠ allowLocalDevBypass requested but ignored in production mode',
		)
	}

	const app = createApp({
		companyRoot,
		db: companyDb,
		auth,
		services,
		authoredConfig,
		corsOrigin: env.CORS_ORIGIN,
		allowLocalDevBypass: effectiveBypass,
		orchestratorUrl,
		indexDbRaw,
		operatorWebDist: resolve(import.meta.dir, '..', '..', '..', 'apps', 'operator-web', 'dist'),
		configManager,
	})

	// ── 9. Start HTTP server ─────────────────────────────────────────────
	const server = Bun.serve({
		fetch: app.fetch,
		port,
		idleTimeout: 255, // max for long-lived SSE connections
	})

	console.log(`[server] listening on http://localhost:${server.port}`)
	if (env.ORCHESTRATOR_URL) {
		console.log(`[server] canonical URL: ${env.ORCHESTRATOR_URL}`)
	}

	// ── 10. Startup recovery for stale leases/workers from previous instance ──
	const failRunOnExpiry = async (runId: string) => {
		await runService.complete(runId, {
			status: 'failed',
			error: 'lease expired (orchestrator restart recovery)',
		})
		eventBus.emit({ type: 'run_completed', runId, status: 'failed' })
	}

	try {
		const staleWorkerIds = await workerService.expireStale(90_000)
		if (staleWorkerIds.length > 0) {
			console.log(
				`[server] startup recovery: marked ${staleWorkerIds.length} stale worker(s) offline`,
			)
		}
		const leaseRecovery = await workerService.expireStaleAndRecover(failRunOnExpiry)
		if (leaseRecovery.failedRunIds.length > 0) {
			console.log(
				`[server] startup recovery: failed ${leaseRecovery.failedRunIds.length} run(s) from expired leases`,
			)
		}
	} catch (err) {
		console.error(
			'[server] startup recovery error:',
			err instanceof Error ? err.message : String(err),
		)
	}

	// ── 11. Periodic lease/worker expiry timer (every 60s) ──────────────────
	const leaseExpiryTimer = setInterval(async () => {
		try {
			await workerService.expireStale(90_000)
			const result = await workerService.expireStaleAndRecover(async (runId) => {
				await runService.complete(runId, {
					status: 'failed',
					error: 'lease expired (periodic cleanup)',
				})
				eventBus.emit({ type: 'run_completed', runId, status: 'failed' })
			})
			if (result.failedRunIds.length > 0) {
				console.log(
					`[server] periodic cleanup: failed ${result.failedRunIds.length} run(s), recovered ${result.recoveredWorkerIds.length} worker(s)`,
				)
			}
		} catch (err) {
			console.error(
				'[server] periodic lease expiry error:',
				err instanceof Error ? err.message : String(err),
			)
		}
	}, 60_000)

	// Ensure timer doesn't prevent process exit
	leaseExpiryTimer.unref()

	// ── 12. Start config file watcher ───────────────────────────────────
	configManager.startWatching(chain)

	// ── Stop function for graceful shutdown ─────────────────────────────
	const stop = () => {
		schedulerDaemon.stop()
		indexer.stop()
		notificationBridge.stop()
		queryResponseBridge.stop()
		taskProgressBridge.stop()
		parentJoinBridge.stop()
		dependencyBridge.stop()
		clearInterval(leaseExpiryTimer)
		configManager.stop()
		if (indexDbRaw && typeof indexDbRaw.close === 'function') {
			indexDbRaw.close()
		}
		server.stop()
	}

	return {
		server,
		app,
		services,
		companyRoot,
		auth,
		db: companyDb,
		workerRegistry,
		notificationBridge,
		schedulerDaemon,
		configManager,
		stop,
	}
}
