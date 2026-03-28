import { useState } from "react"
import { useForm, FormProvider, useFormContext, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { FormSection, FormSelect } from "@/components/forms"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

type ProviderName = "claude" | "openai" | "gemini"
type ProviderStatus = { configured: boolean; model?: string }

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

  const { data: providerStatus } = useQuery({
    queryKey: ["settings", "providers"],
    queryFn: async () => {
      const res = await api.api.settings.providers.$get()
      if (!res.ok) throw new Error("Failed to load provider status")
      return (await res.json()) as Record<ProviderName, ProviderStatus>
    },
  })

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

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex max-w-lg flex-col gap-8"
      >
        <ProviderCard
          title={t("settings.provider_claude")}
          description={t("settings.provider_claude_desc")}
          provider="claude"
          apiKeyName="claudeApiKey"
          modelName="claudeModel"
          modelOptions={CLAUDE_MODELS}
          configured={providerStatus?.claude?.configured}
        />

        <ProviderCard
          title={t("settings.provider_openai")}
          description={t("settings.provider_openai_desc")}
          provider="openai"
          apiKeyName="openaiApiKey"
          modelName="openaiModel"
          modelOptions={OPENAI_MODELS}
          configured={providerStatus?.openai?.configured}
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
      </form>
    </FormProvider>
  )
}

function ProviderCard({
  title,
  description,
  provider,
  apiKeyName,
  modelName,
  modelOptions,
  configured,
}: {
  title: string
  description: string
  provider: ProviderName
  apiKeyName: string
  modelName: string
  modelOptions: Array<{ value: string; label: string }>
  configured?: boolean
}) {
  const { t } = useTranslation()
  const { control, getValues } = useFormContext()
  const queryClient = useQueryClient()
  const [showKey, setShowKey] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const key = getValues(apiKeyName) as string
      if (!key) throw new Error("API key is required")
      const res = await api.api.settings.providers[":provider"].$post({
        param: { provider },
        json: { apiKey: key },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Failed to save ${provider} key`)
      }
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      void queryClient.invalidateQueries({ queryKey: ["settings", "providers"] })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const saveStatus = saveMutation.isSuccess
    ? "success"
    : saveMutation.isError
      ? "failed"
      : saveMutation.isPending
        ? "saving"
        : "idle"

  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          {title}
          {configured && saveStatus === "idle" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-green-400">
              <CheckCircleIcon size={10} className="mr-0.5" />
              {t("settings.provider_configured")}
            </Badge>
          )}
        </span>
      }
      description={description}
    >
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
                  placeholder={
                    configured
                      ? t("settings.provider_api_key_configured")
                      : t("settings.provider_api_key_placeholder")
                  }
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
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-1.5 text-xs"
          >
            {saveStatus === "saving" && <CircleNotchIcon size={12} className="animate-spin" />}
            {saveStatus === "success" && <CheckCircleIcon size={12} className="text-green-500" />}
            {saveStatus === "failed" && <XCircleIcon size={12} className="text-red-500" />}
            {saveStatus === "idle" && <FloppyDiskIcon size={12} />}
            {t("settings.provider_save_key")}
          </Button>
          {saveStatus === "success" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-green-400">
              {t("settings.provider_test_success")}
            </Badge>
          )}
          {saveStatus === "failed" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-red-400">
              {saveMutation.error?.message ?? t("settings.provider_test_failed")}
            </Badge>
          )}
        </div>
      </div>
    </FormSection>
  )
}

