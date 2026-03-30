import { useState, useCallback } from "react"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  PencilSimpleIcon,
  FloppyDiskIcon,
  XIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { agentsQuery } from "@/features/team/team.queries"
import { AgentCard } from "@/features/team/agent-card"
import { toast } from "sonner"
import { api } from "@/lib/api"

/**
 * Agent YAML editor for the settings page.
 * Shows agent cards in a visual grid with an edit mode that
 * opens an inline YAML editor.
 */
export function AgentEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: agents } = useSuspenseQuery(agentsQuery)
  const [editing, setEditing] = useState(false)
  const [yamlContent, setYamlContent] = useState("")
  const [yamlError, setYamlError] = useState<string | null>(null)

  // Load raw YAML
  const loadYaml = useCallback(async () => {
    const res = await api.api.fs[":path{.+}"].$get({ param: { path: "agents.yaml" } })
    if (!res.ok) throw new Error(t("errors.failed_load_agents"))
    const data = await res.text()
    setYamlContent(data)
    setEditing(true)
    setYamlError(null)
  }, [t])

  // Save YAML
  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: "agents.yaml" },
        json: { content },
      })
      if (!res.ok) throw new Error(t("errors.failed_save_agents"))
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.root })
    },
    onError: (err) => {
      toast.error((err as Error).message)
    },
  })

  function handleSave() {
    // Basic YAML validation — check for obvious issues
    try {
      if (!yamlContent.includes("agents:")) {
        setYamlError(t("errors.yaml_missing_agents_key"))
        return
      }
      setYamlError(null)
      saveMutation.mutate(yamlContent)
    } catch (e) {
      setYamlError((e as Error).message)
    }
  }

  // Edit mode: YAML editor
  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-medium">
            agents.yaml
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditing(false)
                setYamlError(null)
              }}
            >
              <XIcon size={14} />
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <FloppyDiskIcon size={14} />
              {t("common.save")}
            </Button>
          </div>
        </div>

        {yamlError && (
          <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 p-2">
            <WarningIcon size={14} className="text-destructive" />
            <span className="text-xs text-destructive">{yamlError}</span>
          </div>
        )}

        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          className="min-h-[400px] w-full border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none"
          spellCheck={false}
        />
      </div>
    )
  }

  // View mode: agent card grid
  const agentList = agents ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-medium">
          {t("settings.agents")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void loadYaml()}
        >
          <PencilSimpleIcon size={14} />
          {t("common.edit")}
        </Button>
      </div>

      {agentList.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("team.no_agents")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-0 lg:grid-cols-3">
          {agentList.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  )
}
