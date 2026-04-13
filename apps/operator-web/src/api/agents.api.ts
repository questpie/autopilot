/**
 * Agents API — wired to GET /api/config/agents.
 * Config endpoint returns authored agent definitions (read-only).
 */
import type { Agent } from './types'
import { apiFetch } from '@/lib/api-client'

interface WireAgent {
  id: string
  name: string
  role: string
  description: string
  model?: string
  provider?: string
  variant?: string
  capability_profiles: string[]
}

function mapAgent(wire: WireAgent): Agent {
  return {
    id: wire.id,
    name: wire.name,
    role: wire.role,
    description: wire.description,
    model: wire.model ?? null,
    provider: wire.provider ?? null,
    variant: wire.variant ?? null,
    capability_profiles: wire.capability_profiles,
  }
}

export async function getAgents(): Promise<Agent[]> {
  const data = await apiFetch<WireAgent[]>('/api/config/agents')
  return data.map(mapAgent)
}
