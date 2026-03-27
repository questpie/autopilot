import { ChatCircleIcon, HashIcon, UserIcon, ListChecksIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"

export function ChannelListEmpty() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <ChatCircleIcon size={32} className="text-muted-foreground/30" />
      <div>
        <p className="font-heading text-sm text-muted-foreground">
          {t("chat.no_channels")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          {t("chat.no_channels_description")}
        </p>
      </div>
    </div>
  )
}

export function ConversationEmpty() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <HashIcon size={32} className="text-muted-foreground/30" />
      <div>
        <p className="font-heading text-sm text-muted-foreground">
          {t("chat.no_messages")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          {t("chat.no_messages_description")}
        </p>
      </div>
    </div>
  )
}

export function DMListEmpty() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <UserIcon size={24} className="text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground">
        {t("chat.no_dms")}
      </p>
    </div>
  )
}

export function TaskThreadsEmpty() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <ListChecksIcon size={24} className="text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground">
        {t("chat.no_task_threads")}
      </p>
    </div>
  )
}
