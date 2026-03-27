import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { FileUpload } from "@/components/file-upload"
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"
import { api } from "@/lib/api"

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  timezone: z.string().min(1),
  language: z.string().min(1),
})

type CompanyValues = z.infer<typeof companySchema>

interface WizardStep4Props {
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}

export function WizardStep4({ onComplete, onBack, onSkip }: WizardStep4Props) {
  const { t } = useTranslation()
  const { completeStep, skipStep } = useWizardState()
  const [error, setError] = useState<string | null>(null)
  const [logoPath, setLogoPath] = useState<string | null>(null)

  const form = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", description: "", timezone: "UTC", language: "en" },
  })

  const onSubmit = async (values: CompanyValues) => {
    setError(null)
    try {
      const res = await api.api.settings.$patch({
        json: {
          company_name: values.name,
          company_description: values.description,
          timezone: values.timezone,
          language: values.language,
          logo_path: logoPath,
        },
      })

      if (!res.ok) throw new Error("Failed to save company profile")

      completeStep(4)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const handleSkip = () => {
    skipStep(4)
    onSkip()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t("setup.step_4_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_4_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-name" className="font-heading text-xs font-medium">
              {t("setup.step_4_company_name")}
            </Label>
            <Input
              id="company-name"
              autoFocus
              disabled={form.formState.isSubmitting}
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-desc" className="font-heading text-xs font-medium">
              {t("setup.step_4_company_description")}
            </Label>
            <Textarea
              id="company-desc"
              rows={3}
              disabled={form.formState.isSubmitting}
              {...form.register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone" className="font-heading text-xs font-medium">
                {t("setup.step_4_timezone")}
              </Label>
              <Input
                id="timezone"
                placeholder="Europe/Bratislava"
                disabled={form.formState.isSubmitting}
                {...form.register("timezone")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="language" className="font-heading text-xs font-medium">
                {t("setup.step_4_language")}
              </Label>
              <Input
                id="language"
                placeholder="en"
                disabled={form.formState.isSubmitting}
                {...form.register("language")}
              />
            </div>
          </div>

          {/* Logo upload */}
          <div className="flex flex-col gap-1.5">
            <Label className="font-heading text-xs font-medium">
              {t("setup.step_4_logo")} ({t("common.optional")})
            </Label>
            <p className="text-xs text-muted-foreground">{t("setup.step_4_logo_hint")}</p>
            <FileUpload
              targetPath="/knowledge/brand"
              accept={[".png", ".jpg", ".jpeg", ".svg"]}
              maxFileSizeMB={2}
              compact
              showFolderUpload={false}
              onUpload={(paths) => setLogoPath(paths[0] ?? null)}
            />
          </div>

          {/* AI chat placeholder */}
          <div className="border border-dashed border-primary/20 p-3">
            <Input
              placeholder={t("setup.ai_placeholder")}
              disabled
              className="border-0 bg-transparent text-xs"
            />
          </div>

          {/* CLI hint */}
          <p className="text-xs text-muted-foreground/60">
            {t("setup.cli_hint")}: autopilot config company
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
              {t("common.back")}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={handleSkip}>
              {t("common.skip")}
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner size="sm" /> : t("common.continue")}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
