import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  ChatCircleIcon,
  UserIcon,
  ListChecksIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

export interface SlashCommand {
  command: string
  labelKey: string
  icon: Icon
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/ask", labelKey: "chat.slash_ask", icon: PaperPlaneTiltIcon },
  { command: "/dm", labelKey: "chat.slash_dm", icon: ChatCircleIcon },
  { command: "/status", labelKey: "chat.slash_status", icon: EyeIcon },
  { command: "/task", labelKey: "chat.slash_task", icon: ListChecksIcon },
  { command: "/attach", labelKey: "chat.slash_attach", icon: UserIcon },
  { command: "/approve", labelKey: "chat.slash_approve", icon: CheckCircleIcon },
  { command: "/reject", labelKey: "chat.slash_reject", icon: XCircleIcon },
]

interface SlashCommandsDropdownProps {
  filter: string
  selectedIndex: number
  onSelect: (command: string) => void
}

export function SlashCommandsDropdown({
  filter,
  selectedIndex,
  onSelect,
}: SlashCommandsDropdownProps) {
  const { t } = useTranslation()

  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.command.startsWith(`/${filter}`),
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-64 border border-border bg-card py-1 shadow-lg">
      {filtered.map((cmd, i) => {
        const IconComponent = cmd.icon
        return (
          <button
            key={cmd.command}
            type="button"
            onClick={() => onSelect(cmd.command)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
              i === selectedIndex
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <IconComponent size={14} className="shrink-0" />
            <span className="font-heading font-medium">{cmd.command}</span>
            <span className="flex-1 truncate text-muted-foreground/60">
              {t(cmd.labelKey)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
