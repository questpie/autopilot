import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"

interface TaskData {
  id: string
  title: string
  description: string
  type: string
  status: string
  priority: string
  assigned_to?: string
  project?: string
  workflow?: string
  workflow_step?: string
  created_by: string
  created_at: string
  updated_at: string
  depends_on: string[]
  blocks: string[]
  related: string[]
  history: Array<{ at: string; by: string; action: string; note?: string }>
  metadata: Record<string, unknown>
  [key: string]: unknown
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (data: {
      title: string
      description?: string
      priority?: string
      assigned_to?: string
      project?: string
      workflow?: string
      labels?: string[]
    }) => {
      const res = await api.api.tasks.$post({
        json: {
          title: data.title,
          description: data.description ?? "",
          type: "implementation" as const,
          status: "backlog" as const,
          priority: (data.priority ?? "medium") as "medium",
          assigned_to: data.assigned_to,
          project: data.project,
          workflow: data.workflow,
          labels: data.labels,
          created_by: "human",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      if (!res.ok) throw new Error("Failed to create task")
      return res.json()
    },
    onSuccess: () => {
      toast.success(t("tasks.task_created"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      status?: string
      assigned_to?: string
      priority?: string
      project?: string
      description?: string
    }) => {
      const res = await api.api.tasks[":id"].$patch({
        param: { id },
        json: data as any,
      })
      if (!res.ok) throw new Error("Failed to update task")
      return res.json()
    },
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.root })

      const previousTasks = queryClient.getQueryData(queryKeys.tasks.list())

      queryClient.setQueryData(
        queryKeys.tasks.list(),
        (old: TaskData[] | undefined) => {
          if (!old) return old
          return old.map((task) =>
            task.id === id ? { ...task, ...data, updated_at: new Date().toISOString() } : task,
          )
        },
      )

      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks.list(), context.previousTasks)
      }
      toast.error(t("common.error"))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
    },
  })
}

export function useApproveTaskMutation() {
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
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.root })
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.root })

      const previousTasks = queryClient.getQueryData(queryKeys.tasks.list())

      queryClient.setQueryData(
        queryKeys.tasks.list(),
        (old: TaskData[] | undefined) => {
          if (!old) return old
          return old.map((task) =>
            task.id === taskId ? { ...task, status: "done" } : task,
          )
        },
      )

      return { previousTasks }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks.list(), context.previousTasks)
      }
      toast.error(t("common.error"))
    },
    onSuccess: () => {
      toast.success(t("inbox.task_approved"))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root })
    },
  })
}

export function useRejectTaskMutation() {
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
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.root })
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.root })

      const previousTasks = queryClient.getQueryData(queryKeys.tasks.list())

      queryClient.setQueryData(
        queryKeys.tasks.list(),
        (old: TaskData[] | undefined) => {
          if (!old) return old
          return old.map((task) =>
            task.id === taskId ? { ...task, status: "blocked" } : task,
          )
        },
      )

      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks.list(), context.previousTasks)
      }
      toast.error(t("common.error"))
    },
    onSuccess: () => {
      toast.success(t("inbox.task_rejected"))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root })
    },
  })
}
