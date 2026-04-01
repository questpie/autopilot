import { useState, useMemo, useRef } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import { channelsQuery } from "./chat.queries"
import { Conversation } from "./conversation"
import { MessageInput } from "./message-input"
import { ChatTabs, type ChatTab } from "./chat-tabs"
import { useChatContext } from "./use-chat-context"
import { DropZoneOverlay } from "./drop-zone-overlay"

interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
}

export function ChatPanel() {
  const { t } = useTranslation()

  const context = useChatContext()
  const [activeTab, setActiveTab] = useState<ChatTab>(
    context.visible ? "context" : "channels",
  )
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  )

  const prevContextVisible = useRef(context.visible)
  if (context.visible && !prevContextVisible.current) {
    setActiveTab("context")
  }
  prevContextVisible.current = context.visible

  const { data } = useSuspenseQuery(channelsQuery)
  const channels = (data ?? []) as Channel[]

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

  const activeChannelId = useMemo(() => {
    if (activeTab === "context" && context.channelId) {
      return context.channelId
    }
    if (selectedChannelId) return selectedChannelId
    if (tabChannels.length > 0) return tabChannels[0].id
    return null
  }, [activeTab, context.channelId, selectedChannelId, tabChannels])

  const uploadRef = useRef<((files: File[]) => void) | null>(null)

  return (
    <>
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

      {activeTab === "context" && context.label && (
        <div className="border-b border-border bg-primary/5 px-3 py-1.5 font-heading text-[10px] text-primary">
          {context.label}
        </div>
      )}

      {activeChannelId ? (
        <DropZoneOverlay onDrop={(files) => uploadRef.current?.(files)}>
          <Conversation channelId={activeChannelId} compact />
          <MessageInput channelId={activeChannelId} compact uploadRef={uploadRef} />
        </DropZoneOverlay>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          {t("chat.no_channels_description")}
        </div>
      )}
    </>
  )
}
