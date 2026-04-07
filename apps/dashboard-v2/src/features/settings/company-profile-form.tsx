import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query"
import { FloppyDiskIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { FormField, FormTextarea, FormSelect, FormSection, FormActions } from "@/components/forms"
import { fileContentQuery } from "@/features/files/files.queries"
import { api } from "@/lib/api"

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string(),
  timezone: z.string(),
  language: z.string(),
})

type CompanyFormValues = z.infer<typeof companySchema>

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Bratislava", label: "Europe/Bratislava" },
  { value: "Europe/Prague", label: "Europe/Prague" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
]

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "sk", label: "Slovak" },
  { value: "cs", label: "Czech" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
]

function parseCompanyYaml(content: string): CompanyFormValues {
  const config: Record<string, string> = {}
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value = trimmed.slice(colonIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    config[key] = value
  }

  return {
    name: config.name ?? "",
    description: config.description ?? "",
    timezone: config.timezone ?? "UTC",
    language: config.language ?? "en",
  }
}

function serializeCompanyYaml(values: CompanyFormValues): string {
  const lines: string[] = []
  lines.push(`name: ${values.name}`)
  lines.push(`description: ${values.description}`)
  lines.push(`timezone: ${values.timezone}`)
  lines.push(`language: ${values.language}`)
  return lines.join("\n") + "\n"
}

/**
 * Company profile form reading/writing company.yaml.
 */
export function CompanyProfileForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { enabled: _, ...profileFileQuery } = fileContentQuery("company.yaml")
  const { data: content } = useSuspenseQuery({
    ...profileFileQuery,
    queryKey: [...queryKeys.company.detail("company.yaml")] as string[],
  })

  const saveMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: "company.yaml" },
        json: { content: yaml },
      })
      if (!res.ok) throw new Error("Failed to save company.yaml")
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
    onError: (err) => {
      toast.error((err as Error).message)
    },
  })

  const initialValues = parseCompanyYaml(content ?? "")

  return <CompanyProfileFormInner initialValues={initialValues} onSave={(v) => saveMutation.mutate(serializeCompanyYaml(v))} isSaving={saveMutation.isPending} />
}

function CompanyProfileFormInner({
  initialValues,
  onSave,
  isSaving,
}: {
  initialValues: CompanyFormValues
  onSave: (values: CompanyFormValues) => void
  isSaving: boolean
}) {
  const { t } = useTranslation()

  const methods = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: initialValues,
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSave)}
        className="flex max-w-lg flex-col gap-6"
      >
        <FormSection title={t("settings.company")}>
          <FormField name="name" label={t("settings.company_name")} autoFocus />
          <FormTextarea name="description" label={t("settings.company_description")} rows={3} />
        </FormSection>

        <FormSection title={t("settings.general")}>
          <FormSelect
            name="timezone"
            label={t("settings.company_timezone")}
            options={TIMEZONE_OPTIONS}
          />
          <FormSelect
            name="language"
            label={t("settings.company_language")}
            options={LANGUAGE_OPTIONS}
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
