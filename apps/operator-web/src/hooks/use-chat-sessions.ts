import type { ChatAttachment } from '@/api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getChatSessions,
  getChatSessionMessages,
  createChatSession,
  sendChatMessage,
} from '@/api/chat-sessions.api'
import { queryKeys } from './use-queries'

export const chatSessionKeys = {
  all: ['chat-sessions'] as const,
  list: () => ['chat-sessions', 'list'] as const,
  messages: (id: string) => ['chat-sessions', id, 'messages'] as const,
}

export function useChatSessions() {
  return useQuery({
    queryKey: chatSessionKeys.list(),
    queryFn: getChatSessions,
  })
}

export function useChatMessages(id: string | null) {
  return useQuery({
    queryKey: chatSessionKeys.messages(id!),
    queryFn: () => getChatSessionMessages(id!),
    enabled: id !== null,
  })
}

export function useCreateChatSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      agentId,
      message,
      attachments,
    }: {
      agentId: string
      message: string
      attachments?: ChatAttachment[]
    }) => createChatSession(agentId, message, attachments),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatSessionKeys.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.all })
    },
  })
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sessionId,
      message,
      attachments,
    }: {
      sessionId: string
      message: string
      attachments?: ChatAttachment[]
    }) => sendChatMessage(sessionId, message, attachments),
    onSuccess: (_data, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: chatSessionKeys.messages(sessionId) })
      void queryClient.invalidateQueries({ queryKey: chatSessionKeys.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.all })
    },
  })
}
