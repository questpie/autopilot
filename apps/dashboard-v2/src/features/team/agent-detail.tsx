import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  CircleIcon,
  PlayIcon,
  PencilSimpleIcon,
  WrenchIcon,
  FolderOpenIcon,
  BrainIcon,
  ListChecksIcon,
  CpuIcon,
  PlugsIcon,
  LightningIcon,
  GlobeIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ModelPicker } from "@/components/model-picker"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { agentDetailQuery } from "./team.queries"
import { getAvatarColor } from "./agent-card"
import { cn } from "@/lib/utils"

interface AgentDetailProps {
  agentId: string
  onClose: () => void
}

export function AgentDetail({ agentId, onClose: _onClose }: AgentDetailProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: agent, isLoading } = useQuery(agentDetailQuery(agentId))

  const modelMutation = useMutation({
    mutationFn: async (model: string) => {
      const res = await api.api.agents[":id"].$patch({
        param: { id: agentId },
        json: { model },
      })
      if (!res.ok) throw new Error("Failed to update model")
    },
    onSuccess: () => {
      toast.success(t("settings.saved"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const webSearchMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await api.api.agents[":id"].$patch({
        param: { id: agentId },
        json: { web_search: enabled },
      })
      if (!res.ok) throw new Error("Failed to update web search")
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  if (isLoading) {
    return <AgentDetailSkeleton />
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <p className="font-heading text-sm text-muted-foreground">
          {t("common.no_results")}
        </p>
      </div>
    )
  }

  const bgColor = getAvatarColor(agent.id)
  const initial = agent.name.charAt(0).toUpperCase()
  const isWorking = ("sessionStatus" in agent && (agent.sessionStatus as string) === "working") as boolean

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header: avatar + name + role */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center text-xl font-bold text-white",
            bgColor,
          )}
        >
          {initial}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold">{agent.name}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {agent.role}
            </Badge>
            <div className="flex items-center gap-1">
              <CircleIcon
                size={8}
                weight={isWorking ? "fill" : "regular"}
                className={cn(
                  isWorking ? "text-success" : "text-muted-foreground",
                  isWorking && "animate-pulse motion-reduce:animate-none",
                )}
              />
              <span className="text-[10px] text-muted-foreground">
                {isWorking ? t("team.status_working") : t("team.status_idle")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link to="/team/$id/session" params={{ id: agentId }} className="flex-1">
          <Button size="sm" className="w-full gap-1.5">
            <PlayIcon size={14} weight="fill" />
            {t("team.attach")}
          </Button>
        </Link>
        <Link to="/settings" className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <PencilSimpleIcon size={14} />
            {t("team.edit_config")}
          </Button>
        </Link>
      </div>

      <Separator />

      {/* Description */}
      <DetailSection icon={BrainIcon} label={t("team.detail_description")}>
        <p className="text-xs text-muted-foreground">{agent.description}</p>
      </DetailSection>

      {/* Model */}
      <DetailSection icon={CpuIcon} label={t("team.detail_model")}>
        <ModelPicker
          value={agent.model}
          onChange={(model) => modelMutation.mutate(model)}
        />
      </DetailSection>

      {/* Web Search */}
      <DetailSection icon={GlobeIcon} label={t("team.detail_web_search")}>
        <button
          type="button"
          onClick={() => webSearchMutation.mutate(!(agent as Record<string, unknown>).web_search)}
          className={cn(
            "flex items-center gap-2 border px-3 py-1.5 text-xs transition-colors",
            (agent as Record<string, unknown>).web_search
              ? "border-success/30 bg-success/10 text-success"
              : "border-border text-muted-foreground hover:border-primary/40",
          )}
        >
          <GlobeIcon size={12} />
          {(agent as Record<string, unknown>).web_search ? "Enabled" : "Disabled"}
        </button>
        <p className="text-[10px] text-muted-foreground">
          Gives this agent real-time web access via OpenRouter
        </p>
      </DetailSection>

      {/* Tools */}
      <DetailSection icon={WrenchIcon} label={t("team.detail_tools")}>
        <div className="flex flex-wrap gap-1">
          {agent.tools.map((tool) => (
            <Badge key={tool} variant="outline" className="text-[10px]">
              {tool}
            </Badge>
          ))}
        </div>
      </DetailSection>

      {/* MCP Integrations */}
      {agent.mcps.length > 0 && (
        <DetailSection icon={PlugsIcon} label={t("team.detail_mcps")}>
          <div className="flex flex-wrap gap-1">
            {agent.mcps.map((mcp) => (
              <Badge key={mcp} variant="outline" className="text-[10px]">
                {mcp}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Filesystem scope */}
      <DetailSection icon={FolderOpenIcon} label={t("team.detail_fs_scope")}>
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">
              {t("team.detail_read_paths")}
            </p>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {agent.fs_scope.read.map((p) => (
                <code
                  key={p}
                  className="bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {p}
                </code>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">
              {t("team.detail_write_paths")}
            </p>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {agent.fs_scope.write.map((p) => (
                <code
                  key={p}
                  className="bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {p}
                </code>
              ))}
            </div>
          </div>
        </div>
      </DetailSection>

      {/* Triggers */}
      {agent.triggers.length > 0 && (
        <DetailSection icon={LightningIcon} label={t("team.detail_triggers")}>
          <div className="flex flex-col gap-1">
            {agent.triggers.map((trigger) => (
              <div key={`${trigger.on}-${trigger.cron ?? ''}`} className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {trigger.on}
                </code>
                {trigger.cron && (
                  <code className="bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {trigger.cron}
                  </code>
                )}
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Memory stats */}
      {"memory" in agent && agent.memory && (
        <DetailSection icon={BrainIcon} label={t("team.detail_memory")}>
          <div className="grid grid-cols-2 gap-2">
            <MemoryStat label={t("team.detail_memory_facts")} count={(agent.memory as MemoryStats).facts} />
            <MemoryStat label={t("team.detail_memory_decisions")} count={(agent.memory as MemoryStats).decisions} />
            <MemoryStat label={t("team.detail_memory_mistakes")} count={(agent.memory as MemoryStats).mistakes} />
            <MemoryStat label={t("team.detail_memory_patterns")} count={(agent.memory as MemoryStats).patterns} />
          </div>
        </DetailSection>
      )}

      {/* Recent tasks */}
      <DetailSection icon={ListChecksIcon} label={t("team.detail_recent_tasks")}>
        {"recentTasks" in agent && Array.isArray(agent.recentTasks) && agent.recentTasks.length > 0 ? (
          <div className="flex flex-col gap-1">
            {(agent.recentTasks as RecentTask[]).map((task) => (
              <Link
                key={task.id}
                to="/tasks/$id"
                params={{ id: task.id }}
                className="flex items-center justify-between border border-border p-2 text-xs transition-colors hover:bg-muted/30"
              >
                <span className="truncate font-heading text-foreground">
                  {task.title}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px]",
                    task.status === "done" && "border-success/30 text-success",
                    task.status === "in_progress" && "border-info/30 text-info",
                    task.status === "blocked" && "border-destructive/30 text-destructive",
                  )}
                >
                  {task.status}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t("team.detail_no_tasks")}</p>
        )}
      </DetailSection>
    </div>
  )
}

interface MemoryStats {
  facts: number
  decisions: number
  mistakes: number
  patterns: number
}

interface RecentTask {
  id: string
  title: string
  status: string
  created_at: string
}

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-muted-foreground" />
        <span className="font-heading text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

function MemoryStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between border border-border px-2 py-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-heading text-xs font-medium text-foreground">{count}</span>
    </div>
  )
}

function AgentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 animate-pulse bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-24 animate-pulse bg-muted" />
          <div className="h-4 w-16 animate-pulse bg-muted" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 flex-1 animate-pulse bg-muted" />
        <div className="h-8 flex-1 animate-pulse bg-muted" />
      </div>
      <div className="h-px bg-border" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-3 w-20 animate-pulse bg-muted" />
          <div className="h-4 w-full animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  )
}
