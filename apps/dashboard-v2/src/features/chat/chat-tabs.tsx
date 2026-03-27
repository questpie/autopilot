import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { ChatContext } from "./use-chat-context"

export type ChatTab = "channels" | "dms" | "tasks" | "context"

interface ChatTabsProps {
  activeTab: ChatTab
  onTabChange: (tab: ChatTab) => void
  context: ChatContext
}

interface TabDef {
  id: ChatTab
  labelKey: string
  visible: boolean
}

export function ChatTabs({ activeTab, onTabChange, context }: ChatTabsProps) {
  const { t } = useTranslation()

  const tabs: TabDef[] = [
    { id: "channels", labelKey: "chat.channels", visible: true },
    { id: "dms", labelKey: "chat.direct_messages", visible: true },
    { id: "tasks", labelKey: "chat.task_threads", visible: true },
    {
      id: "context",
      labelKey: context.label ?? "chat.context",
      visible: context.visible,
    },
  ]

  const visibleTabs = tabs.filter((tab) => tab.visible)

  return (
    <div className="flex border-b border-border overflow-x-auto">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "shrink-0 px-3 py-2 font-heading text-[10px] uppercase tracking-widest transition-colors",
            activeTab === tab.id
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.id === "context" && context.label
            ? context.label
            : t(tab.labelKey)}
        </button>
      ))}
    </div>
  )
}
