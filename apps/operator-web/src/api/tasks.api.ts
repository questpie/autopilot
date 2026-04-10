import type { Task, TaskWithRelations, RunEvent } from './types'
import { mockTasks, mockTaskRuns, mockTaskRunEvents } from './mock/tasks.mock'
import { delay } from './mock/delay'

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
  return mockTaskRunEvents.filter((e) => runIds.has(e.run_id))
}

export async function approveTask(
  _id: string,
): Promise<void> {
  await delay(100)
  // In real implementation: PATCH /api/tasks/:id/approve
}

export async function rejectTask(
  _id: string,
  _message: string,
): Promise<void> {
  await delay(100)
  // In real implementation: PATCH /api/tasks/:id/reject
}

