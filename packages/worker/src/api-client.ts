/**
 * Typed client helper for the worker observability API.
 *
 * Usage:
 *   const client = createWorkerApiClient('http://localhost:7779', token)
 *   const health = await client.health.$get()
 *   const res = await health.json()
 */

import { hc } from 'hono/client'
import type { WorkerApiAppType } from './api'

export function createWorkerApiClient(baseUrl: string, token: string) {
  return hc<WorkerApiAppType>(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
