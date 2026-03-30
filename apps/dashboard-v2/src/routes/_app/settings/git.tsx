import { createFileRoute } from "@tanstack/react-router"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { FloppyDiskIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { FormField, FormSection, FormActions } from "@/components/forms"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { fileContentQuery } from "@/features/files/files.queries"
import { api } from "@/lib/api"

export const Route = createFileRoute("/_app/settings/git")({
  component: SettingsGitPage,
  loader: async ({ context }) => {
    const { enabled: _, ...fileQuery } = fileContentQuery("company.yaml")
    await context.queryClient.ensureQueryData({
      ...fileQuery,
      queryKey: [...queryKeys.company.detail("git")] as string[],
    })
  },
})

const gitSchema = z.object({
  autoCommit: z.boolean(),
  commitInterval: z.number().min(1).max(3600),
  autoPush: z.boolean(),
  remote: z.string(),
})

type GitFormValues = z.infer<typeof gitSchema>

function parseGitConfig(content: string): GitFormValues {
  const config: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf(":")
    if (idx === -1) continue
    config[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/['"]/g, "")
  }

  return {
    autoCommit: config.auto_commit !== "false",
    commitInterval: Number(config.commit_interval) || 5,
    autoPush: config.auto_push === "true",
    remote: config.git_remote ?? "",
  }
}

function serializeGitConfig(values: GitFormValues, existingContent: string): string {
  // Preserve existing config lines, update git-related ones
  const lines = existingContent.split("\n")
  const updates: Record<string, string> = {
    auto_commit: String(values.autoCommit),
    commit_interval: String(values.commitInterval),
    auto_push: String(values.autoPush),
    git_remote: values.remote,
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

  // Add any missing keys
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      result.push(`${key}: ${value}`)
    }
  }

  return result.join("\n")
}

function SettingsGitPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { enabled: _e, ...gitFileQuery } = fileContentQuery("company.yaml")
  const { data: content } = useSuspenseQuery({
    ...gitFileQuery,
    queryKey: [...queryKeys.company.detail("git")] as string[],
  })

  const saveMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: "company.yaml" },
        json: { content: yaml },
      })
      if (!res.ok) throw new Error("Failed to save git settings")
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const existing = content ?? ""
  const initialValues = parseGitConfig(existing)

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader title={t("settings.git")} description={t("settings.git_description")} />
      <div className="flex-1 overflow-y-auto p-6">
        <GitForm
          initialValues={initialValues}
          onSave={(v) => saveMutation.mutate(serializeGitConfig(v, existing))}
          isSaving={saveMutation.isPending}
        />
      </div>
    </div>
  )
}

function GitForm({
  initialValues,
  onSave,
  isSaving,
}: {
  initialValues: GitFormValues
  onSave: (v: GitFormValues) => void
  isSaving: boolean
}) {
  const { t } = useTranslation()
  const methods = useForm<GitFormValues>({
    resolver: zodResolver(gitSchema),
    defaultValues: initialValues,
  })

  const autoCommit = methods.watch("autoCommit")
  const autoPush = methods.watch("autoPush")

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSave)}
        className="flex max-w-lg flex-col gap-6"
      >
        <FormSection title={t("settings.git")}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="font-heading text-xs font-medium">
                {t("settings.git_auto_commit")}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {t("settings.git_auto_commit_desc")}
              </p>
            </div>
            <Switch
              checked={autoCommit}
              onCheckedChange={(v) => methods.setValue("autoCommit", v, { shouldDirty: true })}
            />
          </div>

          <FormField
            name="commitInterval"
            label={t("settings.git_commit_interval")}
            type="number"
            disabled={!autoCommit}
          />

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="font-heading text-xs font-medium">
                {t("settings.git_auto_push")}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {t("settings.git_auto_push_desc")}
              </p>
            </div>
            <Switch
              checked={autoPush}
              onCheckedChange={(v) => methods.setValue("autoPush", v, { shouldDirty: true })}
            />
          </div>

          <FormField
            name="remote"
            label={t("settings.git_remote")}
            placeholder={t("settings.git_remote_placeholder")}
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
