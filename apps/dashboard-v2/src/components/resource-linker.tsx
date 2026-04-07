import { Link } from "@tanstack/react-router"
import {
  ListChecksIcon,
  UserIcon,
  FileIcon,
  HashIcon,
  LightningIcon,
} from "@phosphor-icons/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { resolveReferences, type ResourceType, type LinkedReference } from "@/lib/resource-resolver"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"

const RESOURCE_ICONS: Record<ResourceType, Icon> = {
  task: ListChecksIcon,
  agent: UserIcon,
  file: FileIcon,
  channel: HashIcon,
  human: UserIcon,
  skill: LightningIcon,
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  task: "bg-primary/10 text-primary border-primary/20",
  agent: "bg-info/10 text-info border-info/20",
  file: "bg-muted text-muted-foreground border-border",
  channel: "bg-success/10 text-success border-success/20",
  human: "bg-info/10 text-info border-info/20",
  skill: "bg-primary/10 text-primary border-primary/20",
}

function ResourceChip({ linkedRef }: { linkedRef: LinkedReference }) {
  const IconComponent = RESOURCE_ICONS[linkedRef.type]
  const colorClass = RESOURCE_COLORS[linkedRef.type]

  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              to={linkedRef.url}
              className={cn(
                "inline-flex items-center gap-1 rounded-none border px-1.5 py-0.5 text-xs font-heading transition-colors hover:opacity-80",
                colorClass,
              )}
            />
          }
        >
          <IconComponent size={12} />
          <span className="max-w-[120px] truncate">{linkedRef.displayLabel}</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="flex flex-col gap-1">
            <span className="font-heading text-xs font-medium capitalize">
              {linkedRef.type}: {linkedRef.displayLabel}
            </span>
            <span className="text-[10px] opacity-70">
              {linkedRef.url}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ResourceLinkerProps {
  text: string
  className?: string
}

/**
 * Renders text with auto-detected resource references as clickable chips.
 * Supports: task IDs, agent refs, file paths, channels, PRs, artifacts.
 */
export function ResourceLinker({ text, className }: ResourceLinkerProps) {
  const refs = resolveReferences(text)

  if (refs.length === 0) {
    return <span className={className}>{text}</span>
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0

  for (const ref of refs) {
    // Text before this reference
    if (ref.start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex, ref.start)}
        </span>,
      )
    }

    // The reference chip
    parts.push(<ResourceChip key={`ref-${ref.start}`} linkedRef={ref} />)
    lastIndex = ref.end
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>,
    )
  }

  return <span className={cn("inline", className)}>{parts}</span>
}
