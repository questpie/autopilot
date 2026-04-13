import type { Run, RunWithArtifacts, Artifact } from './types'
import { api, configFetch } from '@/lib/api'

export async function steerRun(runId: string, message: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/steer`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    throw new Error(`Failed to steer run: ${res.status}`)
  }
  return res.json() as Promise<{ ok: true }>
}

export async function getRuns(filters?: { status?: string; agent_id?: string; task_id?: string }): Promise<Run[]> {
  const query: Record<string, string> = {}
  if (filters?.status) query.status = filters.status
  if (filters?.agent_id) query.agent_id = filters.agent_id
  if (filters?.task_id) query.task_id = filters.task_id
  const res = await api.api.runs.$get({ query })
  return res.json() as Promise<Run[]>
}

export function getArtifactContentUrl(runId: string, artifactId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}/content`
}

export async function getRun(id: string): Promise<RunWithArtifacts | null> {
  const enc = encodeURIComponent(id)
  const res = await fetch(`/api/runs/${enc}`, { credentials: 'include' })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Failed to fetch run: ${res.status}`)
  }
  const [run, artifacts] = await Promise.all([
    res.json() as Promise<Run>,
    configFetch<Artifact[]>(`/api/runs/${enc}/artifacts`),
  ])
  return { ...run, artifacts }
}
