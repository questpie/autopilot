import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"
import { api } from "@/lib/api"

type Provider = "claude" | "openai"
type EmbeddingsChoice = "gemini" | "local" | "none"

const providerSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
})

type ProviderValues = z.infer<typeof providerSchema>

interface WizardStep3Props {
  onComplete: () => void
  onBack: () => void
}

export function WizardStep3({ onComplete, onBack }: WizardStep3Props) {
  const { t } = useTranslation()
  const { setProviderChoice, completeStep } = useWizardState()

  const [provider, setProvider] = useState<Provider>("claude")
  const [embeddings, setEmbeddings] = useState<EmbeddingsChoice>("gemini")
  const [geminiKey, setGeminiKey] = useState("")
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ProviderValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: { apiKey: "" },
  })

  const onSubmit = async (values: ProviderValues) => {
    setError(null)

    try {
      // Save provider config to backend
      const envKey = provider === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"
      const body: Record<string, string> = { [envKey]: values.apiKey }

      if (embeddings === "gemini" && geminiKey) {
        body.GEMINI_API_KEY = geminiKey
      }

      const res = await api.api.settings.$patch({
        json: body,
      })

      if (!res.ok) {
        throw new Error("Failed to save provider configuration")
      }

      setProviderChoice(provider)
      completeStep(3)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">
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

      {/* Provider selection */}
      <div className="flex flex-col gap-2">
        <ProviderOption
          selected={provider === "claude"}
          onSelect={() => setProvider("claude")}
          label={t("setup.step_3_claude")}
          recommended
        />
        <ProviderOption
          selected={provider === "openai"}
          onSelect={() => setProvider("openai")}
          label={t("setup.step_3_openai")}
        />
      </div>

      {/* API key */}
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key" className="font-heading text-xs font-medium">
              {t("setup.step_3_paste_key")}
            </Label>
            <Input
              id="api-key"
              type="password"
              autoFocus
              placeholder={provider === "claude" ? "sk-ant-..." : "sk-..."}
              disabled={form.formState.isSubmitting}
              aria-invalid={!!form.formState.errors.apiKey}
              {...form.register("apiKey")}
            />
            {form.formState.errors.apiKey && (
              <p className="text-xs text-destructive">{form.formState.errors.apiKey.message}</p>
            )}
          </div>

          {/* Embeddings */}
          <div className="flex flex-col gap-2">
            <Label className="font-heading text-xs font-medium">
              {t("setup.step_3_embeddings")} ({t("common.optional")})
            </Label>

            <EmbeddingsOption
              selected={embeddings === "gemini"}
              onSelect={() => setEmbeddings("gemini")}
              label={t("setup.step_3_embeddings_gemini")}
              description={t("setup.step_3_embeddings_gemini_desc")}
            />

            {embeddings === "gemini" && (
              <div className="ml-6">
                <Input
                  type="password"
                  placeholder="GEMINI_API_KEY"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.currentTarget.value)}
                  disabled={form.formState.isSubmitting}
                />
              </div>
            )}

            <EmbeddingsOption
              selected={embeddings === "local"}
              onSelect={() => setEmbeddings("local")}
              label={t("setup.step_3_embeddings_local")}
              description={t("setup.step_3_embeddings_local_desc")}
            />
            <EmbeddingsOption
              selected={embeddings === "none"}
              onSelect={() => setEmbeddings("none")}
              label={t("setup.step_3_embeddings_none")}
            />
          </div>

          {/* CLI hint */}
          <p className="text-xs text-muted-foreground/60">
            {t("setup.cli_hint")}: autopilot provider login {provider}
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

function ProviderOption({
  selected,
  onSelect,
  label,
  recommended,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  recommended?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 border p-3 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <div
        className={`flex size-4 items-center justify-center border ${
          selected ? "border-primary" : "border-input"
        }`}
      >
        {selected && <div className="size-2 bg-primary" />}
      </div>
      <span className="flex-1 font-heading text-xs font-medium">{label}</span>
      {recommended && (
        <span className="text-xs text-primary">recommended</span>
      )}
    </button>
  )
}

function EmbeddingsOption({
  selected,
  onSelect,
  label,
  description,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 border p-2.5 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <div
        className={`mt-0.5 flex size-3.5 items-center justify-center border ${
          selected ? "border-primary" : "border-input"
        }`}
      >
        {selected && <div className="size-1.5 bg-primary" />}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-xs font-medium">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    </button>
  )
}
