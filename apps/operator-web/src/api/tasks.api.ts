/**
 * Tasks API — wired to /api/tasks and composed endpoints.
 * All endpoints require user auth (session cookie).
 */
import type { Task, TaskWithRelations, Artifact, Run, ActivityEntry, AdvanceResult } from './types'
import { apiFetch, ApiError } from '@/lib/api-client'

export async function getTasks(filters?: { status?: string; assigned_to?: string; workflow_id?: string }): Promise<Task[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.assigned_to) params.set('assigned_to', filters.assigned_to)
  if (filters?.workflow_id) params.set('workflow_id', filters.workflow_id)
  const qs = params.toString()
  return apiFetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`)
}

export async function getTaskDetail(id: string): Promise<TaskWithRelations | null> {
  try {
    const [task, parents, children, dependencies, dependents, runs] = await Promise.all([
      apiFetch<Task>(`/api/tasks/${encodeURIComponent(id)}`),
      apiFetch<Task[]>(`/api/tasks/${encodeURIComponent(id)}/parents`),
      apiFetch<Task[]>(`/api/tasks/${encodeURIComponent(id)}/children`),
      apiFetch<Task[]>(`/api/tasks/${encodeURIComponent(id)}/dependencies`),
      apiFetch<Task[]>(`/api/tasks/${encodeURIComponent(id)}/dependents`),
      apiFetch<Run[]>(`/api/runs?task_id=${encodeURIComponent(id)}`),
    ])
    return { ...task, parents, children, dependencies, dependents, runs }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function getTaskActivity(id: string): Promise<ActivityEntry[]> {
  return apiFetch<ActivityEntry[]>(`/api/tasks/${encodeURIComponent(id)}/activity`)
}

export async function getTaskArtifacts(id: string): Promise<Artifact[]> {
  const runs = await apiFetch<Run[]>(`/api/runs?task_id=${encodeURIComponent(id)}`)
  const artifactArrays = await Promise.all(
    runs.map((run) => apiFetch<Artifact[]>(`/api/runs/${encodeURIComponent(run.id)}/artifacts`))
  )
  return artifactArrays.flat()
}

export async function approveTask(id: string): Promise<AdvanceResult> {
  return apiFetch<AdvanceResult>(`/api/tasks/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  })
}

export async function rejectTask(id: string, message: string): Promise<AdvanceResult> {
  return apiFetch<AdvanceResult>(`/api/tasks/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}
