/**
 * Worker App API — minimal read-only observability surface.
 *
 * This is NOT a second orchestrator. It is a small API that lets the future
 * worker app inspect worker-local state: runtime readiness, workspaces,
 * git drift, and file listings.
 *
 * Auth: simple bearer token generated at startup.
 * All endpoints are read-only.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { validator as zValidator } from 'hono-openapi'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { WorkspaceManager } from './workspace'
import type { ResolvedRuntime } from './runtime-config'
import {
	RunIdParamSchema,
	DiffQuerySchema,
	FilesQuerySchema,
	type RuntimeStatus,
	type WorkerStatus,
	type WorkspaceEntry,
	type WorkspaceDetail,
	type FileDiff,
	type DiffResult,
	type DriftSummary,
	type FileEntry,
} from './api-schemas'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkerApiConfig {
	/** Port to listen on. Default 7779. */
	port?: number
	/** CORS origins. Default localhost:3000,3001. */
	corsOrigin?: string[]
	/** Pre-set token. If omitted, a random one is generated. */
	token?: string
}

export interface WorkerApiDeps {
	workerId: string | null
	deviceId: string
	name: string
	repoRoot: string | null
	tags: string[]
	isLocalDev: boolean
	getActiveRunId: () => string | null
	getResolvedRuntimes: () => ReadonlyArray<ResolvedRuntime>
	getWorkspace: () => WorkspaceManager | null
}

// ─── Git helpers ────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
	const result = Bun.spawnSync(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		ok: result.exitCode === 0,
		stdout: result.stdout.toString().trim(),
		stderr: result.stderr.toString().trim(),
	}
}

