/**
 * Conversations adapter. Wraps mock conversation data.
 * Mock-backed. Swap to real API: compose from /api/queries + /api/tasks + session messages.
 */

import { delay } from './mock/delay'
import {
  mockConversations,
  type MockConversation,
  type MockMessage,
  type MockArtifact,
  type MockArtifactType,
  type MockToolCard,
  type MockArtifactRef,
  type MockTaskEvent,
  type MockActionRequest,
  type MockTaskSummary,
  type MockMessageRole,
  type ConversationType,
} from './mock/conversations.mock'

// Re-export types so route file doesn't need to know about mock module
export type {
  MockConversation,
  MockMessage,
  MockArtifact,
  MockArtifactType,
  MockToolCard,
  MockArtifactRef,
  MockTaskEvent,
  MockActionRequest,
  MockTaskSummary,
  MockMessageRole,
  ConversationType,
}

export async function getConversations(): Promise<MockConversation[]> {
  await delay(80)
  return mockConversations
}

export async function getConversation(id: string): Promise<MockConversation | null> {
  await delay(60)
  return mockConversations.find((c) => c.id === id) ?? null
}
