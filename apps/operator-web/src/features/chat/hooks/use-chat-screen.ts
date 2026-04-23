import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useChatSessions, useChatMessages, useSendChatMessage, useCreateChatSession } from '@/hooks/use-chat-sessions'
import { useQueryList } from '@/hooks/use-queries'
import { useTasks } from '@/hooks/use-tasks'
import { composeConversations } from '@/api/conversations.api'
import type { ConversationViewModel } from '@/api/conversations.api'
import { clearChatContextSearch, getChatContextSearch, type ChatContextSearch } from '../lib/chat-context'

export function useChatScreen() {
  const location = useLocation()
  const search = location.search as {
    sessionId?: string
    view?: 'history'
    contextRefType?: ChatContextSearch['contextRefType']
    contextRefId?: string
    contextPath?: string
    contextRunId?: string
    contextLabel?: string
  }
  const activeId = search.sessionId ?? null
  const view = search.view ?? null
  const contextSearch = getChatContextSearch(search)

  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const sessionsQuery = useChatSessions()
  const queriesQuery = useQueryList()
  const tasksQuery = useTasks()

  const conversations = useMemo<ConversationViewModel[]>(() => {
    const sessions = sessionsQuery.data ?? []
    const queries = queriesQuery.data ?? []
    const tasks = tasksQuery.data ?? []
    return composeConversations(sessions, queries, tasks)
  }, [sessionsQuery.data, queriesQuery.data, tasksQuery.data])

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const lower = searchQuery.toLowerCase()
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        c.lastPreview.toLowerCase().includes(lower),
    )
  }, [conversations, searchQuery])

  const activeSessionId = useMemo<string | null>(() => {
    if (!activeId) return null
    const conv = conversations.find((c) => c.session.id === activeId)
    return conv?.session.id ?? null
  }, [activeId, conversations])

  const messagesQuery = useChatMessages(activeSessionId)

  const activeConversation = useMemo<ConversationViewModel | null>(() => {
    if (!activeId) return null
    const conv = conversations.find((c) => c.session.id === activeId)
    if (!conv) return null
    const messages = messagesQuery.data ?? []
    return { ...conv, messages }
  }, [activeId, conversations, messagesQuery.data])

  const isLoading =
    sessionsQuery.isLoading ||
    queriesQuery.isLoading ||
    tasksQuery.isLoading ||
    messagesQuery.isFetching

  const sendMutation = useSendChatMessage()
  const createMutation = useCreateChatSession()

  function selectConversation(id: string) {
    void navigate({ to: '/chat', search: { sessionId: id } })
  }

  function clearConversation() {
    void navigate({ to: '/chat', search: { ...contextSearch } })
  }

  function goToHistory() {
    void navigate({ to: '/chat', search: { view: 'history', ...contextSearch } })
  }

  function clearContext() {
    void navigate({
      to: '/chat',
      search: activeId
        ? { sessionId: activeId }
        : clearChatContextSearch(contextSearch),
    })
  }

  return {
    conversations,
    filteredConversations,
    activeConversation,
    activeId,
    view,
    contextSearch,
    searchQuery,
    setSearchQuery,
    selectConversation,
    clearConversation,
    clearContext,
    goToHistory,
    isLoading,
    sendMutation,
    createMutation,
  }
}
