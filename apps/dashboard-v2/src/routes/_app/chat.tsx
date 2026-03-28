import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { channelsQuery } from "@/features/chat/chat.queries"
import { ChannelList } from "@/features/chat/channel-list"
import { ChannelListSkeleton } from "@/features/chat/chat-skeletons"
import { ChannelListEmpty } from "@/features/chat/chat-empty-states"
import { ChannelCreateDialog } from "@/features/chat/channel-create-dialog"
import { PageError } from "@/components/feedback"

export const Route = createFileRoute("/_app/chat")({
  component: ChatLayout,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(channelsQuery)
  },
})

interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
  description?: string
  metadata?: Record<string, unknown>
}

function ChatLayout() {
  const { t } = useTranslation()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery(channelsQuery)
  const channels = (data ?? []) as Channel[]

  // Get active channel from nested route params
  const params = useParams({ strict: false }) as { channelId?: string }
  const activeChannelId = params.channelId

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Secondary left panel: channel list */}
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-sidebar">
        {isLoading ? (
          <ChannelListSkeleton />
        ) : channels.length === 0 ? (
          <ChannelListEmpty />
        ) : (
          <ChannelList
            channels={channels}
            activeChannelId={activeChannelId}
            onCreateChannel={() => setCreateOpen(true)}
          />
        )}
      </aside>

      {/* Main conversation area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />

        {/* Default state when no channel selected */}
        {!activeChannelId && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="font-heading text-sm text-muted-foreground">
              {t("chat.title")}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {t("chat.no_channels_description")}
            </p>
          </div>
        )}
      </div>

      {/* Create channel dialog */}
      <ChannelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}
