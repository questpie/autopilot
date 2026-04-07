/**
 * Worker-local Zod schemas for the worker observability API.
 *
 * These are intentionally kept in packages/worker — they describe
 * worker-local read-only responses, NOT cross-boundary contracts.
 * Do not move them into @questpie/autopilot-spec.
 */

import { z } from 'zod'

// ─── Param / Query schemas ─────────────────────────────────────────────────

export const RunIdParamSchema = z.object({
  runId: z.string().min(1),
})

export const DiffQuerySchema = z.object({
  path: z.string().optional(),
  include_dirty: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export const FilesQuerySchema = z.object({
  path: z.string().optional(),
})

// ─── Response schemas ──────────────────────────────────────────────────────

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  uptime_ms: z.number(),
  worker_id: z.string().nullable(),
})

export const RuntimeStatusSchema = z.object({
  runtime: z.string(),
  ready: z.boolean(),
  ready_reason: z.string().nullable(),
  models: z.array(z.string()),
})

export const WorkerStatusSchema = z.object({
  worker_id: z.string().nullable(),
  device_id: z.string(),
  name: z.string(),
  repo_root: z.string().nullable(),
  default_branch: z.string().nullable(),
  runtimes: z.array(RuntimeStatusSchema),
  active_run_id: z.string().nullable(),
  enrolled: z.boolean(),
  tags: z.array(z.string()),
})

export const WorkspaceEntrySchema = z.object({
  run_id: z.string(),
  path: z.string(),
  branch: z.string(),
  created: z.boolean(),
  degraded: z.boolean(),
  status: z.enum(['active', 'retained']),
})

export const ChangedFileSchema = z.object({
  path: z.string(),
  status: z.string(),
  old_path: z.string().optional(),
})

export const DriftSummarySchema = z.object({
  base_branch: z.string(),
  ahead: z.number(),
  behind: z.number(),
  changed_files: z.array(ChangedFileSchema),
  dirty_count: z.number(),
})

export const WorkspaceDetailSchema = WorkspaceEntrySchema.extend({
  drift: DriftSummarySchema.nullable(),
  dirty_files: z.array(z.string()),
})

export const FileDiffSchema = z.object({
  path: z.string(),
  status: z.string(),
  diff: z.string(),
})

export const DiffStatsSchema = z.object({
  files_changed: z.number(),
  insertions: z.number(),
  deletions: z.number(),
})

export const DiffResultSchema = z.object({
  base: z.string(),
  head: z.string(),
  files: z.array(FileDiffSchema),
  stats: DiffStatsSchema,
})

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
})

export const ErrorResponseSchema = z.object({
  error: z.string(),
})

// ─── Inferred types ────────────────────────────────────────────────────────

export type HealthResponse = z.infer<typeof HealthResponseSchema>
export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>
export type WorkerStatus = z.infer<typeof WorkerStatusSchema>
export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>
export type DriftSummary = z.infer<typeof DriftSummarySchema>
export type FileDiff = z.infer<typeof FileDiffSchema>
export type DiffResult = z.infer<typeof DiffResultSchema>
export type FileEntry = z.infer<typeof FileEntrySchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
