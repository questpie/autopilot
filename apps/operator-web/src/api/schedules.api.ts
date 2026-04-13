/**
 * Schedules API — wired to /api/schedules endpoints.
 * All endpoints require user auth (session cookie).
 */
import type { Schedule, ScheduleExecution, ScheduleWithHistory } from './types'
import { apiFetch, ApiError } from '@/lib/api-client'

export async function getSchedules(filters?: { enabled?: boolean }): Promise<Schedule[]> {
  const all = await apiFetch<Schedule[]>('/api/schedules')
  if (filters?.enabled !== undefined) {
    return all.filter((s) => s.enabled === filters.enabled)
  }
  return all
}

export async function getSchedule(id: string): Promise<ScheduleWithHistory | null> {
  try {
    const [schedule, history] = await Promise.all([
      apiFetch<Schedule>(`/api/schedules/${encodeURIComponent(id)}`),
      apiFetch<ScheduleExecution[]>(`/api/schedules/${encodeURIComponent(id)}/history`),
    ])
    return { ...schedule, history }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<Schedule> {
  return apiFetch<Schedule>(`/api/schedules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
}

export async function triggerSchedule(id: string): Promise<{ ok: boolean; schedule_id: string }> {
  return apiFetch<{ ok: boolean; schedule_id: string }>(
    `/api/schedules/${encodeURIComponent(id)}/trigger`,
    { method: 'POST' },
  )
}
