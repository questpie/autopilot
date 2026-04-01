import { ChatCircleIcon, HashIcon, UserIcon } from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"
import { SidebarSection } from "@/components/layouts/sidebar-section"
import { SessionItem } from "@/features/chat/session-item"
import { chatSessionsQuery } from "@/features/chat/chat.queries"
import { useTranslation } from "@/lib/i18n"

export function ChannelsSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const { data } = useSuspenseQuery(chatSessionsQuery())
  const sessions = data?.sessions ?? []

  return (
    <>
      <SidebarSection
        title={t("sections.chats")}
        icon={ChatCircleIcon}
        count={sessions.length}
        emptyText={t("empty.new_chat_description")}
      >
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            active={location.pathname === `/s/${session.id}`}
          />
        ))}
      </SidebarSection>
      <SidebarSection
        title={t("sections.channels")}
        icon={HashIcon}
        emptyText={t("empty.channels_description")}
      />
      <SidebarSection
        title={t("sections.direct_messages")}
        icon={UserIcon}
        emptyText={t("empty.dms_description")}
      />
    </>
  )
}
