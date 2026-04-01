import { useMemo } from "react"
import { queryOptions, useQuery } from "@tanstack/react-query"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ModelInfo {
  id: string
  name: string
  provider: string
  pricing?: {
    prompt?: string
    completion?: string
  }
}

export const modelsQuery = queryOptions({
  queryKey: [...queryKeys.providers.root, "models"],
  queryFn: async (): Promise<ModelInfo[]> => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:7778"}/api/settings/models`, {
        credentials: "include",
      })
      if (!res.ok) return FALLBACK_MODELS
      return (await res.json()) as ModelInfo[]
    } catch (_err: unknown) {
      // Endpoint may not exist yet; fall back to built-in list
      return FALLBACK_MODELS
    }
  },
  staleTime: 5 * 60 * 1000,
})

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "Anthropic", pricing: { prompt: "$3", completion: "$15" } },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "Anthropic", pricing: { prompt: "$15", completion: "$75" } },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "Anthropic", pricing: { prompt: "$0.80", completion: "$4" } },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", pricing: { prompt: "$2.50", completion: "$10" } },
  { id: "o3", name: "o3", provider: "OpenAI", pricing: { prompt: "$10", completion: "$40" } },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", pricing: { prompt: "$0.15", completion: "$0.60" } },
  { id: "codex-mini", name: "Codex Mini", provider: "OpenAI" },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", provider: "Google", pricing: { prompt: "$1.25", completion: "$10" } },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", provider: "Google", pricing: { prompt: "$0.15", completion: "$0.60" } },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", pricing: { prompt: "$0.55", completion: "$2.19" } },
  { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", provider: "DeepSeek", pricing: { prompt: "$0.27", completion: "$1.10" } },
]

interface ModelPickerProps {
  value: string
  onValueChange: (value: string) => void
  size?: "sm" | "default"
  className?: string
}

export function ModelPicker({
  value,
  onValueChange,
  size = "default",
  className,
}: ModelPickerProps) {
  const { t } = useTranslation()
  const { data: models } = useQuery(modelsQuery)

  const { grouped, providers } = useMemo(() => {
    const list = models ?? FALLBACK_MODELS
    const groups = new Map<string, ModelInfo[]>()

    for (const model of list) {
      const existing = groups.get(model.provider)
      if (existing) {
        existing.push(model)
      } else {
        groups.set(model.provider, [model])
      }
    }

    return { grouped: groups, providers: Array.from(groups.keys()).sort() }
  }, [models])

  return (
    <Select value={value} onValueChange={(v) => { if (v !== null) onValueChange(v) }}>
      <SelectTrigger size={size} className={className}>
        <SelectValue placeholder={t("settings.model_picker_placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {providers.map((provider, idx) => {
          const providerModels = grouped.get(provider) ?? []
          return (
            <SelectGroup key={provider}>
              <SelectLabel>{provider}</SelectLabel>
              {providerModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <span className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.pricing?.prompt && (
                      <span className="text-[10px] text-muted-foreground">
                        {model.pricing.prompt}/M in
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
              {idx < providers.length - 1 && <SelectSeparator />}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
