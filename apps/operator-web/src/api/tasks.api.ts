// Mock adapter. Returns hardcoded data matching API response shapes.
// Swap to real API: replace with hc<AppType>('/api/tasks').get().$get() (Hono client)

import type { Task, TaskWithRelations, RunEvent, Artifact } from './types'
import { mockTasks, mockTaskRuns, mockTaskRunEvents, mockTaskArtifacts } from './mock/tasks.mock'
import { delay } from './mock/delay'

// ── Module-local mutable approval state ──
// These track in-session approve/reject decisions without touching the const mock arrays.
// Reset on page reload — demo only.

let _nextEventId = 1000
const _approvalEvents: RunEvent[] = []

function nowIso(): string {
  return new Date().toISOString()
}

// Find the pending approval_requested event run_id for a task
function pendingApprovalRunId(taskId: string): string | null {
  const taskRuns = mockTaskRuns.filter((r) => r.task_id === taskId)
  const runIds = new Set(taskRuns.map((r) => r.id))
  // Look through static + dynamic events for approval_requested without a matching approved/rejected
  const allEvents = [...mockTaskRunEvents, ..._approvalEvents].filter((e) => runIds.has(e.run_id))
  const requestedEvents = allEvents.filter((e) => e.type === 'approval_requested')
  for (const req of requestedEvents) {
    const payload = (() => { try { return JSON.parse(req.metadata) as Record<string, unknown> } catch { return {} } })()
    const step = payload.step as string | undefined
    const revision = payload.revision as number | undefined
    const hasResolution = allEvents.some((e) => {
      if (e.run_id !== req.run_id) return false
      if (e.type !== 'approval_approved' && e.type !== 'approval_rejected') return false
      const ep = (() => { try { return JSON.parse(e.metadata) as Record<string, unknown> } catch { return {} } })()
      return ep.step === step && ep.revision === revision
    })
    if (!hasResolution) return req.run_id
  }
  return null
}

export async function getTasks(
  filters?: { status?: string },
): Promise<Task[]> {
  await delay(80)
  if (filters?.status) {
    return mockTasks.filter((t) => t.status === filters.status)
  }
  return mockTasks
}

export async function getTask(
  id: string,
): Promise<TaskWithRelations | null> {
  await delay(60)
  const task = mockTasks.find((t) => t.id === id)
  if (!task) return null

  const parentTask = mockTasks.find(
    (t) => t.id === 'tsk_01JR8VQM3K0000000000000004',
  )

  return {
    ...task,
    parents: parentTask && task.id !== parentTask.id ? [parentTask] : [],
    children: [],
    dependencies: [],
    dependents: [],
    runs: mockTaskRuns.filter((r) => r.task_id === id),
  }
}

export async function getTaskActivity(
  id: string,
): Promise<RunEvent[]> {
  await delay(40)
  const taskRuns = mockTaskRuns.filter((r) => r.task_id === id)
  const runIds = new Set(taskRuns.map((r) => r.id))
  const staticEvents = mockTaskRunEvents.filter((e) => runIds.has(e.run_id))
  const dynamicEvents = _approvalEvents.filter((e) => runIds.has(e.run_id))
  return [...staticEvents, ...dynamicEvents]
}

export async function getTaskArtifacts(
  id: string,
): Promise<Artifact[]> {
  await delay(40)
  return mockTaskArtifacts.filter((a) => a.task_id === id)
}

export async function approveTask(
  id: string,
): Promise<void> {
  await delay(100)
  // Find the task and mutate its status in-place
  const task = mockTasks.find((t) => t.id === id)
  if (!task) return
  const runId = pendingApprovalRunId(id) ?? mockTaskRuns.find((r) => r.task_id === id)?.id ?? 'run_unknown'

  // Determine which step/revision we are approving from the last approval_requested event
  const allEvents = [...mockTaskRunEvents, ..._approvalEvents]
  const taskRuns = mockTaskRuns.filter((r) => r.task_id === id)
  const runIds = new Set(taskRuns.map((r) => r.id))
  const reqEvt = [...allEvents].reverse().find((e) => runIds.has(e.run_id) && e.type === 'approval_requested')
  const reqPayload = reqEvt ? (() => { try { return JSON.parse(reqEvt.metadata) as Record<string, unknown> } catch { return {} } })() : {}

  _approvalEvents.push({
    id: _nextEventId++,
    run_id: runId,
    type: 'approval_approved',
    summary: 'Approved by operator',
    metadata: JSON.stringify({ step: reqPayload.step ?? 'review', revision: reqPayload.revision ?? 1, by: 'Jana Kováčová' }),
    created_at: nowIso(),
  })

  task.status = 'running'
  task.updated_at = nowIso()
}

export async function rejectTask(
  id: string,
  message: string,
): Promise<void> {
  await delay(100)
  const task = mockTasks.find((t) => t.id === id)
  if (!task) return
  const runId = pendingApprovalRunId(id) ?? mockTaskRuns.find((r) => r.task_id === id)?.id ?? 'run_unknown'

  const allEvents = [...mockTaskRunEvents, ..._approvalEvents]
  const taskRuns = mockTaskRuns.filter((r) => r.task_id === id)
  const runIds = new Set(taskRuns.map((r) => r.id))
  const reqEvt = [...allEvents].reverse().find((e) => runIds.has(e.run_id) && e.type === 'approval_requested')
  const reqPayload = reqEvt ? (() => { try { return JSON.parse(reqEvt.metadata) as Record<string, unknown> } catch { return {} } })() : {}

  _approvalEvents.push({
    id: _nextEventId++,
    run_id: runId,
    type: 'approval_rejected',
    summary: 'Returned by operator',
    metadata: JSON.stringify({
      step: reqPayload.step ?? 'review',
      revision: reqPayload.revision ?? 1,
      by: 'Jana Kováčová',
      message: message || undefined,
    }),
    created_at: nowIso(),
  })

  // Rejection puts the task back to running (agent will re-draft)
  task.status = 'running'
  task.updated_at = nowIso()
}

