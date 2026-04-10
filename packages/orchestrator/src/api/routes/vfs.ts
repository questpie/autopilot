/**
 * VFS API routes — scope-aware virtual filesystem.
 *
 * GET  /api/vfs/stat?uri=...
 * GET  /api/vfs/list?uri=...
 * GET  /api/vfs/read?uri=...
 * POST /api/vfs/write?uri=...&etag=...
 * GET  /api/vfs/diff?uri=...&include_dirty=true
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import {
  VfsStatQuerySchema,
  VfsReadQuerySchema,
  VfsListQuerySchema,
  VfsWriteQuerySchema,
  VfsDiffQuerySchema,
} from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import {
  VfsUriError,
  VfsSecurityError,
  VfsNotFoundError,
  VfsReadOnlyError,
  VfsEtagMismatchError,
  VfsScopeError,
  VfsWorkerUnavailableError,
} from '../../services/vfs'

// ─── Error mapping ──────────────────────────────────────────────────────────

type VfsErrorClass = new (...args: never[]) => Error & { code: string }

const ERROR_STATUS: Array<[VfsErrorClass, number]> = [
  [VfsUriError, 400],
  [VfsScopeError, 400],
  [VfsSecurityError, 403],
  [VfsReadOnlyError, 403],
  [VfsNotFoundError, 404],
  [VfsEtagMismatchError, 409],
  [VfsWorkerUnavailableError, 502],
]

function vfsErrorResponse(err: unknown): Response {
  for (const [ErrorClass, status] of ERROR_STATUS) {
    if (err instanceof ErrorClass) {
      return Response.json({ error: err.message, code: err.code }, { status })
    }
  }
  const message = err instanceof Error ? err.message : 'internal error'
  return Response.json({ error: message, code: 'scope_error' }, { status: 500 })
}

// ─── Routes ─────────────────────────────────────────────────────────────────

const vfs = new Hono<AppEnv>()

  .get('/stat', zValidator('query', VfsStatQuerySchema), async (c) => {
    try {
      const { uri } = c.req.valid('query')
      const result = await c.get('services').vfsService.stat(uri)
      return c.json(result, 200)
    } catch (err) {
      return vfsErrorResponse(err)
    }
  })

  .get('/list', zValidator('query', VfsListQuerySchema), async (c) => {
    try {
      const { uri } = c.req.valid('query')
      const result = await c.get('services').vfsService.list(uri)
      return c.json(result, 200)
    } catch (err) {
      return vfsErrorResponse(err)
    }
  })

  .get('/read', zValidator('query', VfsReadQuerySchema), async (c) => {
    try {
      const { uri } = c.req.valid('query')
      const result = await c.get('services').vfsService.read(uri)

      return new Response(new Uint8Array(result.content), {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Length': String(result.size),
          'X-Vfs-Size': String(result.size),
          'X-Vfs-Etag': result.etag ?? '',
          'X-Vfs-Writable': result.writable ? 'true' : 'false',
          'X-Vfs-Text': result.isText ? 'true' : 'false',
        },
      })
    } catch (err) {
      return vfsErrorResponse(err)
    }
  })

  .post('/write', zValidator('query', VfsWriteQuerySchema), async (c) => {
    try {
      const { uri, etag } = c.req.valid('query')
      const body = Buffer.from(await c.req.arrayBuffer())
      const result = await c.get('services').vfsService.write(uri, body, etag ? { etag } : undefined)
      return c.json(result, 200)
    } catch (err) {
      return vfsErrorResponse(err)
    }
  })

  .get('/diff', zValidator('query', VfsDiffQuerySchema), async (c) => {
    try {
      const { uri, include_dirty } = c.req.valid('query')
      const result = await c.get('services').vfsService.diff(uri, { includeDirty: include_dirty })
      return c.json(result, 200)
    } catch (err) {
      return vfsErrorResponse(err)
    }
  })

export { vfs }
