import { z } from 'zod'

// ─── VFS URI ──────────────────────────────────────────────────────────────

export const VfsSchemeSchema = z.enum(['company', 'workspace'])
export type VfsScheme = z.infer<typeof VfsSchemeSchema>

/** Parsed VFS URI. */
export const VfsParsedUriSchema = z.discriminatedUnion('scheme', [
  z.object({
    scheme: z.literal('company'),
    path: z.string(),
  }),
  z.object({
    scheme: z.literal('workspace'),
    runId: z.string(),
    path: z.string(),
  }),
])
export type VfsParsedUri = z.infer<typeof VfsParsedUriSchema>

// ─── Stat ─────────────────────────────────────────────────────────────────

export const VfsStatQuerySchema = z.object({
  uri: z.string().min(1),
})

export const VfsStatResponseSchema = z.object({
  uri: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number(),
  mime_type: z.string().nullable(),
  writable: z.boolean(),
  etag: z.string().nullable(),
})
export type VfsStatResponse = z.infer<typeof VfsStatResponseSchema>

// ─── List ─────────────────────────────────────────────────────────────────

export const VfsListQuerySchema = z.object({
  uri: z.string().min(1),
})

export const VfsListEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
  mime_type: z.string().nullable().optional(),
})
export type VfsListEntry = z.infer<typeof VfsListEntrySchema>

export const VfsListResponseSchema = z.object({
  uri: z.string(),
  entries: z.array(VfsListEntrySchema),
})
export type VfsListResponse = z.infer<typeof VfsListResponseSchema>

// ─── Read ─────────────────────────────────────────────────────────────────
// Read returns raw content with Content-Type header.
// Metadata goes in response headers (X-Vfs-Size, X-Vfs-Etag, X-Vfs-Writable).
// Only need the query schema here.

export const VfsReadQuerySchema = z.object({
  uri: z.string().min(1),
})

// ─── Write ────────────────────────────────────────────────────────────────
// Write accepts raw body with Content-Type. URI and etag in query.
// Only company:// scope in P0.

export const VfsWriteQuerySchema = z.object({
  uri: z.string().min(1),
  /** Optional etag for optimistic concurrency. */
  etag: z.string().optional(),
})

export const VfsWriteResponseSchema = z.object({
  uri: z.string(),
  size: z.number(),
  etag: z.string(),
  written_at: z.string(),
})
export type VfsWriteResponse = z.infer<typeof VfsWriteResponseSchema>

// ─── Diff ─────────────────────────────────────────────────────────────────
// Only workspace:// scope.

export const VfsDiffQuerySchema = z.object({
  uri: z.string().min(1),
  /** Include uncommitted/dirty changes. */
  include_dirty: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
})

export const VfsDiffFileSchema = z.object({
  path: z.string(),
  status: z.string(),
  diff: z.string(),
})

export const VfsDiffResponseSchema = z.object({
  uri: z.string(),
  base: z.string(),
  head: z.string(),
  files: z.array(VfsDiffFileSchema),
  stats: z.object({
    files_changed: z.number(),
    insertions: z.number(),
    deletions: z.number(),
  }),
})
export type VfsDiffResponse = z.infer<typeof VfsDiffResponseSchema>

// ─── Error ────────────────────────────────────────────────────────────────

export const VfsErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum([
    'invalid_uri',
    'not_found',
    'forbidden',
    'read_only',
    'traversal_blocked',
    'path_blocked',
    'etag_mismatch',
    'scope_error',
    'worker_unavailable',
  ]),
})
export type VfsErrorResponse = z.infer<typeof VfsErrorResponseSchema>
