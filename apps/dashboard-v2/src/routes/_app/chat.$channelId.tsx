import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  CaretLeftIcon,
  PushPinIcon,
  DotsThreeIcon,
  UsersIcon,
  GearIcon,
  SignOutIcon,
} from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"
import { channelDetailQuery, messagesQuery } from "@/features/chat/chat.queries"
import { Conversation } from "@/features/chat/conversation"
import { MessageInput } from "@/features/chat/message-input"
import { ChannelMembers } from "@/features/chat/channel-members"
import { useStreamingChat } from "@/features/chat/use-streaming-chat"

interface ChatSearchParams {
  autoStart?: boolean
  message?: string
}

export const Route = createFileRoute("/_app/chat/$channelId")({
  component: ChatConversationPage,
  validateSearch: (search: Record<string, unknown>): ChatSearchParams => ({
    autoStart: search.autoStart === true || search.autoStart === "true",
    message: typeof search.message === "string" ? search.message : undefined,
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(channelDetailQuery(params.channelId)),
      context.queryClient.ensureQueryData(messagesQuery(params.channelId)),
    ])
  },
})

function ChatConversationPage() {
  const { t } = useTranslation()
  const { channelId } = Route.useParams()
  const { autoStart, message } = Route.useSearch()
  const [membersOpen, setMembersOpen] = useState(false)

  useStreamingChat({
    channelId,
    autoStartMessage: autoStart && message ? message : undefined,
  })

  const { data: channel } = useQuery(channelDetailQuery(channelId))
  const channelData = channel as
    | { id: string; name: string; type: string; description?: string }
    | undefined

  return (
    <div className="flex flex-1 flex-col">
      {/* Channel header */}
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        {/* Back button (mobile) */}
        <Link
          to="/chat"
          className="text-muted-foreground hover:text-foreground lg:hidden"
        >
          <CaretLeftIcon size={18} />
        </Link>

        {/* Channel name */}
        <div className="flex flex-1 items-center gap-2">
          <h2 className="font-heading text-sm font-semibold">
            {channelData
              ? channelData.type === "group" || channelData.type === "broadcast"
                ? `#${channelData.name}`
                : channelData.name
              : channelId}
          </h2>
          {channelData?.description && (
            <span className="hidden text-xs text-muted-foreground/60 md:inline">
              {channelData.description}
            </span>
          )}
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={t("chat.members")}
            onClick={() => setMembersOpen(true)}
          >
            <UsersIcon size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("chat.pin")}>
            <PushPinIcon size={14} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("a11y.more_options")} />}>
                <DotsThreeIcon size={14} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setMembersOpen(true)}>
                <UsersIcon size={14} />
                {t("chat.members")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <GearIcon size={14} />
                {t("chat.channel_settings")}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <SignOutIcon size={14} />
                {t("chat.channel_leave")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conversation */}
      <Conversation channelId={channelId} />

      {/* Message input */}
      <MessageInput channelId={channelId} />

      {/* Members sheet */}
      <ChannelMembers
        channelId={channelId}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
    </div>
  )
}
