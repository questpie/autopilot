/**
 * Workers API — wired to GET /api/workers.
 *
 * NOTE: This endpoint requires worker auth (X-Worker-Secret), not user session auth.
 * In dev mode (allowLocalDevBypass), requests pass through without auth.
 * In production, this call will fail — the hook handles this gracefully.
 */
import type { Worker, WorkerCapability } from './types'
import { api } from '@/lib/api'

interface WireWorker {
  id: string
  device_id: string | null
  name: string | null
  status: string
  capabilities: string | null
  registered_at: string
  last_heartbeat: string | null
  machine_secret_hash: string | null
}

function isWorkerCapability(item: unknown): item is WorkerCapability {
  if (typeof item !== 'object' || item === null || !('runtime' in item)) return false
  return typeof item.runtime === 'string'
}

function parseCapabilities(json: string | null): WorkerCapability[] {
  if (!json) return []
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
  const res = await api.api.workers.$get()
  if (!res.ok) throw new Error(`Failed to fetch workers: ${res.status}`)
  const data = await res.json()
  return data.map(mapWorker)
}
