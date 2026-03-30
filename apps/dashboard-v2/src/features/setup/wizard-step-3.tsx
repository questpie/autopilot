import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeftIcon, WarningCircleIcon, CloudIcon } from "@phosphor-icons/react"
import { useState, useCallback } from "react"
import { useWizardState } from "./use-wizard-state"
import { useDeploymentMode } from "@/hooks/use-deployment-mode"
import { api } from "@/lib/api"

const providerSchema = z.object({
  apiKey: z.string().min(1, "OpenRouter API key is required"),
})

type ProviderValues = z.infer<typeof providerSchema>

interface WizardStep3Props {
  onComplete: () => void
  onBack: () => void
}

export function WizardStep3({ onComplete, onBack }: WizardStep3Props) {
  const { t } = useTranslation()
  const { completeStep } = useWizardState()

  const [error, setError] = useState<string | null>(null)
  const { data: deploymentMode, isLoading: isLoadingMode } = useDeploymentMode()

  const apiKeyRefCallback = useCallback((el: HTMLInputElement | null) => {
    el?.focus()
  }, [])

  const form = useForm<ProviderValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: { apiKey: "" },
  })

  const onSubmit = async (values: ProviderValues) => {
    setError(null)

    try {
      // Save OpenRouter API key
      const res = await api.api.settings.providers[":provider"].$post({
        param: { provider: "openrouter" },
        json: { apiKey: values.apiKey },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? "Failed to save API key")
      }

      completeStep(3)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration")
    }
  }

  if (isLoadingMode) return null

  if (deploymentMode === "cloud") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("setup.step_3_title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("setup.step_3_cloud_description")}
          </p>
        </div>

        <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 p-4">
          <CloudIcon className="size-6 text-primary" />
          <div>
            <p className="font-heading text-sm font-medium">
              {t("setup.step_3_cloud_managed")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("setup.step_3_cloud_managed_desc")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onBack}>
            <ArrowLeftIcon className="size-4" />
            {t("common.back")}
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              completeStep(3)
              onComplete()
            }}
          >
            {t("common.continue")}
          </Button>
        </div>
      </div>
    )
  }

  // Self-hosted mode — OpenRouter API key
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          {t("setup.step_3_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_3_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* OpenRouter API key */}
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key" className="font-heading text-xs font-medium">
              {t("setup.step_3_openrouter_key")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("setup.step_3_openrouter_desc")}{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                openrouter.ai/keys
              </a>
            </p>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-or-..."
              disabled={form.formState.isSubmitting}
              aria-invalid={!!form.formState.errors.apiKey}
              {...form.register("apiKey")}
              ref={(el) => {
                form.register("apiKey").ref(el)
                apiKeyRefCallback(el)
              }}
            />
            {form.formState.errors.apiKey && (
              <p className="text-xs text-destructive">{form.formState.errors.apiKey.message}</p>
            )}
          </div>

          {/* CLI hint */}
          <p className="text-xs text-muted-foreground/60">
            {t("setup.cli_hint")}: OPENROUTER_API_KEY=sk-or-... autopilot start
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
              {t("common.back")}
            </Button>
            <Button
              type="submit"
              size="lg"
              className="flex-1"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  {t("common.loading")}
                </>
              ) : (
                t("common.continue")
              )}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}