function getDefaultBranch(repoRoot: string): string | null {
	// Try symbolic-ref to origin/HEAD
	const ref = git(['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'], repoRoot)
	if (ref.ok && ref.stdout) {
		// Returns "origin/main" — strip the "origin/" prefix
		return ref.stdout.replace(/^origin\//, '')
	}
	// Fallback: check if "main" branch exists
	const mainCheck = git(['rev-parse', '--verify', 'main'], repoRoot)
	if (mainCheck.ok) return 'main'
	// Fallback: check if "master" branch exists
	const masterCheck = git(['rev-parse', '--verify', 'master'], repoRoot)
	if (masterCheck.ok) return 'master'
	return null
}

function getCurrentBranch(cwd: string): string {
	const result = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
	return result.ok ? result.stdout : ''
}

function getAheadBehind(cwd: string, base: string): { ahead: number; behind: number } {
	const result = git(['rev-list', '--left-right', '--count', `${base}...HEAD`], cwd)
	if (!result.ok) return { ahead: 0, behind: 0 }
	const parts = result.stdout.split(/\s+/)
	return {
		behind: Number.parseInt(parts[0] ?? '0', 10) || 0,
		ahead: Number.parseInt(parts[1] ?? '0', 10) || 0,
	}
}

function getChangedFiles(
	cwd: string,
	base: string,
): { path: string; status: string; old_path?: string }[] {
	const result = git(['diff', '--name-status', `${base}...HEAD`], cwd)
	if (!result.ok || !result.stdout) return []
	return result.stdout.split('\n').map((line) => {
		const parts = line.split('\t')
		const status = parts[0] ?? ''
		if (status.startsWith('R')) {
			return { path: parts[2] ?? '', status: 'R', old_path: parts[1] }
		}
		return { path: parts[1] ?? '', status: status.charAt(0) }
	})
}

function getDirtyFiles(cwd: string): string[] {
	const result = git(['status', '--porcelain'], cwd)
	if (!result.ok || !result.stdout) return []
	return result.stdout.split('\n').map((line) => line.slice(3))
}

function getDiffText(cwd: string, base: string, filePath?: string): string {
	const args = ['diff', `${base}...HEAD`]
	if (filePath) args.push('--', filePath)
	const result = git(args, cwd)
	return result.ok ? result.stdout : ''
}

function getDiffStats(
	cwd: string,
	base: string,
): { files_changed: number; insertions: number; deletions: number } {
	const result = git(['diff', '--numstat', `${base}...HEAD`], cwd)
	if (!result.ok || !result.stdout) return { files_changed: 0, insertions: 0, deletions: 0 }
	let insertions = 0
	let deletions = 0
	let files = 0
	for (const line of result.stdout.split('\n')) {
		const match = line.match(/^(\d+|-)\s+(\d+|-)\s+/)
		if (match) {
			files++
			if (match[1] !== '-') insertions += Number.parseInt(match[1]!, 10) || 0
			if (match[2] !== '-') deletions += Number.parseInt(match[2]!, 10) || 0
		}
	}
	return { files_changed: files, insertions, deletions }
}

// ─── Token generation ───────────────────────────────────────────────────────

function generateToken(): string {
	const bytes = new Uint8Array(32)
	crypto.getRandomValues(bytes)
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── API Factory ────────────────────────────────────────────────────────────

export function createWorkerApi(deps: WorkerApiDeps, config?: WorkerApiConfig) {
	const token = config?.token ?? generateToken()
	const port = config?.port ?? 7779
	const corsOrigin = config?.corsOrigin ?? ['http://localhost:3000', 'http://localhost:3001']

	const app = new Hono()

	app.use(
		'*',
		cors({
			origin: corsOrigin,
			allowMethods: ['GET', 'OPTIONS'],
			allowHeaders: ['Authorization'],
			credentials: true,
		}),
	)

	// Auth middleware — all routes require bearer token
	app.use('*', async (c, next) => {
		// Skip OPTIONS preflight
		if (c.req.method === 'OPTIONS') return next()

		const authHeader = c.req.header('Authorization')
		if (!authHeader || authHeader !== `Bearer ${token}`) {
			return c.json({ error: 'unauthorized' }, 401)
		}
		return next()
	})

	// ── Typed route chain for Hono client inference ─────────────────────────

	const typedApp = app

		// ── GET /health ───────────────────────────────────────────────────────
		.get('/health', (c) => {
			return c.json({
				ok: true as const,
				uptime_ms: Math.floor(process.uptime() * 1000),
				worker_id: deps.workerId,
			})
		})

		// ── GET /status ───────────────────────────────────────────────────────
		.get('/status', (c) => {
			const runtimes = deps.getResolvedRuntimes().map(checkRuntimeStatus)
			const defaultBranch = deps.repoRoot ? getDefaultBranch(deps.repoRoot) : null

			const status: WorkerStatus = {
				worker_id: deps.workerId,
				device_id: deps.deviceId,
				name: deps.name,
				repo_root: deps.repoRoot,
				default_branch: defaultBranch,
				runtimes,
				active_run_id: deps.getActiveRunId(),
				enrolled: !deps.isLocalDev,
				tags: deps.tags,
			}
			return c.json(status, 200)
		})

		// ── GET /workspaces ───────────────────────────────────────────────────
		.get('/workspaces', (c) => {
			const workspace = deps.getWorkspace()
			if (!workspace) {
				return c.json([] as WorkspaceEntry[], 200)
			}

			const entries = listWorkspaces(workspace, deps.getActiveRunId())
			return c.json(entries, 200)
		})

		// ── GET /workspaces/:runId ────────────────────────────────────────────
		.get('/workspaces/:runId', zValidator('param', RunIdParamSchema), (c) => {
			const workspace = deps.getWorkspace()
			if (!workspace) {
				return c.json({ error: 'no workspace manager configured' }, 404)
			}

			const { runId } = c.req.valid('param')
			if (!workspace.exists(runId)) {
				return c.json({ error: `workspace for run ${runId} not found` }, 404)
			}

			const wtPath = workspace.worktreePath(runId)
			const branch = workspace.branchName(runId)
			const activeRunId = deps.getActiveRunId()
			const baseBranch = deps.repoRoot ? (getDefaultBranch(deps.repoRoot) ?? 'main') : 'main'

			const dirty = getDirtyFiles(wtPath)
			const drift = getDriftSummary(wtPath, baseBranch)

			const detail: WorkspaceDetail = {
				run_id: runId,
				path: wtPath,
				branch,
				created: false,
				degraded: false,
				status: activeRunId === runId ? 'active' : 'retained',
				drift,
				dirty_files: dirty,
			}

			return c.json(detail, 200)
		})

		// ── GET /workspaces/:runId/diff ───────────────────────────────────────
		.get(
			'/workspaces/:runId/diff',
			zValidator('param', RunIdParamSchema),
			zValidator('query', DiffQuerySchema),
			(c) => {
				const workspace = deps.getWorkspace()
				if (!workspace) {
					return c.json({ error: 'no workspace manager configured' }, 404)
				}

				const { runId } = c.req.valid('param')
				if (!workspace.exists(runId)) {
					return c.json({ error: `workspace for run ${runId} not found` }, 404)
				}

				const wtPath = workspace.worktreePath(runId)
				const baseBranch = deps.repoRoot ? (getDefaultBranch(deps.repoRoot) ?? 'main') : 'main'
				const headBranch = getCurrentBranch(wtPath)

				const { path: filePath, include_dirty: includeDirty } = c.req.valid('query')

				const changedFiles = getChangedFiles(wtPath, baseBranch)
				const stats = getDiffStats(wtPath, baseBranch)

				let files: FileDiff[]
				if (filePath) {
					const diffText = getDiffText(wtPath, baseBranch, filePath)
					const fileStatus = changedFiles.find((f) => f.path === filePath)?.status ?? 'M'
					files = [{ path: filePath, status: fileStatus, diff: diffText }]
				} else {
					files = changedFiles.map((f) => ({
						path: f.path,
						status: f.status,
						diff: getDiffText(wtPath, baseBranch, f.path),
					}))
				}

				if (includeDirty) {
					const dirtyFiles = getDirtyFiles(wtPath)
					for (const df of dirtyFiles) {
						if (!files.some((f) => f.path === df)) {
							const dirtyDiff = git(['diff', '--', df], wtPath)
							files.push({ path: df, status: 'M', diff: dirtyDiff.ok ? dirtyDiff.stdout : '' })
						}
					}
				}

				const result: DiffResult = {
					base: baseBranch,
					head: headBranch,
					files,
					stats,
				}

				return c.json(result, 200)
			},
		)

		// ── GET /workspaces/:runId/files ──────────────────────────────────────
		.get(
			'/workspaces/:runId/files',
			zValidator('param', RunIdParamSchema),
			zValidator('query', FilesQuerySchema),
			async (c) => {
				const workspace = deps.getWorkspace()
				if (!workspace) {
					return c.json({ error: 'no workspace manager configured' }, 404)
				}

				const { runId } = c.req.valid('param')
				if (!workspace.exists(runId)) {
					return c.json({ error: `workspace for run ${runId} not found` }, 404)
				}

				const wtPath = workspace.worktreePath(runId)
				const { path: subPath = '' } = c.req.valid('query')

				// Prevent path traversal
				const targetDir = join(wtPath, subPath)
				const resolved = resolve(targetDir)
				const resolvedRoot = resolve(wtPath)
				if (!resolved.startsWith(resolvedRoot)) {
					return c.json({ error: 'path traversal not allowed' }, 400)
				}

				if (!existsSync(targetDir)) {
					return c.json({ error: 'directory not found' }, 404)
				}

				const dirStat = await stat(targetDir)
				if (!dirStat.isDirectory()) {
					return c.json({ error: 'path is not a directory' }, 400)
				}

				const dirEntries = await readdir(targetDir, { withFileTypes: true })
				const entries: FileEntry[] = []

				for (const entry of dirEntries) {
					// Skip hidden files/directories (.git, .worktrees, etc.)
					if (entry.name.startsWith('.')) continue

					const entryPath = relative(wtPath, join(targetDir, entry.name))
					if (entry.isDirectory()) {
						entries.push({ name: entry.name, path: entryPath, type: 'directory' })
					} else if (entry.isFile()) {
						const fileStat = await stat(join(targetDir, entry.name))
						entries.push({ name: entry.name, path: entryPath, type: 'file', size: fileStat.size })
					}
				}

				// Sort: directories first, then alphabetical
				entries.sort((a, b) => {
					if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
					return a.name.localeCompare(b.name)
				})

				return c.json(entries, 200)
			},
		)

	return { app: typedApp, token, port }
}

/** App type for hc<> typed client inference. */
export type WorkerApiAppType = ReturnType<typeof createWorkerApi>['app']

// ─── Helpers ────────────────────────────────────────────────────────────────

function listWorkspaces(workspace: WorkspaceManager, activeRunId: string | null): WorkspaceEntry[] {
	const repoRoot = workspace.repoRoot
	const result = git(['worktree', 'list', '--porcelain'], repoRoot)
	if (!result.ok) return []

	const entries: WorkspaceEntry[] = []
	// Split into worktree blocks separated by blank lines
	const blocks = result.stdout.split('\n\n').filter(Boolean)

	for (const block of blocks) {
		let path = ''
		let branch = ''
		for (const line of block.split('\n')) {
			if (line.startsWith('worktree ')) {
				path = line.slice('worktree '.length)
			} else if (line.startsWith('branch ')) {
				branch = line.slice('branch '.length).replace('refs/heads/', '')
			}
		}

		// Only include autopilot-managed worktrees
		if (path && branch.startsWith('autopilot/')) {
			const runId = branch.replace('autopilot/', '')
			entries.push({
				run_id: runId,
				path,
				branch,
				created: false,
				degraded: false,
				status: activeRunId === runId ? 'active' : 'retained',
			})
		}
	}

	return entries
}

function checkRuntimeStatus(rt: ResolvedRuntime): RuntimeStatus {
	let ready = true
	let ready_reason: string | null = null
	try {
		const check = Bun.spawnSync([rt.resolvedBinaryPath, '--version'], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		if (check.exitCode !== 0) {
			ready = false
			ready_reason = `binary at ${rt.resolvedBinaryPath} returned exit code ${check.exitCode}`
		}
	} catch {
		ready = false
		ready_reason = `binary at ${rt.resolvedBinaryPath} not executable`
	}
	return {
		runtime: rt.config.runtime,
		ready,
		ready_reason,
		models: rt.capability.models,
	}
}

function getDriftSummary(wtPath: string, baseBranch: string): DriftSummary | null {
	const branch = getCurrentBranch(wtPath)
	if (!branch) return null

	const { ahead, behind } = getAheadBehind(wtPath, baseBranch)
	const changedFiles = getChangedFiles(wtPath, baseBranch)
	const dirtyCount = getDirtyFiles(wtPath).length

	return {
		base_branch: baseBranch,
		ahead,
		behind,
		changed_files: changedFiles,
		dirty_count: dirtyCount,
	}
}

// ─── Server lifecycle ───────────────────────────────────────────────────────

export interface WorkerApiServer {
	/** The bearer token for authentication. */
	token: string
	/** The port the server is listening on. */
	port: number
	/** Stop the API server. */
	stop: () => void
}

/**
 * Start the worker API HTTP server.
 * Returns the token and a stop function.
 */
export function startWorkerApi(deps: WorkerApiDeps, config?: WorkerApiConfig): WorkerApiServer {
	const { app, token, port } = createWorkerApi(deps, config)

	const server = Bun.serve({
		fetch: app.fetch,
		port,
		reusePort: true,
	})

	console.log(`[worker-api] listening on http://localhost:${server.port}`)
	console.log(`[worker-api] bearer token: ${token}`)

	return {
		token,
		port: server.port ?? port,
		stop: () => server.stop(),
	}
}
