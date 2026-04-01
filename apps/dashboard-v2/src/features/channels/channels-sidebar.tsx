import { ChatCircleIcon, HashIcon, UserIcon } from "@phosphor-icons/react"
import { SidebarSection } from "@/components/layouts/sidebar-section"
import { useTranslation } from "@/lib/i18n"

export function ChannelsSidebar(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <SidebarSection
        title={t("sections.chats")}
        icon={ChatCircleIcon}
        emptyText={t("empty.new_chat_description")}
      />
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
