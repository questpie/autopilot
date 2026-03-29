import { useState, useMemo, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { channelsQuery } from "./chat.queries"
import { Conversation } from "./conversation"
import { MessageInput } from "./message-input"
import { ChatTabs, type ChatTab } from "./chat-tabs"
import { useChatContext } from "./use-chat-context"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { DropZoneOverlay } from "./drop-zone-overlay"

interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
}

export function ChatPanel() {
  const { t } = useTranslation()
  const rightPanel = useAppStore((s) => s.rightPanel)
  const setRightPanel = useAppStore((s) => s.setRightPanel)
  const closeRightPanel = useAppStore((s) => s.closeRightPanel)

  const context = useChatContext()
  const [activeTab, setActiveTab] = useState<ChatTab>(
    context.visible ? "context" : "channels",
  )
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    rightPanel.channel ?? null,
  )

  // Auto-select context tab when it becomes available (replaces useEffect + setState)
  const prevContextVisible = useRef(context.visible)
  if (context.visible && !prevContextVisible.current) {
    setActiveTab("context")
  }
  prevContextVisible.current = context.visible

  const { data } = useQuery(channelsQuery)
  const channels = (data ?? []) as Channel[]

  // Group channels by type
  const groupChannels = useMemo(
    () => channels.filter((c) => c.type === "group" || c.type === "broadcast"),
    [channels],
  )
  const dmChannels = useMemo(
    () => channels.filter((c) => c.type === "direct"),
    [channels],
  )
  const taskChannels = useMemo(
    () =>
      channels.filter(
        (c) => c.id.startsWith("task-") || c.id.match(/^[A-Z]+-\d+$/),
      ),
    [channels],
  )

  // Determine displayed channels based on active tab
  const tabChannels = useMemo(() => {
    switch (activeTab) {
      case "channels":
        return groupChannels
      case "dms":
        return dmChannels
      case "tasks":
        return taskChannels
      case "context":
        return []
      default:
        return groupChannels
    }
  }, [activeTab, groupChannels, dmChannels, taskChannels])

  // Resolve the active channel ID
  const activeChannelId = useMemo(() => {
    if (activeTab === "context" && context.channelId) {
      return context.channelId
    }
    if (selectedChannelId) return selectedChannelId
    if (tabChannels.length > 0) return tabChannels[0].id
    return null
  }, [activeTab, context.channelId, selectedChannelId, tabChannels])

  // Keyboard shortcut: Cmd+Shift+C toggles panel
  const togglePanel = useCallback(() => {
    if (rightPanel.open && rightPanel.mode === "chat") {
      closeRightPanel()
    } else {
      setRightPanel({ mode: "chat", channel: activeChannelId })
    }
  }, [rightPanel, closeRightPanel, setRightPanel, activeChannelId])

  const shortcuts = useMemo(
    () => ({
      "$mod+Shift+KeyC": (e: KeyboardEvent) => {
        e.preventDefault()
        togglePanel()
      },
    }),
    [togglePanel],
  )
  useKeyboardShortcuts(shortcuts)

  const uploadRef = useRef<((files: File[]) => void) | null>(null)

  const handleFileDrop = useCallback((files: File[]) => {
    uploadRef.current?.(files)
  }, [])

  if (!rightPanel.open || rightPanel.mode !== "chat") return null

  return (
    <>
      {/* Overlay backdrop for tablet */}
      <div
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        onClick={closeRightPanel}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeRightPanel()
        }}
        role="button"
        tabIndex={-1}
        aria-label={t("common.close")}
      />

      {/* Panel — tabs at top, conversation fills remaining height, input pinned at bottom */}
      <aside className="z-50 flex w-[360px] shrink-0 flex-col border-l border-border bg-background fixed right-0 top-0 bottom-0 lg:relative">
        {/* Tabs — always at top */}
        <ChatTabs
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab)
            if (tab !== "context") {
              setSelectedChannelId(null)
            }
          }}
          context={context}
        />

        {/* Channel picker (for channels/dms/tasks tabs) */}
        {activeTab !== "context" && tabChannels.length > 0 && (
          <div className="border-b border-border px-3 py-1.5">
            <Select
              value={selectedChannelId ?? tabChannels[0]?.id ?? ""}
              onValueChange={setSelectedChannelId}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabChannels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.type === "group" ? `#${ch.name}` : ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Context indicator */}
        {activeTab === "context" && context.label && (
          <div className="border-b border-border bg-primary/5 px-3 py-1.5 font-heading text-[10px] text-primary">
            {context.label}
          </div>
        )}

        {/* Conversation — fills remaining space */}
        {activeChannelId ? (
          <DropZoneOverlay onDrop={handleFileDrop}>
            <Conversation channelId={activeChannelId} compact />
            <MessageInput channelId={activeChannelId} compact uploadRef={uploadRef} />
          </DropZoneOverlay>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            {t("chat.no_channels_description")}
          </div>
        )}
      </aside>
    </>
  )
}
