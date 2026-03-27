import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * Persistent "Ask your team" input for the dashboard.
 * Creates an intent task assigned to the CEO agent.
 */
export function AskInput() {
  const { t } = useTranslation()
  const [value, setValue] = useState("")
  const queryClient = useQueryClient()

  const createIntent = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.api.tasks.$post({
        json: {
          title: message,
          type: "intent",
          assigned_to: "ceo",
          status: "backlog",
          created_by: "human",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      if (!res.ok) throw new Error("Failed to create task")
      return res.json()
    },
    onSuccess: () => {
      setValue("")
      toast.success(t("dashboard.intent_submitted"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    createIntent.mutate(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("dashboard.quick_ask_placeholder")}
        className="flex-1 font-heading text-sm"
        disabled={createIntent.isPending}
      />
      <Button
        type="submit"
        size="sm"
        disabled={!value.trim() || createIntent.isPending}
        className="shrink-0 gap-1.5"
      >
        <PaperPlaneTiltIcon size={14} />
        {t("dashboard.ask")}
      </Button>
    </form>
  )
}
