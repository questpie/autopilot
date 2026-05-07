/**
 * Workspace inspection API — read-only project git run/diff inspection.
 */
import {
	WorkspaceInspectionDiffQuerySchema,
	WorkspaceInspectionPathQuerySchema,
} from '@questpie/autopilot-spec'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { buildGitDiffContext } from '../../services/git-providers'
import {
	WorkspaceInspectionNotFoundError,
	WorkspaceInspectionSecurityError,
	WorkspaceInspectionWorkerUnavailableError,
} from '../../services/workspace-inspection'
import type { AppEnv } from '../app'

type WorkspaceInspectionErrorClass = new (...args: never[]) => Error & { code: string }

const ERROR_STATUS: Array<[WorkspaceInspectionErrorClass, number]> = [
	[WorkspaceInspectionSecurityError, 403],
	[WorkspaceInspectionNotFoundError, 404],
	[WorkspaceInspectionWorkerUnavailableError, 502],
]

function errorResponse(err: unknown): Response {
	for (const [ErrorClass, status] of ERROR_STATUS) {
		if (err instanceof ErrorClass) {
			return Response.json({ error: err.message, code: err.code }, { status })
		}
	}
	const message = err instanceof Error ? err.message : 'internal error'
	return Response.json({ error: message, code: 'workspace_inspection_error' }, { status: 500 })
}

function normalizePath(path?: string): string {
	return (path ?? '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
}

async function resolveRunGitContext(
	services: AppEnv['Variables']['services'],
	runId: string,
	base: string,
	head: string,
) {
	const run = await services.runService?.get(runId)
	if (!run?.project_id || !services.projectService) return null

	const project = await services.projectService.get(run.project_id)
	if (!project) return null

	return buildGitDiffContext({
		remoteUrl: project.git_remote,
		defaultBranch: project.default_branch,
		base,
		head,
	})
}

const workspaceInspection = new Hono<AppEnv>()
	.get('/stat', zValidator('query', WorkspaceInspectionPathQuerySchema), async (c) => {
		try {
			const { run_id, path } = c.req.valid('query')
			const normalizedPath = normalizePath(path)
			const result = await c
				.get('services')
				.workspaceInspectionService.statRun(run_id, normalizedPath)
			return c.json(
				{
					run_id,
					path: normalizedPath,
					type: result.type,
					size: result.size,
					mime_type: result.mime_type,
					writable: result.writable,
					etag: result.etag,
				},
				200,
			)
		} catch (err) {
			return errorResponse(err)
		}
	})
	.get('/list', zValidator('query', WorkspaceInspectionPathQuerySchema), async (c) => {
		try {
			const { run_id, path } = c.req.valid('query')
			const normalizedPath = normalizePath(path)
			const result = await c
				.get('services')
				.workspaceInspectionService.listRun(run_id, normalizedPath)
			return c.json({ run_id, path: normalizedPath, entries: result.entries }, 200)
		} catch (err) {
			return errorResponse(err)
		}
	})
	.get('/read', zValidator('query', WorkspaceInspectionPathQuerySchema), async (c) => {
		try {
			const { run_id, path } = c.req.valid('query')
			const normalizedPath = normalizePath(path)
			const result = await c
				.get('services')
				.workspaceInspectionService.readRun(run_id, normalizedPath)

			return new Response(new Uint8Array(result.content), {
				status: 200,
				headers: {
					'Content-Type': result.mimeType,
					'Content-Length': String(result.size),
					'X-Workspace-Inspection-Size': String(result.size),
					'X-Workspace-Inspection-Etag': result.etag ?? '',
					'X-Workspace-Inspection-Writable': result.writable ? 'true' : 'false',
					'X-Workspace-Inspection-Text': result.isText ? 'true' : 'false',
				},
			})
		} catch (err) {
			return errorResponse(err)
		}
	})
	.get('/diff', zValidator('query', WorkspaceInspectionDiffQuerySchema), async (c) => {
		try {
			const { run_id, path, include_dirty } = c.req.valid('query')
			const normalizedPath = normalizePath(path)
			const result = await c
				.get('services')
				.workspaceInspectionService.diffRun(run_id, normalizedPath, { includeDirty: include_dirty })
			const git = await resolveRunGitContext(c.get('services'), run_id, result.base, result.head)

			return c.json(
				{
					run_id,
					path: normalizedPath,
					base: result.base,
					head: result.head,
					files: result.files,
					stats: result.stats,
					git,
				},
				200,
			)
		} catch (err) {
			return errorResponse(err)
		}
	})

export { workspaceInspection }
