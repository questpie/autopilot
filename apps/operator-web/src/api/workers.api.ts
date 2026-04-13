/**
 * Workers API — wired to GET /api/workers.
 *
 * NOTE: This endpoint requires worker auth (X-Worker-Secret), not user session auth.
 * In dev mode (allowLocalDevBypass), requests pass through without auth.
 * In production, this call will fail — the hook handles this gracefully.
 */
import type { Worker, WorkerCapability } from './types'
import { apiFetch } from '@/lib/api-client'

interface WireWorker {
  id: string
  device_id: string
  name: string | null
  status: string
  capabilities: string
  registered_at: string
  last_heartbeat: string | null
  machine_secret_hash: string
}

function isWorkerCapability(item: unknown): item is WorkerCapability {
  if (typeof item !== 'object' || item === null || !('runtime' in item)) return false
  return typeof item.runtime === 'string'
}

function parseCapabilities(json: string): WorkerCapability[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWorkerCapability)
  } catch (_err: unknown) {
    return []
  }
}

function isWorkerStatus(value: string): value is Worker['status'] {
  return value === 'online' || value === 'busy' || value === 'offline'
}

function mapWorker(wire: WireWorker): Worker {
  return {
    id: wire.id,
    name: wire.name,
    status: isWorkerStatus(wire.status) ? wire.status : 'offline',
    capabilities: parseCapabilities(wire.capabilities),
    registered_at: wire.registered_at,
    last_heartbeat: wire.last_heartbeat,
  }
}

export async function getWorkers(): Promise<Worker[]> {
  const data = await apiFetch<WireWorker[]>('/api/workers')
  return data.map(mapWorker)
}
