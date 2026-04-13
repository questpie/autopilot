/**
 * Parsing helpers for raw JSON text fields in API contract types.
 *
 * Backend stores several fields as JSON text in the DB and returns them as
 * strings over the API. These helpers parse those strings once, at the boundary,
 * so the rest of the FE works with typed objects instead of raw strings.
 *
 * Each helper returns a default (empty object / null) on malformed JSON rather
 * than throwing, to keep the UI resilient to corrupt data.
 */

import type { ActivityEntry, RunEvent, SessionMessage, Task, WorkerEventType } from './types'

// ── Generic safe parse ──

function safeParse<T = Record<string, unknown>>(json: string): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return {} as T
  }
}

// ── Task context ──

export interface TaskContext {
  source_conversation?: string
  [key: string]: unknown
}

export function parseTaskContext(task: Task): TaskContext {
  return safeParse<TaskContext>(task.context)
}

export interface TaskMetadata {
  revision?: number
  step_index?: number
  total_steps?: number
  created_by_name?: string
  assigned_to_name?: string
  participants?: string[]
  approver?: string
  error_reason?: string
  blocked_reason?: string
  [key: string]: unknown
}

export function parseTaskMetadata(task: Task): TaskMetadata {
  return safeParse<TaskMetadata>(task.metadata)
}

// ── RunEvent metadata ──
// The `metadata` field on RunEvent is a JSON string that typically holds step info.

export interface RunEventPayload {
  step?: string
  revision?: number
  summary?: string
  error?: string
  by?: string
  message?: string
  [key: string]: unknown
}

export function parseRunEventMetadata(evt: RunEvent): RunEventPayload {
  return safeParse<RunEventPayload>(evt.metadata)
}

// ── SessionMessage metadata ──

export interface MessageMetadata {
  worker_event?: {
    type: WorkerEventType
    summary: string
  }
  artifact_refs?: Array<{ artifact_id: string; title: string }>
  tool_card?: {
    kind: 'created' | 'updated'
    task_id: string
    task_title: string
  }
  [key: string]: unknown
}

// ── ActivityEntry details ──

export interface ActivityDetails {
  task_id?: string
  step_id?: string
  action?: string
  reason?: string
  message?: string
  [key: string]: unknown
}

export function parseActivityDetails(entry: ActivityEntry): ActivityDetails {
  if (!entry.details) return {}
  return safeParse<ActivityDetails>(entry.details)
}

export function parseMessageMetadata(msg: SessionMessage): MessageMetadata {
  return safeParse<MessageMetadata>(msg.metadata)
}
