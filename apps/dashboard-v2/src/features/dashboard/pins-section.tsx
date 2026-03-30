import { useSuspenseQuery } from "@tanstack/react-query"
import { AnimatePresence, m } from "framer-motion"
import {
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
  ArrowSquareOutIcon,
  ChartBarIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { pinsQuery, dashboardGroupsQuery } from "@/features/dashboard/dashboard.queries"
import { cn } from "@/lib/utils"

type PinType = "success" | "info" | "warning" | "error" | "progress"

const PIN_COLORS: Record<PinType, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-amber-500",
  error: "text-destructive",
  progress: "text-primary",
}

const PIN_BG: Record<PinType, string> = {
  success: "border-success/20 bg-success/5",
  info: "border-info/20 bg-info/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  error: "border-destructive/20 bg-destructive/5",
  progress: "border-primary/20 bg-primary/5",
}

function PinIcon({ type }: { type: PinType }) {
  const colorClass = PIN_COLORS[type]
  switch (type) {
    case "success":
      return <CheckCircleIcon size={16} weight="fill" className={colorClass} />
    case "info":
      return <InfoIcon size={16} weight="fill" className={colorClass} />
    case "warning":
      return <WarningIcon size={16} weight="fill" className={colorClass} />
    case "error":
      return <XCircleIcon size={16} weight="fill" className={colorClass} />
    case "progress":
      return <ChartBarIcon size={16} className={colorClass} />
  }
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

function formatPinMeta(createdBy: string, expiresAt?: string): string {
  const parts = [`pinned by ${createdBy}`]
  if (expiresAt) {
    const diffMs = new Date(expiresAt).getTime() - Date.now()
    if (diffMs > 0) {
      const hours = Math.floor(diffMs / 3600000)
      if (hours > 0) {
        parts.push(`expires in ${hours}h`)
      } else {
        const mins = Math.floor(diffMs / 60000)
        parts.push(`expires in ${mins}m`)
      }
    }
  }
  return parts.join(" \u00B7 ")
}

interface PinData {
  id: string
  group: string
  title: string
  content: string
  type: PinType
  created_by: string
  created_at: string
  expires_at?: string
  metadata: {
    task_id?: string
    agent_id?: string
    expires_at?: string
    progress?: number
    actions?: Array<{ label: string; action: string }>
  }
}

function PinCard({ pin }: { pin: PinData }) {
  const { t } = useTranslation()
  const expired = isExpired(pin.expires_at)

  if (expired) return null

  const hasArtifact = pin.content?.includes("artifact:") || pin.metadata?.actions?.some(
    (a) => a.action === "open_artifact",
  )

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn("flex flex-col gap-2 border p-3", PIN_BG[pin.type])}
    >
      <div className="flex items-start gap-2">
        <PinIcon type={pin.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-heading text-sm font-medium text-foreground">
            {pin.title}
          </p>
          {pin.content && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {pin.content}
            </p>
          )}
        </div>
      </div>

      {pin.metadata?.progress != null && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pin.metadata.progress}%` }}
            />
          </div>
          <span className="font-heading text-[10px] text-muted-foreground">
            {pin.metadata.progress}%
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {formatPinMeta(pin.created_by, pin.expires_at)}
        </span>

        {hasArtifact && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px]"
          >
            <ArrowSquareOutIcon size={12} />
            {t("dashboard.open_artifact")}
          </Button>
        )}
      </div>
    </m.div>
  )
}

export function PinsSection() {
  const { t } = useTranslation()
  const { data: pinsData } = useSuspenseQuery(pinsQuery)
  const { data: groupsData } = useSuspenseQuery(dashboardGroupsQuery)

  const pins = (pinsData ?? []) as PinData[]
  const groups = (groupsData as { groups: Array<{ id: string; title: string; position: number }> })?.groups ?? []

  // Filter out alert pins (already shown in alerts section) and expired ones
  const displayPins = pins.filter(
    (pin) =>
      !(
        (pin.type === "warning" || pin.type === "error") &&
        pin.metadata?.actions?.length
      ) && !isExpired(pin.expires_at),
  )

  // Hide section when no pins — no empty state on dashboard
  if (displayPins.length === 0) return null

  // Group pins by their group field
  const groupedPins = new Map<string, PinData[]>()
  for (const pin of displayPins) {
    const group = pin.group || "overview"
    const existing = groupedPins.get(group) ?? []
    existing.push(pin)
    groupedPins.set(group, existing)
  }

  // Sort groups by position from groups.yaml, then alphabetically
  const sortedGroupIds = Array.from(groupedPins.keys()).sort((a, b) => {
    const aGroup = groups.find((g) => g.id === a)
    const bGroup = groups.find((g) => g.id === b)
    if (aGroup && bGroup) return aGroup.position - bGroup.position
    if (aGroup) return -1
    if (bGroup) return 1
    return a.localeCompare(b)
  })

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-2 px-1 pb-3">
        <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t("dashboard.pinned")}
        </h2>
        <span className="font-heading text-xs text-muted-foreground">
          {displayPins.length}
        </span>
      </div>

      {sortedGroupIds.map((groupId) => {
        const groupMeta = groups.find((g) => g.id === groupId)
        const groupPins = groupedPins.get(groupId) ?? []

        return (
          <div key={groupId} className="mb-4 last:mb-0">
            {sortedGroupIds.length > 1 && (
              <p className="mb-2 px-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {groupMeta?.title ?? groupId}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {groupPins.map((pin) => (
                  <PinCard key={pin.id} pin={pin} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )
      })}
    </section>
  )
}
