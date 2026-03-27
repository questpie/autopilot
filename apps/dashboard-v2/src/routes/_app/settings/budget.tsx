import { createFileRoute } from "@tanstack/react-router"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { FloppyDiskIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FormSection, FormActions } from "@/components/forms"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { fileContentQuery } from "@/features/files/files.queries"
import { api } from "@/lib/api"

export const Route = createFileRoute("/_app/settings/budget")({
  component: SettingsBudgetPage,
})

const budgetSchema = z.object({
  dailyTokenLimit: z.number().min(0),
  alertThreshold: z.number().min(0).max(100),
})

type BudgetFormValues = z.infer<typeof budgetSchema>

function parseBudgetConfig(content: string): BudgetFormValues {
  const config: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf(":")
    if (idx === -1) continue
    config[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/['"]/g, "")
  }
  return {
    dailyTokenLimit: Number(config.daily_token_limit) || 0,
    alertThreshold: Number(config.alert_threshold) || 80,
  }
}

function serializeBudgetConfig(values: BudgetFormValues, existingContent: string): string {
  const lines = existingContent.split("\n")
  const updates: Record<string, string> = {
    daily_token_limit: String(values.dailyTokenLimit),
    alert_threshold: String(values.alertThreshold),
  }

  const updatedKeys = new Set<string>()
  const result = lines.map((line) => {
    const trimmed = line.trim()
    const idx = trimmed.indexOf(":")
    if (idx === -1) return line
    const key = trimmed.slice(0, idx).trim()
    if (key in updates) {
      updatedKeys.add(key)
      return `${key}: ${updates[key]}`
    }
    return line
  })

  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) result.push(`${key}: ${value}`)
  }

  return result.join("\n")
}

function SettingsBudgetPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: content, isLoading } = useQuery({
    ...fileContentQuery("company.yaml"),
    queryKey: [...queryKeys.company.detail("budget")] as string[],
  })

  const saveMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: "company.yaml" },
        json: { content: yaml },
      })
      if (!res.ok) throw new Error("Failed to save budget settings")
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <SettingsPageHeader title={t("settings.budget")} description={t("settings.budget_description")} />
        <div className="p-6">
          <Skeleton className="h-40 max-w-lg" />
        </div>
      </div>
    )
  }

  const existing = content ?? ""
  const initialValues = parseBudgetConfig(existing)

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader title={t("settings.budget")} description={t("settings.budget_description")} />
      <div className="flex-1 overflow-y-auto p-6">
        <BudgetForm
          initialValues={initialValues}
          onSave={(v) => saveMutation.mutate(serializeBudgetConfig(v, existing))}
          isSaving={saveMutation.isPending}
        />
      </div>
    </div>
  )
}

function BudgetForm({
  initialValues,
  onSave,
  isSaving,
}: {
  initialValues: BudgetFormValues
  onSave: (v: BudgetFormValues) => void
  isSaving: boolean
}) {
  const { t } = useTranslation()
  const methods = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: initialValues,
  })

  const dailyLimit = methods.watch("dailyTokenLimit")
  const threshold = methods.watch("alertThreshold")

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSave)}
        className="flex max-w-lg flex-col gap-6"
      >
        <FormSection title={t("settings.budget")}>
          {/* Daily token limit */}
          <Controller
            control={methods.control}
            name="dailyTokenLimit"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label className="font-heading text-xs font-medium">
                    {t("settings.budget_daily_limit")}
                  </Label>
                  <span className="font-heading text-xs text-muted-foreground">
                    {dailyLimit === 0 ? "Unlimited" : `${dailyLimit.toLocaleString()} ${t("settings.budget_tokens")}`}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t("settings.budget_daily_limit_desc")}
                </p>
                <Input
                  type="range"
                  min={0}
                  max={10_000_000}
                  step={100_000}
                  value={field.value}
                  onChange={field.onChange}
                  className="h-2 rounded-none accent-primary"
                />
                <Input
                  type="number"
                  value={field.value}
                  onChange={field.onChange}
                  className="mt-1 w-40"
                  min={0}
                />
              </div>
            )}
          />

          {/* Alert threshold */}
          <Controller
            control={methods.control}
            name="alertThreshold"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label className="font-heading text-xs font-medium">
                    {t("settings.budget_alert_threshold")}
                  </Label>
                  <span className="font-heading text-xs text-muted-foreground">{threshold}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t("settings.budget_alert_threshold_desc")}
                </p>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={field.value}
                  onChange={field.onChange}
                  className="h-2 rounded-none accent-primary"
                />
              </div>
            )}
          />
        </FormSection>

        <FormActions>
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || !methods.formState.isDirty}
            className="gap-1.5"
          >
            <FloppyDiskIcon size={14} />
            {t("settings.save")}
          </Button>
        </FormActions>
      </form>
    </FormProvider>
  )
}
