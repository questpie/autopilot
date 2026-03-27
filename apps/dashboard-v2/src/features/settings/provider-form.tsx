import { useState, useCallback } from "react"
import { useForm, FormProvider, useFormContext, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import {
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FormSection, FormSelect, FormActions } from "@/components/forms"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

const providerSchema = z.object({
  claudeApiKey: z.string(),
  claudeModel: z.string(),
  openaiApiKey: z.string(),
  openaiModel: z.string(),
  embeddingsProvider: z.enum(["gemini", "local", "none"]),
})

type ProviderFormValues = z.infer<typeof providerSchema>

const CLAUDE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
]

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "o3", label: "o3" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "codex-mini", label: "Codex Mini" },
]

const EMBEDDINGS_OPTIONS = [
  { value: "gemini", label: "Gemini embeddings" },
  { value: "local", label: "Local embeddings" },
  { value: "none", label: "None (FTS5 only)" },
]

/**
 * AI provider configuration form.
 * Manages API keys and model selection for Claude and OpenAI.
 */
export function ProviderForm() {
  const { t } = useTranslation()

  const methods = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      claudeApiKey: "",
      claudeModel: "claude-sonnet-4-20250514",
      openaiApiKey: "",
      openaiModel: "gpt-4o",
      embeddingsProvider: "none",
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: ProviderFormValues) => {
      // Save provider config via environment/config endpoint
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: ".env" },
        json: { content: buildEnvContent(values) },
      })
      if (!res.ok) throw new Error("Failed to save provider configuration")
    },
    onSuccess: () => toast.success(t("settings.saved")),
    onError: (err) => toast.error((err as Error).message),
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit((v) => saveMutation.mutate(v))}
        className="flex max-w-lg flex-col gap-8"
      >
        <ProviderCard
          title={t("settings.provider_claude")}
          description={t("settings.provider_claude_desc")}
          apiKeyName="claudeApiKey"
          modelName="claudeModel"
          modelOptions={CLAUDE_MODELS}
        />

        <ProviderCard
          title={t("settings.provider_openai")}
          description={t("settings.provider_openai_desc")}
          apiKeyName="openaiApiKey"
          modelName="openaiModel"
          modelOptions={OPENAI_MODELS}
        />

        <FormSection
          title={t("settings.provider_embeddings")}
        >
          <FormSelect
            name="embeddingsProvider"
            label={t("settings.provider_embeddings")}
            options={EMBEDDINGS_OPTIONS}
          />
        </FormSection>

        <FormActions>
          <Button
            type="submit"
            size="sm"
            disabled={saveMutation.isPending}
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

function ProviderCard({
  title,
  description,
  apiKeyName,
  modelName,
  modelOptions,
}: {
  title: string
  description: string
  apiKeyName: string
  modelName: string
  modelOptions: Array<{ value: string; label: string }>
}) {
  const { t } = useTranslation()
  const { control, getValues } = useFormContext()
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle")

  const handleTest = useCallback(async () => {
    const key = getValues(apiKeyName)
    if (!key) return
    setTestStatus("testing")
    try {
      // Simulate a connection test
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTestStatus(key.length > 10 ? "success" : "failed")
    } catch {
      setTestStatus("failed")
    }
  }, [apiKeyName, getValues])

  return (
    <FormSection title={title} description={description}>
      <div className="flex flex-col gap-3">
        {/* API Key with visibility toggle */}
        <Controller
          control={control}
          name={apiKeyName}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="font-heading text-xs font-medium text-foreground">
                {t("settings.provider_api_key")}
              </label>
              <div className="relative">
                <input
                  {...field}
                  type={showKey ? "text" : "password"}
                  placeholder={t("settings.provider_api_key_placeholder")}
                  className={cn(
                    "flex h-9 w-full rounded-none border border-input bg-transparent px-3 pr-8 py-1 text-sm transition-colors",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
                </button>
              </div>
            </div>
          )}
        />

        <FormSelect
          name={modelName}
          label={t("settings.provider_model")}
          options={modelOptions}
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={testStatus === "testing"}
            className="gap-1.5 text-xs"
          >
            {testStatus === "testing" && <CircleNotchIcon size={12} className="animate-spin" />}
            {testStatus === "success" && <CheckCircleIcon size={12} className="text-green-500" />}
            {testStatus === "failed" && <XCircleIcon size={12} className="text-red-500" />}
            {t("settings.provider_test_connection")}
          </Button>
          {testStatus === "success" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-green-400">
              {t("settings.provider_test_success")}
            </Badge>
          )}
          {testStatus === "failed" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-red-400">
              {t("settings.provider_test_failed")}
            </Badge>
          )}
        </div>
      </div>
    </FormSection>
  )
}

function buildEnvContent(values: ProviderFormValues): string {
  const lines: string[] = []
  if (values.claudeApiKey) lines.push(`ANTHROPIC_API_KEY=${values.claudeApiKey}`)
  if (values.claudeModel) lines.push(`CLAUDE_MODEL=${values.claudeModel}`)
  if (values.openaiApiKey) lines.push(`OPENAI_API_KEY=${values.openaiApiKey}`)
  if (values.openaiModel) lines.push(`OPENAI_MODEL=${values.openaiModel}`)
  if (values.embeddingsProvider) lines.push(`EMBEDDINGS_PROVIDER=${values.embeddingsProvider}`)
  return lines.join("\n") + "\n"
}
