import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"

interface MessageData {
  id: string
  from: string
  channel: string
  at: string
  content: string
  mentions: string[]
  references: string[]
  reactions: string[]
  thread: string | null
  external: boolean
}

export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (data: {
      content: string
      thread?: string
      mentions?: string[]
      references?: string[]
    }) => {
      const res = await api.api.channels[":id"].messages.$post({
        param: { id: channelId },
        json: {
          content: data.content,
          thread: data.thread,
          mentions: data.mentions,
          references: data.references,
        },
      })
      if (!res.ok) throw new Error("Failed to send message")
      return res.json()
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list({ channel: channelId }),
      })

      const previousMessages = queryClient.getQueryData(
        queryKeys.messages.list({ channel: channelId, limit: 50 }),
      )

      // Optimistic message
      const optimisticMessage: MessageData = {
        id: `temp-${Date.now()}`,
        from: "human",
        channel: channelId,
        at: new Date().toISOString(),
        content: data.content,
        mentions: data.mentions ?? [],
        references: data.references ?? [],
        reactions: [],
        thread: data.thread ?? null,
        external: true,
      }

      queryClient.setQueryData(
        queryKeys.messages.list({ channel: channelId, limit: 50 }),
        (old: MessageData[] | undefined) => {
          if (!old) return [optimisticMessage]
          return [...old, optimisticMessage]
        },
      )

      return { previousMessages }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.messages.list({ channel: channelId, limit: 50 }),
          context.previousMessages,
        )
      }
      toast.error(t("chat.send_failed"))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list({ channel: channelId }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.root,
      })
    },
  })
}

export function useCreateChannel() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (data: {
      name: string
      type?: "group" | "direct" | "broadcast"
      description?: string
      members?: Array<{ actor_id: string; actor_type: "human" | "agent" }>
    }) => {
      const res = await api.api.channels.$post({
        json: {
          name: data.name,
          type: data.type ?? "group",
          description: data.description,
          members: data.members,
        },
      })
      if (!res.ok) throw new Error("Failed to create channel")
      return res.json()
    },
    onSuccess: () => {
      toast.success(t("chat.channel_created"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })
}

export function useManageMembers(channelId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (data: {
      add?: Array<{
        actor_id: string
        actor_type: "human" | "agent"
        role?: "owner" | "member" | "readonly"
      }>
      remove?: string[]
    }) => {
      const res = await api.api.channels[":id"].members.$put({
        param: { id: channelId },
        json: data,
      })
      if (!res.ok) throw new Error("Failed to manage members")
      return res.json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.detail(channelId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.detail(`${channelId}-members`),
      })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })
}
