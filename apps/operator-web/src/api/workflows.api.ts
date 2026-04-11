import type { Workflow } from './types'
import { mockWorkflows } from './mock/workflows.mock'
import { delay } from './mock/delay'

export async function getWorkflows(): Promise<Workflow[]> {
  await delay(80)
  return mockWorkflows
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  await delay(60)
  return mockWorkflows.find((w) => w.id === id) ?? null
}
