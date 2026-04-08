import { describe, test, expect } from 'bun:test'
import { ConversationResultSchema } from '@questpie/autopilot-spec'
import {
  queryMessage,
  conversationApprove,
  conversationReject,
  conversationReply,
  noop,
} from './handler-sdk'

// ─── 1. ConversationResultSchema sender fields ─────────────────────────────

describe('ConversationResultSchema', () => {
  test('query.message accepts sender_id and sender_name', () => {
    const result = ConversationResultSchema.parse({
      action: 'query.message',
      conversation_id: 'c1',
      message: 'hello',
      sender_id: 's1',
      sender_name: 'Alice',
    })
    expect(result.action).toBe('query.message')
    expect(result).toHaveProperty('sender_id', 's1')
    expect(result).toHaveProperty('sender_name', 'Alice')
  })

  test('query.message works without sender fields', () => {
    const result = ConversationResultSchema.parse({
      action: 'query.message',
      conversation_id: 'c1',
      message: 'hello',
    })
    expect(result.action).toBe('query.message')
    expect(result).not.toHaveProperty('sender_id')
    expect(result).not.toHaveProperty('sender_name')
  })

  test('task.approve parses correctly', () => {
    const result = ConversationResultSchema.parse({
      action: 'task.approve',
      conversation_id: 'c1',
    })
    expect(result.action).toBe('task.approve')
  })

  test('task.reject parses correctly', () => {
    const result = ConversationResultSchema.parse({
      action: 'task.reject',
      conversation_id: 'c1',
      message: 'bad',
    })
    expect(result.action).toBe('task.reject')
  })

  test('task.reply parses correctly', () => {
    const result = ConversationResultSchema.parse({
      action: 'task.reply',
      conversation_id: 'c1',
      message: 'ok',
    })
    expect(result.action).toBe('task.reply')
  })

  test('noop parses correctly', () => {
    const result = ConversationResultSchema.parse({
      action: 'noop',
      reason: 'not relevant',
    })
    expect(result.action).toBe('noop')
  })
})

// ─── 2. Conversation-aware handler SDK helpers ──────────────────────────────

describe('conversation-aware helpers', () => {
  test('queryMessage returns correct HandlerResult with sender fields', () => {
    const result = queryMessage({
      conversation_id: 'c1',
      message: 'hi',
      sender_id: 's1',
      sender_name: 'Alice',
    })
    expect(result.ok).toBe(true)
    expect(result.metadata).toEqual({
      action: 'query.message',
      conversation_id: 'c1',
      message: 'hi',
      sender_id: 's1',
      sender_name: 'Alice',
    })
    // metadata must pass schema validation
    ConversationResultSchema.parse(result.metadata)
  })

  test('conversationApprove returns correct shape', () => {
    const result = conversationApprove({ conversation_id: 'c1', thread_id: 't1' })
    expect(result.ok).toBe(true)
    expect(result.metadata).toEqual({
      action: 'task.approve',
      conversation_id: 'c1',
      thread_id: 't1',
    })
    ConversationResultSchema.parse(result.metadata)
  })

  test('conversationReject returns correct shape', () => {
    const result = conversationReject({ conversation_id: 'c1', message: 'bad' })
    expect(result.ok).toBe(true)
    expect(result.metadata).toEqual({
      action: 'task.reject',
      conversation_id: 'c1',
      message: 'bad',
    })
    ConversationResultSchema.parse(result.metadata)
  })

  test('conversationReply returns correct shape', () => {
    const result = conversationReply({ conversation_id: 'c1', message: 'ok' })
    expect(result.ok).toBe(true)
    expect(result.metadata).toEqual({
      action: 'task.reply',
      conversation_id: 'c1',
      message: 'ok',
    })
    ConversationResultSchema.parse(result.metadata)
  })
})

// ─── 3. noop helper ────────────────────────────────────────────────────────

describe('noop helper', () => {
  test('noop() returns ok with noop action', () => {
    const result = noop('skip')
    expect(result.ok).toBe(true)
    expect(result.metadata).toEqual({ action: 'noop', reason: 'skip' })
  })
})
