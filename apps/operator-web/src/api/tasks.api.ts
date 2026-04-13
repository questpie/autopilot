import type { Task, TaskWithRelations, Artifact, ActivityEntry, AdvanceResult } from './types'
import { api, configFetch } from '@/lib/api'
import { getRuns } from './runs.api'

export async function getTasks(filters?: { status?: string; assigned_to?: string; workflow_id?: string }): Promise<Task[]> {
  const query: Record<string, string> = {}
  if (filters?.status) query.status = filters.status
  if (filters?.assigned_to) query.assigned_to = filters.assigned_to
  if (filters?.workflow_id) query.workflow_id = filters.workflow_id
  const res = await api.api.tasks.$get({ query })
  return res.json() as Promise<Task[]>
}

export async function getTaskDetail(id: string): Promise<TaskWithRelations | null> {
  const enc = encodeURIComponent(id)
  const taskRes = await fetch(`/api/tasks/${enc}`, { credentials: 'include' })
  if (!taskRes.ok) {
    if (taskRes.status === 404) return null
    throw new Error(`Failed to fetch task: ${taskRes.status}`)
  }
  const [task, parents, children, dependencies, dependents, runs] = await Promise.all([
    taskRes.json() as Promise<Task>,
    configFetch<Task[]>(`/api/tasks/${enc}/parents`),
    configFetch<Task[]>(`/api/tasks/${enc}/children`),
    configFetch<Task[]>(`/api/tasks/${enc}/dependencies`),
    configFetch<Task[]>(`/api/tasks/${enc}/dependents`),
    getRuns({ task_id: id }),
  ])
  return { ...task, parents, children, dependencies, dependents, runs }
}

export async function getTaskActivity(id: string): Promise<ActivityEntry[]> {
  return configFetch<ActivityEntry[]>(`/api/tasks/${encodeURIComponent(id)}/activity`)
}

export async function getTaskArtifacts(id: string): Promise<Artifact[]> {
  const runs = await getRuns({ task_id: id })
  const artifactArrays = await Promise.all(
    runs.map((run) => configFetch<Artifact[]>(`/api/runs/${encodeURIComponent(run.id)}/artifacts`)),
  )
  return artifactArrays.flat()
}

export async function approveTask(id: string): Promise<AdvanceResult> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    credentials: 'include',
  })
  return res.json() as Promise<AdvanceResult>
}

export async function rejectTask(id: string, message: string): Promise<AdvanceResult> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  return res.json() as Promise<AdvanceResult>
}

export async function replyTask(id: string, message: string): Promise<AdvanceResult> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    throw new Error(`Failed to reply to task: ${res.status}`)
  }
  return res.json() as Promise<AdvanceResult>
}
