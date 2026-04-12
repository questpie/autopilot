// Mock adapter. Returns hardcoded data matching API response shapes.
// Swap to real API: replace with hc<AppType>('/api/runs').get().$get() (Hono client)

import type { Run, RunWithArtifacts } from './types'
import { mockRuns, mockRunArtifacts } from './mock/runs.mock'
import { delay } from './mock/delay'

export async function getRuns(
  filters?: { status?: string; task_id?: string },
): Promise<Run[]> {
  await delay(80)
  let result = mockRuns
  if (filters?.status) {
    result = result.filter((r) => r.status === filters.status)
  }
  if (filters?.task_id) {
    result = result.filter((r) => r.task_id === filters.task_id)
  }
  return result
}

export async function getRun(
  id: string,
): Promise<RunWithArtifacts | null> {
  await delay(60)
  const run = mockRuns.find((r) => r.id === id)
  if (!run) return null

  return {
    ...run,
    artifacts: mockRunArtifacts.filter((a) => a.run_id === id),
  }
}
