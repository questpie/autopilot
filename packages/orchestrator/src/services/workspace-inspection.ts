/**
 * Workspace inspection service for read-only project run review.
 *
 * This is intentionally run/path based. Product code must not pass virtual
 * filesystem URIs through this boundary.
 */
import { extname, resolve } from 'node:path'
import type {
	WorkspaceInspectionDiffResponse,
	WorkspaceInspectionEntry,
	WorkspaceInspectionStatResponse,
} from '@questpie/autopilot-spec'

type WorkspaceInspectionStat = Omit<WorkspaceInspectionStatResponse, 'run_id' | 'path'>
type WorkspaceInspectionList = { entries: WorkspaceInspectionEntry[] }
type WorkspaceInspectionDiff = Omit<WorkspaceInspectionDiffResponse, 'run_id' | 'path' | 'git'>

function normalizePath(p: string): string {
	// Remove leading/trailing slashes, collapse double slashes
	return p.replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
}

// ─── Security ───────────────────────────────────────────────────────────────

const BLOCKED_SEGMENTS = new Set([
	'.git',
	'.worktrees',
	'node_modules',
	'dist',
	'build',
	'coverage',
])

const BLOCKED_FILE_PATTERNS = [
	/^\.env($|\.)/, // .env, .env.local, .env.production, etc.
	/\.sqlite3?$/,
	/\.db$/,
]

export class WorkspaceInspectionSecurityError extends Error {
	constructor(
		message: string,
		public readonly code: 'traversal_blocked' | 'path_blocked' | 'forbidden' = 'forbidden',
	) {
		super(message)
		this.name = 'WorkspaceInspectionSecurityError'
	}
}

function isBlockedSegment(name: string): boolean {
	if (BLOCKED_SEGMENTS.has(name)) return true
	return BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(name))
}

export function validatePath(relativePath: string, rootDir: string): string {
	const target = resolve(rootDir, relativePath)
	const resolvedRoot = resolve(rootDir)
	if (!target.startsWith(`${resolvedRoot}/`) && target !== resolvedRoot) {
		throw new WorkspaceInspectionSecurityError('path traversal detected', 'traversal_blocked')
	}

	for (const seg of relativePath.split('/')) {
		if (isBlockedSegment(seg)) {
			throw new WorkspaceInspectionSecurityError(`access to '${seg}' is blocked`, 'path_blocked')
		}
	}

	return target
}

// ─── MIME / text detection ──────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.markdown': 'text/markdown',
	'.openapi': 'application/vnd.oai.openapi+yaml',
	'.json': 'application/json',
	'.yaml': 'application/yaml',
	'.yml': 'application/yaml',
	'.toml': 'application/toml',
	'.xml': 'application/xml',
	'.html': 'text/html',
	'.htm': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.jsx': 'text/javascript',
	'.mjs': 'text/javascript',
	'.ts': 'text/typescript',
	'.tsx': 'text/typescript',
	'.py': 'text/x-python',
	'.rb': 'text/x-ruby',
	'.go': 'text/x-go',
	'.rs': 'text/x-rust',
	'.java': 'text/x-java',
	'.sh': 'text/x-shellscript',
	'.sql': 'text/x-sql',
	'.csv': 'text/csv',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.pdf': 'application/pdf',
	'.zip': 'application/zip',
}

function getMimeType(filePath: string): string {
	const ext = extname(filePath).toLowerCase()
	return MIME_MAP[ext] ?? 'application/octet-stream'
}

// ─── Worker Client interface ────────────────────────────────────────────────

/** Shape returned by the worker /workspaces/:runId/tree endpoint. */
interface WorkerTreeEntry {
	name: string
	type: 'file' | 'directory'
	size?: number
	path: string
}

export interface WorkerConnection {
	baseUrl: string
	token: string
}

export interface WorkerRegistry {
	getWorkerForRun(runId: string): Promise<WorkerConnection | null>
}

/**
 * Default WorkerRegistry that resolves worker connections for runs.
 *
 * In local dev mode (`autopilot start`), a single co-located worker API
 * is registered via setLocalWorker(). The registry checks whether the
 * run's active lease belongs to that worker and returns the connection.
 *
 * Remote workers don't expose callback URLs yet, so non-local workers
 * return null. This is the integration seam for future remote worker support.
 */
export class DefaultWorkerRegistry implements WorkerRegistry {
	private localWorkerId: string | null = null
	private localConnection: WorkerConnection | null = null
	private leaseLookup: ((runId: string) => Promise<{ worker_id: string } | undefined>) | null = null

	/** Wire the lease lookup. Called during server bootstrap. */
	setLeaseLookup(fn: (runId: string) => Promise<{ worker_id: string } | undefined>): void {
		this.leaseLookup = fn
	}

	/** Register the co-located worker API (local dev mode). */
	setLocalWorker(workerId: string, conn: WorkerConnection): void {
		this.localWorkerId = workerId
		this.localConnection = conn
	}

	async getWorkerForRun(runId: string): Promise<WorkerConnection | null> {
		if (!this.leaseLookup) return null

		const lease = await this.leaseLookup(runId)
		if (!lease) return null

		if (this.localConnection && lease.worker_id === this.localWorkerId) {
			return this.localConnection
		}

		// Remote workers don't expose callback URLs yet
		return null
	}
}

export interface ReadResult {
	content: Buffer
	mimeType: string
	size: number
	etag: string | null
	writable: boolean
	isText: boolean
}

// ─── Workspace Inspection Service ───────────────────────────────────────────

