/**
 * Runs API — wired to /api/runs endpoints.
 * All endpoints require user auth (session cookie).
 */
import type { Run, RunWithArtifacts, Artifact } from './types'
import { apiFetch, ApiError } from '@/lib/api-client'

export async function getRuns(filters?: { status?: string; agent_id?: string; task_id?: string }): Promise<Run[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.agent_id) params.set('agent_id', filters.agent_id)
  if (filters?.task_id) params.set('task_id', filters.task_id)
  const qs = params.toString()
  return apiFetch<Run[]>(`/api/runs${qs ? `?${qs}` : ''}`)
}

export async function getRun(id: string): Promise<RunWithArtifacts | null> {
  try {
    const [run, artifacts] = await Promise.all([
      apiFetch<Run>(`/api/runs/${encodeURIComponent(id)}`),
      apiFetch<Artifact[]>(`/api/runs/${encodeURIComponent(id)}/artifacts`),
    ])
    return { ...run, artifacts }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
