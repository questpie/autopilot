// Mock adapter. Returns hardcoded data matching API response shapes.
// Swap to real API: replace with hc<AppType>('/api/playbooks').get().$get() (Hono client)

import type { Playbook, PlaybookStep, PlaybookExecution } from './types'
import { mockPlaybooks, mockPlaybookSteps, mockPlaybookExecutions } from './mock/playbooks.mock'
import { delay } from './mock/delay'

export async function getPlaybooks(): Promise<Playbook[]> {
  await delay(80)
  return mockPlaybooks
}

export async function getPlaybook(
  id: string,
): Promise<Playbook | null> {
  await delay(60)
  return mockPlaybooks.find((p) => p.id === id) ?? null
}

export async function getPlaybookSteps(
  id: string,
): Promise<PlaybookStep[]> {
  await delay(40)
  return mockPlaybookSteps[id] ?? []
}

export async function getPlaybookExecutions(
  id: string,
): Promise<PlaybookExecution[]> {
  await delay(40)
  return mockPlaybookExecutions[id] ?? []
}
