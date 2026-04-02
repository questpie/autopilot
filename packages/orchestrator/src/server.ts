/**
 * Server bootstrap for the QUESTPIE Autopilot orchestrator.
 *
 * 1. Load dotenv from company root
 * 2. Determine companyRoot (CLI arg or cwd)
 * 3. Create company.db + index.db
 * 4. Load YAML config (agents, workflows, company)
 * 5. Create services
 * 6. Create inference service (if AI_GATEWAY_API_KEY set)
 * 7. Create auth
 * 8. Create Hono app
 * 9. Bun.serve on port 7778
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import dotenv from 'dotenv'
import { createApp } from './api'
import type { Services } from './api/app'
import { createAuth } from './auth'
import { createCompanyDb, createIndexDb } from './db'
import { getEnv } from './env'
import {
	TaskService,
	RunService,
	MessageService,
	WorkerService,
	WorkflowRunService,
	InferenceService,
} from './services'

export interface StartServerOptions {
	/** Absolute path to the company root directory. Defaults to first CLI arg or cwd. */
	companyRoot?: string
	/** HTTP port. Defaults to 7778. */
	port?: number
}

export async function startServer(options?: StartServerOptions) {
	// ── 1. Resolve company root ──────────────────────────────────────────
	const companyRoot = resolve(options?.companyRoot ?? process.argv[2] ?? process.cwd())
	const port = options?.port ?? 7778

	// ── 2. Load .env from company root ───────────────────────────────────
	const envPath = join(companyRoot, '.env')
	if (existsSync(envPath)) {
		dotenv.config({ path: envPath, override: false })
	}

	const env = getEnv()

	console.log(`[server] company root: ${companyRoot}`)
	console.log(`[server] NODE_ENV: ${env.NODE_ENV}`)

	// ── 3. Create databases ──────────────────────────────────────────────
	const { db: companyDb } = await createCompanyDb(companyRoot)
	const { db: _indexDb } = await createIndexDb(companyRoot)

	console.log('[server] databases initialized')

	// ── 4. Create auth ───────────────────────────────────────────────────
	const auth = await createAuth(companyDb, companyRoot)

	// ── 5. Create services ───────────────────────────────────────────────
	const taskService = new TaskService(companyDb)
	const runService = new RunService(companyDb)
	const messageService = new MessageService(companyDb)
	const workerService = new WorkerService(companyDb)
	const workflowRunService = new WorkflowRunService(companyDb)

	// ── 6. Optional inference service ────────────────────────────────────
	let inferenceService: InferenceService | null = null
	if (env.AI_GATEWAY_API_KEY) {
		inferenceService = new InferenceService({
			apiKey: env.AI_GATEWAY_API_KEY,
			gatewayBaseUrl: 'https://ai-gateway.vercel.sh/v1',
			textModel: 'google/gemini-2.5-flash',
			embeddingModel: 'google/gemini-embedding-2',
		})
		console.log('[server] inference service enabled')
	}

	const services: Services = {
		taskService,
		runService,
		messageService,
		workerService,
		workflowRunService,
		inferenceService,
	}

	// ── 7. Create Hono app ───────────────────────────────────────────────
	const app = createApp({
		companyRoot,
		db: companyDb,
		auth,
		services,
		corsOrigin: env.CORS_ORIGIN,
	})

	// ── 8. Start HTTP server ─────────────────────────────────────────────
	const server = Bun.serve({
		fetch: app.fetch,
		port,
		idleTimeout: 255, // max for long-lived SSE connections
	})

	console.log(`[server] listening on http://localhost:${server.port}`)

	return { server, app, services, companyRoot }
}
