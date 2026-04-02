/**
 * Worker auth middleware — validates machine credentials on worker routes.
 *
 * Resolution:
 * 1. X-Worker-Secret header → validate against machine_secret_hash in workers table
 * 2. X-Local-Dev: true header → allowed ONLY when allowLocalDevBypass is explicitly true
 *    (set only by `autopilot start` local convenience mode)
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

    // 2. Local dev bypass — gated behind explicit server-side flag
    if (opts.allowLocalDevBypass) {
      const localDev = c.req.header('x-local-dev')
      if (localDev === 'true') {
        c.set('workerId', null)
        return next()
      }
    }

    return c.json({ error: 'Worker authentication required (X-Worker-Secret header)' }, 401)
  })
}
