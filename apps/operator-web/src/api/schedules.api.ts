import type { Schedule, ScheduleWithHistory } from './types'
import {
  mockSchedules,
  mockScheduleExecutions,
} from './mock/schedules.mock'
import { delay } from './mock/delay'

export async function getSchedules(
  filters?: { enabled?: boolean },
): Promise<Schedule[]> {
  await delay(80)
  if (filters?.enabled !== undefined) {
    return mockSchedules.filter((s) => s.enabled === filters.enabled)
  }
  return mockSchedules
}

export async function getSchedule(
  id: string,
): Promise<ScheduleWithHistory | null> {
  await delay(60)
  const schedule = mockSchedules.find((s) => s.id === id)
  if (!schedule) return null

  return {
    ...schedule,
    history: mockScheduleExecutions.filter(
      (e) => e.schedule_id === id,
    ),
  }
}

export async function toggleSchedule(
  _id: string,
  _enabled: boolean,
): Promise<void> {
  await delay(100)
  // In real implementation: PATCH /api/schedules/:id { enabled }
}

export async function triggerSchedule(
  _id: string,
): Promise<void> {
  await delay(100)
  // In real implementation: POST /api/schedules/:id/trigger
}

