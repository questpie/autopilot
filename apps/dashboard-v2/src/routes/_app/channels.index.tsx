import { createFileRoute } from "@tanstack/react-router"
import { ChatCircleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { EmptyState } from "@/components/feedback/empty-state"

export const Route = createFileRoute("/_app/channels/")({
  component: ChannelsIndex,
})

function ChannelsIndex() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        icon={<ChatCircleIcon size={32} />}
        message={t("chat.select_conversation")}
        description={t("chat.select_conversation_description")}
      />
    </div>
  )
}
