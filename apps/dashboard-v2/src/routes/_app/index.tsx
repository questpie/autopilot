import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { DashboardGroups } from "@/features/dashboard/dashboard-groups"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PageTransition } from "@/components/layouts/page-transition"

export const Route = createFileRoute("/_app/")({ component: DashboardHome })

function QuickAskInput() {
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

function DashboardHome() {
  const { t } = useTranslation()

  return (
    <PageTransition className="flex flex-1 flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {t("dashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.welcome")}
          </p>
        </div>
        <QuickAskInput />
      </div>

      {/* Dashboard sections (ordered by groups.yaml or defaults) */}
      <DashboardGroups />
    </PageTransition>
  )
}
