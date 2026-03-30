import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  TreeStructureIcon,
  PencilSimpleIcon,
  FloppyDiskIcon,
  XIcon,
  PlusIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { directoryQuery } from "@/features/files/files.queries"
import WorkflowDiagramView from "@/features/files/views/workflow-diagram-view"
import { api } from "@/lib/api"

interface WorkflowSummary {
  filename: string
  name: string
  version: string
  stepCount: number
  content: string
}

function parseWorkflowName(content: string): string {
  const match = content.match(/^name:\s*(.+)/m)
  return match?.[1]?.trim().replace(/['"]/g, "") ?? ""
}

function parseWorkflowVersion(content: string): string {
  const match = content.match(/^version:\s*(.+)/m)
  return match?.[1]?.trim() ?? "1"
}

function countSteps(content: string): number {
  return (content.match(/^\s*-\s+id:/gm) ?? []).length
}

const WORKFLOW_TEMPLATE = `name: new-workflow
description: Describe your workflow
version: 1
steps:
  - id: start
    name: Start
    type: start
    transitions:
      - target: work
  - id: work
    name: Do work
    type: action
    agent: default
    transitions:
      - target: review
  - id: review
    name: Human review
    type: gate
    transitions:
      - target: done
        condition: approved
      - target: work
        condition: rejected
  - id: done
    name: Complete
    type: end
`

/**
 * Workflow editor — list, view diagram, edit YAML.
 */
export function WorkflowEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [yamlContent, setYamlContent] = useState("")
  const [yamlError, setYamlError] = useState<string | null>(null)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")

  const { data: workflowFiles, isLoading } = useQuery({
    ...directoryQuery("workflows"),
    queryKey: [...queryKeys.workflows.list(), "directory"],
  })

  const yamlFiles = useMemo(
    () => workflowFiles?.filter((f) => f.type === "file" && f.name.endsWith(".yaml")) ?? [],
    [workflowFiles],
  )

  // Load all workflow summaries
  const { data: summaries } = useQuery({
    queryKey: queryKeys.workflows.list({ summaries: true }),
    queryFn: async (): Promise<WorkflowSummary[]> => {
      const results: WorkflowSummary[] = []
      for (const file of yamlFiles) {
        try {
          const res = await api.api.fs[":path{.+}"].$get({ param: { path: `workflows/${file.name}` } })
          if (res.ok) {
            const content = await res.text()
            results.push({
              filename: file.name,
              name: parseWorkflowName(content) || file.name.replace(".yaml", ""),
              version: parseWorkflowVersion(content),
              stepCount: countSteps(content),
              content,
            })
          }
        } catch {
          // Skip unreadable files
        }
      }
      return results
    },
    enabled: yamlFiles.length > 0,
    staleTime: 30_000,
  })

  const selectedWorkflow = summaries?.find((s) => s.filename === selected)

  const saveMutation = useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: `workflows/${filename}` },
        json: { content },
      })
      if (!res.ok) throw new Error("Failed to save workflow")
    },
    onSuccess: () => {
      toast.success(t("settings.workflow_saved"))
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const createMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await api.api.files[":path{.+}"].$post({
        param: { path: `workflows/${filename}.yaml` },
        json: { content: WORKFLOW_TEMPLATE.replace("new-workflow", filename) },
      })
      if (!res.ok) throw new Error("Failed to create workflow")
    },
    onSuccess: (_, filename) => {
      toast.success(t("settings.workflow_created"))
      setNewDialogOpen(false)
      setNewName("")
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
      setSelected(`${filename}.yaml`)
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const handleEdit = useCallback(() => {
    if (selectedWorkflow) {
      setYamlContent(selectedWorkflow.content)
      setEditing(true)
      setYamlError(null)
    }
  }, [selectedWorkflow])

  const handleSave = useCallback(() => {
    if (!selected) return
    // Basic validation
    if (!yamlContent.includes("steps:")) {
      setYamlError(t("settings.workflow_validation_error") + ": missing 'steps:' key")
      return
    }
    setYamlError(null)
    saveMutation.mutate({ filename: selected, content: yamlContent })
  }, [selected, yamlContent, saveMutation, t])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const workflowList = summaries ?? []

  // Detail view
  if (selected && selectedWorkflow) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => {
              setSelected(null)
              setEditing(false)
            }}
          >
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    setEditing(false)
                    setYamlError(null)
                  }}
                >
                  <XIcon size={12} />
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  <FloppyDiskIcon size={12} />
                  {t("common.save")}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleEdit}
              >
                <PencilSimpleIcon size={12} />
                {t("settings.workflow_edit_yaml")}
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
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
        ) : (
          <WorkflowDiagramView
            path={`workflows/${selected}`}
            content={selectedWorkflow.content}
          />
        )}
      </div>
    )
  }

  // List view
  return (
    <div className="flex flex-col gap-4">
      {workflowList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border border-dashed border-border p-8">
          <TreeStructureIcon size={24} className="text-muted-foreground" />
          <p className="font-heading text-xs text-muted-foreground">
            {t("settings.workflow_no_workflows")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("settings.workflow_no_workflows_desc")}
          </p>
        </div>
      ) : (
        workflowList.map((wf) => (
          <button
            key={wf.filename}
            type="button"
            onClick={() => setSelected(wf.filename)}
            className="flex items-center justify-between border border-border p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <TreeStructureIcon size={18} className="text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-sm font-medium">{wf.name}</span>
                <span className="text-[10px] text-muted-foreground">{wf.filename}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-none text-[10px]">
                v{wf.version}
              </Badge>
              <Badge variant="secondary" className="rounded-none text-[10px]">
                {wf.stepCount} {t("settings.workflow_steps").toLowerCase()}
              </Badge>
            </div>
          </button>
        ))
      )}

      {/* New workflow dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="rounded-none sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {t("settings.workflow_new")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="font-heading text-xs">{t("settings.workflow_name")}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.currentTarget.value.replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-workflow"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!newName || createMutation.isPending}
              onClick={() => createMutation.mutate(newName)}
              className="gap-1"
            >
              <PlusIcon size={14} />
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
