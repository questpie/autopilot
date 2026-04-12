/**
 * Conversations adapter. Wraps mock conversation data.
 * Mock-backed. Swap to real API: compose from /api/queries + /api/tasks + session messages.
 */

import { delay } from './mock/delay'
import {
  mockConversations,
  type ConversationViewModel,
  type ConversationDisplayType,
  type TaskSummaryView,
  type QuerySummaryView,
} from './mock/conversations.mock'

// Re-export types so route file doesn't need to know about mock module.
export type {
  ConversationViewModel,
  ConversationDisplayType,
  TaskSummaryView,
  QuerySummaryView,
}

export async function getConversations(): Promise<ConversationViewModel[]> {
  await delay(80)
  return mockConversations
}
