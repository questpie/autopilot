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
import { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService, ArtifactService, ConversationBindingService, TaskRelationService, TaskGraphService, ParentJoinBridge, SecretService, QueryService, SessionService } from './services'
import type { AuthoredConfig } from './services'
import { NotificationBridge } from './providers'
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
	const { db: _indexDb } = await createIndexDb(companyRoot)
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
		defaults: resolved.defaults,
	}
	console.log(
		`[server] config loaded: ${resolved.agents.size} agents, ${resolved.workflows.size} workflows, ${resolved.environments.size} environments, ${resolved.providers.size} providers, ${resolved.skills.size} skills, ${resolved.context.size} context files`,
	)

	// ── 5. Create auth ───────────────────────────────────────────────────
	const auth = await createAuth(companyDb, companyRoot)

	// ── 6. Create services + workflow engine ─────────────────────────────
	const taskService = new TaskService(companyDb)
	const runService = new RunService(companyDb)
	const workerService = new WorkerService(companyDb)
	const enrollmentService = new EnrollmentService(companyDb)
	const activityService = new ActivityService(companyDb)
	const artifactService = new ArtifactService(companyDb)
	const conversationBindingService = new ConversationBindingService(companyDb)
	const taskRelationService = new TaskRelationService(companyDb)
	const secretService = new SecretService(companyDb)
	const queryService = new QueryService(companyDb)
	const sessionService = new SessionService(companyDb)

	// ── 6b. Validate master key if shared secrets are in use ────────────
	if (!hasMasterKey()) {
		const hasSharedRefs = [...authoredConfig.providers.values()].some(
			(p) => p.secret_refs.some((r) => r.source === 'shared'),
		)
		const hasStoredSecrets = await secretService.hasAny()

		if (hasSharedRefs || hasStoredSecrets) {
			throw new MasterKeyError(
				'AUTOPILOT_MASTER_KEY is not set but shared secrets are in use.\n' +
				(hasSharedRefs ? '  - Authored config contains source:shared secret refs\n' : '') +
				(hasStoredSecrets ? '  - Encrypted shared secrets exist in the database\n' : '') +
				'Set AUTOPILOT_MASTER_KEY (64-char hex) or remove shared secret usage.\n' +
				'Generate one with: openssl rand -hex 32',
			)
		}
	}

	const workflowEngine = new WorkflowEngine(authoredConfig, taskService, runService, activityService, artifactService)
	const taskGraphService = new TaskGraphService(taskService, taskRelationService, workflowEngine)

	// Wire child rollup into workflow engine (breaks circular init dependency)
	workflowEngine.setChildRollupFn((taskId, relationType) => taskGraphService.childRollup(taskId, relationType))

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
	}

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
	)
	if (authoredConfig.providers.size > 0) {
		notificationBridge.start()
	}

	// ── 7b. Start parent join bridge ────────────────────────────────────
	const parentJoinBridge = new ParentJoinBridge(eventBus, taskRelationService, workflowEngine)
	parentJoinBridge.start()

	// ── 8. Create Hono app ───────────────────────────────────────────────
	const effectiveBypass = options?.allowLocalDevBypass && env.NODE_ENV !== 'production'
	if (options?.allowLocalDevBypass && env.NODE_ENV === 'production') {
		console.warn('[server] ⚠ allowLocalDevBypass requested but ignored in production mode')
	}
	if (effectiveBypass) {
		console.log('[server] local dev bypass ENABLED (development mode only)')
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

	return { server, app, services, companyRoot, auth, db: companyDb, notificationBridge }
}
