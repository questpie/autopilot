/**
 * Conversation view model types and composition helpers.
 * These are UI-only projections — the backend has no "conversation" entity.
 * Conversations are composed from: sessions + queries + tasks.
 */

import type { Session, SessionMessage, Artifact, Query, Task } from './types'

/**
 * UI-only conversation display type. Not a backend contract.
 * - 'query' maps to SessionMode 'query'.
 * - 'task' maps to SessionMode 'task_thread'.
 * - 'discussion' is not produced from real data (kept for mock/seed compatibility).
 */
export type ConversationDisplayType = 'query' | 'task' | 'discussion'

export interface TaskSummaryView {
  id: string
  title: string
  status: string
  workflow_id: string | null
  workflow_step: string | null
  runs_total: number
  runs_completed: number
}

export interface QuerySummaryView {
  id: string
  status: string
  run_id: string | null
  promoted_task_id?: string | null
}

export interface ConversationViewModel {
  session: Session
  displayType: ConversationDisplayType
  title: string
  lastPreview: string
  time: string
  messages: SessionMessage[]
  artifacts: Artifact[]
  task: TaskSummaryView | null
  queries: QuerySummaryView[]
}

/**
 * Compose ConversationViewModel list from backend primitives.
 * Messages and artifacts are NOT included — they are loaded on demand
 * for the selected conversation only.
 */
export function composeConversations(
  sessions: Session[],
  queries: Query[],
  tasks: Task[],
): ConversationViewModel[] {
  return sessions.map((session) => {
    const sessionQueries = queries.filter((q) => q.session_id === session.id)
    const matchedTask = session.task_id
      ? tasks.find((t) => t.id === session.task_id) ?? null
      : null

    const displayType: ConversationDisplayType =
      session.mode === 'task_thread' ? 'task' : 'query'

    let title: string
    if (matchedTask) {
      title = matchedTask.title
    } else if (sessionQueries.length > 0) {
      title = sessionQueries[0].prompt?.slice(0, 80) ?? session.id.slice(0, 12)
    } else {
      title = session.id.slice(0, 12)
    }

    const lastQuery = sessionQueries.at(-1)
    const lastPreview = lastQuery?.summary ?? lastQuery?.prompt?.slice(0, 80) ?? ''

    const time = new Date(session.updated_at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })

    const taskSummary: TaskSummaryView | null = matchedTask
      ? {
          id: matchedTask.id,
          title: matchedTask.title,
          status: matchedTask.status,
          workflow_id: matchedTask.workflow_id,
          workflow_step: matchedTask.workflow_step,
          runs_total: 0,
          runs_completed: 0,
        }
      : null

    const querySummaries: QuerySummaryView[] = sessionQueries.map((q) => ({
      id: q.id,
      status: q.status,
      run_id: q.run_id,
      promoted_task_id: q.promoted_task_id,
    }))

    return {
      session,
      displayType,
      title,
      lastPreview,
      time,
      messages: [],
      artifacts: [],
      task: taskSummary,
      queries: querySummaries,
    }
  })
}
