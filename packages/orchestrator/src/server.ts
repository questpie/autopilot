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
import { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService, ArtifactService } from './services'
import type { AuthoredConfig } from './services'
import { NotificationBridge } from './providers'
import { eventBus } from './events/event-bus'

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

	const workflowEngine = new WorkflowEngine(authoredConfig, taskService, runService, activityService, artifactService)

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
		workflowEngine,
	}

	// ── 7. Start notification bridge ─────────────────────────────────────
	const orchestratorUrl = env.ORCHESTRATOR_URL ?? `http://localhost:${port}`
	const notificationBridge = new NotificationBridge(
		eventBus,
		authoredConfig,
		runService,
		taskService,
		artifactService,
		{ companyRoot, orchestratorUrl },
	)
	if (authoredConfig.providers.size > 0) {
		notificationBridge.start()
	}

	// ── 8. Create Hono app ───────────────────────────────────────────────
	const app = createApp({
		companyRoot,
		db: companyDb,
		auth,
		services,
		authoredConfig,
		corsOrigin: env.CORS_ORIGIN,
		allowLocalDevBypass: options?.allowLocalDevBypass,
	})

	// ── 9. Start HTTP server ─────────────────────────────────────────────
	const server = Bun.serve({
		fetch: app.fetch,
		port,
		idleTimeout: 255, // max for long-lived SSE connections
	})

	console.log(`[server] listening on http://localhost:${server.port}`)

	return { server, app, services, companyRoot, auth, db: companyDb, notificationBridge }
}
