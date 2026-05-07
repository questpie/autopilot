import { z } from 'zod'

export const WorkspaceInspectionPathQuerySchema = z.object({
	run_id: z.string().min(1),
	path: z.string().optional().default(''),
})

export const WorkspaceInspectionDiffQuerySchema = WorkspaceInspectionPathQuerySchema.extend({
	include_dirty: z
		.enum(['true', 'false'])
		.optional()
		.transform((value) => value === 'true'),
})

export const WorkspaceInspectionStatResponseSchema = z.object({
	run_id: z.string(),
	path: z.string(),
	type: z.enum(['file', 'directory']),
	size: z.number(),
	mime_type: z.string().nullable(),
	writable: z.boolean(),
	etag: z.string().nullable(),
})

export type WorkspaceInspectionStatResponse = z.infer<typeof WorkspaceInspectionStatResponseSchema>

export const WorkspaceInspectionEntrySchema = z.object({
	name: z.string(),
	path: z.string(),
	type: z.enum(['file', 'directory']),
	size: z.number().optional(),
	mime_type: z.string().nullable().optional(),
})

export type WorkspaceInspectionEntry = z.infer<typeof WorkspaceInspectionEntrySchema>

export const WorkspaceInspectionListResponseSchema = z.object({
	run_id: z.string(),
	path: z.string(),
	entries: z.array(WorkspaceInspectionEntrySchema),
})

export type WorkspaceInspectionListResponse = z.infer<typeof WorkspaceInspectionListResponseSchema>

export const WorkspaceInspectionDiffFileSchema = z.object({
	path: z.string(),
	status: z.string(),
	diff: z.string(),
})

export const WorkspaceInspectionGitContextSchema = z.object({
	provider: z.enum(['github', 'gitlab', 'generic-git']),
	remote_url: z.string(),
	web_url: z.string().nullable(),
	default_branch: z.string().nullable(),
	compare_url: z.string().nullable(),
	change_request_kind: z.enum(['pull_request', 'merge_request']).nullable(),
	change_request_url: z.string().nullable(),
})

export type WorkspaceInspectionGitContext = z.infer<typeof WorkspaceInspectionGitContextSchema>

export const WorkspaceInspectionDiffResponseSchema = z.object({
	run_id: z.string(),
	path: z.string(),
	base: z.string(),
	head: z.string(),
	files: z.array(WorkspaceInspectionDiffFileSchema),
	stats: z.object({
		files_changed: z.number(),
		insertions: z.number(),
		deletions: z.number(),
	}),
	git: WorkspaceInspectionGitContextSchema.nullable().optional(),
})

export type WorkspaceInspectionDiffResponse = z.infer<typeof WorkspaceInspectionDiffResponseSchema>
