import type { Schedule, ScheduleExecution, ScheduleWithHistory } from './types'
import { api, configFetch } from '@/lib/api'

export async function getSchedules(filters?: { enabled?: boolean }): Promise<Schedule[]> {
  const res = await api.api.schedules.$get()
  if (!res.ok) throw new Error(`Failed to list schedules: ${res.status}`)
  const all = (await res.json()) as Schedule[]
  if (filters?.enabled !== undefined) {
    return all.filter((s) => s.enabled === filters.enabled)
  }
  return all
}

export async function getSchedule(id: string): Promise<ScheduleWithHistory | null> {
  const enc = encodeURIComponent(id)
  const res = await fetch(`/api/schedules/${enc}`, { credentials: 'include' })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Failed to fetch schedule: ${res.status}`)
  }
  const [schedule, history] = await Promise.all([
    res.json() as Promise<Schedule>,
    configFetch<ScheduleExecution[]>(`/api/schedules/${enc}/history`),
  ])
  return { ...schedule, history }
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<Schedule> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error(`Failed to toggle schedule: ${res.status}`)
  return res.json() as Promise<Schedule>
}

export async function triggerSchedule(id: string): Promise<{ ok: boolean; schedule_id: string }> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(id)}/trigger`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Failed to trigger schedule: ${res.status}`)
  return res.json() as Promise<{ ok: boolean; schedule_id: string }>
}
