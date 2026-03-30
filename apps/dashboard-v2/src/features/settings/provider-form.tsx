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
  CloudIcon,
} from "@phosphor-icons/react"
import { m, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FormSection, FormSelect } from "@/components/forms"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useDeploymentMode } from "@/hooks/use-deployment-mode"

type ProviderStatus = { configured: boolean; model?: string }

const providerSchema = z.object({
  openrouterApiKey: z.string(),
  embeddingsProvider: z.enum(["gemini", "local", "none"]),
})

type ProviderFormValues = z.infer<typeof providerSchema>

const EMBEDDINGS_OPTIONS = [
  { value: "gemini", label: "Gemini embeddings" },
  { value: "local", label: "Local embeddings" },
  { value: "none", label: "None (FTS5 only)" },
]

/**
 * AI provider configuration form.
 * Manages the OpenRouter API key and embeddings settings.
 * In cloud mode, shows a managed banner instead.
 */
export function ProviderForm() {
  const { t } = useTranslation()
  const { data: deploymentMode, isLoading: isLoadingMode } = useDeploymentMode()

  const { data: providerStatus } = useQuery({
    queryKey: ["settings", "providers"],
    queryFn: async () => {
      const res = await api.api.settings.providers.$get()
      if (!res.ok) throw new Error("Failed to load provider status")
      return (await res.json()) as Record<string, ProviderStatus>
    },
  })

  const methods = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      openrouterApiKey: "",
      embeddingsProvider: "none",
    },
  })

  if (isLoadingMode) return null

  if (deploymentMode === "cloud") {
    return (
      <div className="flex max-w-lg flex-col gap-6">
        <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 p-4">
          <CloudIcon className="size-6 text-primary" />
          <div>
            <p className="font-heading text-sm font-medium">
              {t("settings.cloud_managed")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.cloud_managed_desc")}
            </p>
          </div>
        </div>

        <FormProvider {...methods}>
          <FormSection title={t("settings.provider_embeddings")}>
            <FormSelect
              name="embeddingsProvider"
              label={t("settings.provider_embeddings")}
              options={EMBEDDINGS_OPTIONS}
            />
          </FormSection>
        </FormProvider>
      </div>
    )
  }

  return (
    <FormProvider {...methods}>
      <form
        // Client-side form: prevent default submission, individual fields save on change
        onSubmit={(e) => e.preventDefault()}
        className="flex max-w-lg flex-col gap-8"
      >
        <OpenRouterCard configured={providerStatus?.openrouter?.configured} />

        <FormSection title={t("settings.provider_embeddings")}>
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

function OpenRouterCard({ configured }: { configured?: boolean }) {
  const { t } = useTranslation()
  const { control, getValues } = useFormContext()
  const queryClient = useQueryClient()
  const [showKey, setShowKey] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const key = getValues("openrouterApiKey") as string
      if (!key) throw new Error("API key is required")
      const res = await api.api.settings.providers[":provider"].$post({
        param: { provider: "openrouter" },
        json: { apiKey: key },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? "Failed to save OpenRouter key")
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
          {t("settings.provider_openrouter")}
          {configured && saveStatus === "idle" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-success">
              <CheckCircleIcon size={10} className="mr-0.5" />
              {t("settings.provider_configured")}
            </Badge>
          )}
        </span>
      }
      description={t("settings.provider_openrouter_desc")}
    >
      <div className="flex flex-col gap-3">
        <Controller
          control={control}
          name="openrouterApiKey"
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
                      : "sk-or-..."
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
                  <AnimatePresence mode="wait" initial={false}>
                    <m.span
                      key={showKey ? "hide" : "show"}
                      initial={{ opacity: 0, rotate: -90 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.15 }}
                    >
                      {showKey ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
                    </m.span>
                  </AnimatePresence>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                300+ models from Anthropic, OpenAI, Google, and more.{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Get your key
                </a>
              </p>
            </div>
          )}
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
            {saveStatus === "success" && <CheckCircleIcon size={12} className="text-success" />}
            {saveStatus === "failed" && <XCircleIcon size={12} className="text-destructive" />}
            {saveStatus === "idle" && <FloppyDiskIcon size={12} />}
            {t("settings.provider_save_key")}
          </Button>
          {saveStatus === "success" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-success">
              {t("settings.provider_test_success")}
            </Badge>
          )}
          {saveStatus === "failed" && (
            <Badge variant="secondary" className="rounded-none text-[10px] text-destructive">
              {saveMutation.error?.message ?? t("settings.provider_test_failed")}
            </Badge>
          )}
        </div>
      </div>
    </FormSection>
  )
}
