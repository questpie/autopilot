/**
 * Worker auth middleware — validates machine credentials on worker routes.
 *
 * Resolution:
 * 1. X-Worker-Secret header → validate against machine_secret_hash in workers table
 * 2. X-Local-Dev: true header → allowed ONLY when ALL conditions are met:
 *    - Server started with allowLocalDevBypass=true (only `autopilot start`)
 *    - Request originates from localhost/loopback
 *    Header alone is never enough.
 * 3. No credential → 401
 *
 * Sets c.var.workerId when authenticated (machine auth).
 * Local dev bypass sets workerId to null — route handlers must handle this.
 */

import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'

export interface WorkerAuthOptions {
  /** Only true when server is started in local dev convenience mode. */
  allowLocalDevBypass: boolean
}

function isLocalhostRequest(req: Request): boolean {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]!.trim()
    return first === '127.0.0.1' || first === '::1' || first === 'localhost'
  }
  try {
    const url = new URL(req.url)
    const host = url.hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

export function workerAuthMiddleware(opts: WorkerAuthOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { enrollmentService } = c.get('services')

    // 1. Machine secret authentication
    const workerSecret = c.req.header('x-worker-secret')
    if (workerSecret) {
      const workerId = await enrollmentService.validateMachineSecret(workerSecret)
      if (!workerId) {
        return c.json({ error: 'Invalid worker credential' }, 401)
      }
      c.set('workerId', workerId)
      return next()
    }

    // 2. Local dev bypass — requires server flag + header + localhost
    if (
      opts.allowLocalDevBypass &&
      c.req.header('x-local-dev') === 'true' &&
      isLocalhostRequest(c.req.raw)
    ) {
      c.set('workerId', null)
      return next()
    }

    return c.json({ error: 'Worker authentication required (X-Worker-Secret header)' }, 401)
  })
}
