import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"

export function useApproveTask() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await api.api.tasks[":id"].approve.$post({
        param: { id: taskId },
      })
      if (!res.ok) throw new Error("Failed to approve task")
      return res.json()
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.root })
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.root })

      const previousInbox = queryClient.getQueryData(queryKeys.inbox.list())

      queryClient.setQueryData(
        queryKeys.inbox.list(),
        (old: { tasks: Array<{ id: string; status: string }>; pins: unknown[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            tasks: old.tasks.filter((task) => task.id !== taskId),
          }
        },
      )

      return { previousInbox }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previousInbox) {
        queryClient.setQueryData(queryKeys.inbox.list(), context.previousInbox)
      }
      toast.error(t("common.error"))
    },
    onSuccess: () => {
      toast.success(t("inbox.task_approved"))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root })
    },
  })
}

export function useRejectTask() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason?: string }) => {
      const res = await api.api.tasks[":id"].reject.$post({
        param: { id: taskId },
        json: { reason },
      })
      if (!res.ok) throw new Error("Failed to reject task")
      return res.json()
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.root })

      const previousInbox = queryClient.getQueryData(queryKeys.inbox.list())

      queryClient.setQueryData(
        queryKeys.inbox.list(),
        (old: { tasks: Array<{ id: string; status: string }>; pins: unknown[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            tasks: old.tasks.filter((task) => task.id !== taskId),
          }
        },
      )

      return { previousInbox }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousInbox) {
        queryClient.setQueryData(queryKeys.inbox.list(), context.previousInbox)
      }
      toast.error(t("common.error"))
    },
    onSuccess: () => {
      toast.success(t("inbox.task_rejected"))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root })
    },
  })
}
