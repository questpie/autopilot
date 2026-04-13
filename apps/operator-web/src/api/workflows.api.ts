/**
 * Workflows API — wired to GET /api/config/workflows.
 * Config endpoint returns authored workflow definitions (read-only).
 */
import type { Workflow, WorkflowStep } from './types'
import { apiFetch } from '@/lib/api-client'

// ── Wire shapes (backend Zod-parsed, optional fields may be absent) ──

interface WireStep {
  id: string
  name?: string
  type: 'agent' | 'human_approval' | 'wait_for_children' | 'done'
  agent_id?: string
  instructions?: string
  approvers?: string[]
  actions: Array<Record<string, unknown>>
}

interface WireWorkflow {
  id: string
  name: string
  description: string
  workspace?: { mode: 'none' | 'isolated_worktree' }
  steps: WireStep[]
}

function mapStep(wire: WireStep): WorkflowStep {
  return {
    id: wire.id,
    name: wire.name ?? null,
    type: wire.type,
    agent_id: wire.agent_id ?? null,
    instructions: wire.instructions ?? null,
    approvers: wire.approvers ?? [],
    actions: wire.actions,
  }
}

function mapWorkflow(wire: WireWorkflow): Workflow {
  return {
    id: wire.id,
    name: wire.name,
    description: wire.description,
    workspace: wire.workspace,
    steps: wire.steps.map(mapStep),
  }
}

export async function getWorkflows(): Promise<Workflow[]> {
  const data = await apiFetch<WireWorkflow[]>('/api/config/workflows')
  return data.map(mapWorkflow)
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  // Config endpoints serve all workflows at once — filter client-side
  const all = await getWorkflows()
  return all.find((w) => w.id === id) ?? null
}
