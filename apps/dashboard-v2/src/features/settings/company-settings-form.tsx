/**
 * D45: Company settings form — require_approval, max_concurrent_agents,
 * micro_agents, auth settings, agent_http_allowlist.
 * D48: Company-level model/provider defaults.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface CompanySettings {
  require_approval?: boolean
  max_concurrent_agents?: number
  micro_agents?: boolean
  agent_http_allowlist?: string[]
  default_model?: string
  default_provider?: string
  utility_model?: string
}

export function CompanySettingsForm() {
  const queryClient = useQueryClient()

  const { data: rawSettings, isLoading } = useQuery({
    queryKey: queryKeys.company.detail("settings"),
    queryFn: async () => {
      const res = await api.api.settings.$get()
      if (!res.ok) throw new Error("Failed to fetch settings")
      return res.json()
    },
  })

  const settings = (rawSettings as Record<string, unknown>)?.settings as CompanySettings | undefined

  const [form, setForm] = useState<CompanySettings>({})

  // Sync server data to form state when settings change
  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async (updates: CompanySettings) => {
      const res = await api.api.settings.$patch({
        json: { settings: updates },
      })
      if (!res.ok) throw new Error("Failed to save settings")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.company.root })
      toast.success("Settings saved")
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  if (isLoading) {
    return <div className="animate-pulse space-y-4 p-6"><div className="h-8 w-48 bg-muted rounded" /><div className="h-32 bg-muted rounded" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Agent Settings */}
      <section>
        <h3 className="mb-3 font-heading text-sm font-semibold">Agent Settings</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3" aria-label="Require approval">
            <input
              type="checkbox"
              checked={form.require_approval ?? false}
              onChange={(e) => setForm({ ...form, require_approval: e.target.checked })}
              className="size-4 rounded border-border"
            />
            <div>
              <div className="text-sm font-medium">Require approval</div>
              <div className="text-xs text-muted-foreground">Tasks must be approved before agents can start</div>
            </div>
          </label>

          <label className="flex items-center gap-3" aria-label="Micro-agent routing">
            <input
              type="checkbox"
              checked={form.micro_agents ?? true}
              onChange={(e) => setForm({ ...form, micro_agents: e.target.checked })}
              className="size-4 rounded border-border"
            />
            <div>
              <div className="text-sm font-medium">Micro-agent routing</div>
              <div className="text-xs text-muted-foreground">Use LLM for intelligent message routing</div>
            </div>
          </label>

          <div>
            <label htmlFor="max-concurrent-agents" className="mb-1 block text-sm font-medium">Max concurrent agents</label>
            <input
              id="max-concurrent-agents"
              type="number"
              min={1}
              max={50}
              value={form.max_concurrent_agents ?? 5}
              onChange={(e) => setForm({ ...form, max_concurrent_agents: Number(e.target.value) })}
              className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </section>

      {/* D48: Model Defaults */}
      <section>
        <h3 className="mb-3 font-heading text-sm font-semibold">Model Defaults</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="default-model" className="mb-1 block text-sm font-medium">Default model</label>
            <input
              id="default-model"
              type="text"
              value={form.default_model ?? ""}
              onChange={(e) => setForm({ ...form, default_model: e.target.value })}
              placeholder="anthropic/claude-sonnet-4"
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">OpenRouter model ID for new agents</p>
          </div>

          <div>
            <label htmlFor="utility-model" className="mb-1 block text-sm font-medium">Utility model</label>
            <input
              id="utility-model"
              type="text"
              value={form.utility_model ?? ""}
              onChange={(e) => setForm({ ...form, utility_model: e.target.value })}
              placeholder="google/gemini-2.0-flash-001"
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">Fast/cheap model for routing, classification, memory extraction</p>
          </div>
        </div>
      </section>

      {/* HTTP Allowlist */}
      <section>
        <h3 className="mb-3 font-heading text-sm font-semibold">HTTP Allowlist</h3>
        <div>
          <textarea
            value={(form.agent_http_allowlist ?? []).join("\n")}
            onChange={(e) =>
              setForm({
                ...form,
                agent_http_allowlist: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="api.github.com&#10;*.openai.com&#10;hooks.slack.com"
            rows={4}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm font-mono"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">
            One hostname per line. Agents can only call these domains via fetch tool.
          </p>
        </div>
      </section>

      <Button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? "Saving..." : "Save settings"}
      </Button>
    </div>
  )
}