export class WorkspaceInspectionService {
	constructor(private workerRegistry: WorkerRegistry) {}

	// ── Stat ────────────────────────────────────────────────────────────────

	async statRun(runId: string, path = ''): Promise<WorkspaceInspectionStat> {
		const relativePath = normalizePath(path)
		return this.workspaceStatInternal(runId, relativePath)
	}

	private async workspaceStatInternal(
		runId: string,
		relativePath: string,
	): Promise<WorkspaceInspectionStat> {
		const conn = await this.getWorkerConnection(runId)

		if (!relativePath) {
			return { type: 'directory', size: 0, mime_type: null, writable: false, etag: null }
		}

		const lastSlash = relativePath.lastIndexOf('/')
		const parentPath = lastSlash >= 0 ? relativePath.slice(0, lastSlash) : ''
		const fileName = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath

		const params: Record<string, string> = {}
		if (parentPath) params.path = parentPath

		const res = await this.workerFetch(conn, `/workspaces/${runId}/tree`, params)
		const entries = (await res.json()) as WorkerTreeEntry[]
		const entry = entries.find((e) => e.name === fileName)

		if (!entry) {
			throw new WorkspaceInspectionNotFoundError(`not found in workspace: ${relativePath}`)
		}

		const isDir = entry.type === 'directory'
		return {
			type: isDir ? 'directory' : 'file',
			size: entry.size ?? 0,
			mime_type: isDir ? null : getMimeType(fileName),
			writable: false,
			etag: null,
		}
	}

	// ── List ────────────────────────────────────────────────────────────────

	async listRun(runId: string, path = ''): Promise<WorkspaceInspectionList> {
		const relativePath = normalizePath(path)
		return this.workspaceListInternal(runId, relativePath)
	}

	private async workspaceListInternal(
		runId: string,
		relativePath: string,
	): Promise<WorkspaceInspectionList> {
		const conn = await this.getWorkerConnection(runId)
		const params: Record<string, string> = {}
		if (relativePath) params.path = relativePath

		const res = await this.workerFetch(conn, `/workspaces/${runId}/tree`, params)
		const workerEntries = (await res.json()) as WorkerTreeEntry[]

		const entries: WorkspaceInspectionEntry[] = workerEntries.map((e) => ({
			name: e.name,
			path: e.path,
			type: e.type as 'file' | 'directory',
			size: e.size,
			mime_type: e.type === 'file' ? getMimeType(e.name) : null,
		}))

		return { entries }
	}

	// ── Read ────────────────────────────────────────────────────────────────

	async readRun(runId: string, path: string): Promise<ReadResult> {
		return this.workspaceReadInternal(runId, normalizePath(path))
	}

	private async workspaceReadInternal(runId: string, relativePath: string): Promise<ReadResult> {
		const conn = await this.getWorkerConnection(runId)
		const res = await this.workerFetch(conn, `/workspaces/${runId}/read`, { path: relativePath })

		const content = Buffer.from(await res.arrayBuffer())
		return {
			content,
			mimeType: res.headers.get('Content-Type') ?? 'application/octet-stream',
			size: Number(res.headers.get('X-Workspace-Inspection-Size') ?? content.length),
			etag: null,
			writable: false,
			isText: res.headers.get('X-Workspace-Inspection-Text') === 'true',
		}
	}

	// ── Diff ────────────────────────────────────────────────────────────────

	async diffRun(
		runId: string,
		path = '',
		options?: { includeDirty?: boolean },
	): Promise<WorkspaceInspectionDiff> {
		const relativePath = normalizePath(path)
		return this.workspaceDiffInternal(runId, relativePath, options)
	}

	private async workspaceDiffInternal(
		runId: string,
		relativePath: string,
		options?: { includeDirty?: boolean },
	): Promise<WorkspaceInspectionDiff> {
		const conn = await this.getWorkerConnection(runId)

		const params: Record<string, string> = {}
		if (relativePath) params.path = relativePath
		if (options?.includeDirty) params.include_dirty = 'true'

		const res = await this.workerFetch(conn, `/workspaces/${runId}/diff`, params)
		const data = (await res.json()) as WorkspaceInspectionDiff

		return data
	}

	// ── Worker helpers ──────────────────────────────────────────────────

	private async getWorkerConnection(runId: string): Promise<WorkerConnection> {
		const conn = await this.workerRegistry.getWorkerForRun(runId)
		if (!conn) {
			throw new WorkspaceInspectionWorkerUnavailableError(`no worker available for run ${runId}`)
		}
		return conn
	}

	private async workerFetch(
		conn: WorkerConnection,
		path: string,
		params?: Record<string, string>,
	): Promise<Response> {
		const url = new URL(path, conn.baseUrl)
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				url.searchParams.set(k, v)
			}
		}
		const res = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${conn.token}` },
		})
		if (!res.ok) {
			const body = (await res.json().catch(() => ({ error: 'unknown' }))) as { error?: string }
			throw new WorkspaceInspectionNotFoundError(body.error ?? `worker request failed: ${path}`)
		}
		return res
	}
}

// ─── Error classes ──────────────────────────────────────────────────────────

export class WorkspaceInspectionNotFoundError extends Error {
	readonly code = 'not_found' as const
	constructor(message: string) {
		super(message)
		this.name = 'WorkspaceInspectionNotFoundError'
	}
}

export class WorkspaceInspectionWorkerUnavailableError extends Error {
	readonly code = 'worker_unavailable' as const
	constructor(message: string) {
		super(message)
		this.name = 'WorkspaceInspectionWorkerUnavailableError'
	}
}
