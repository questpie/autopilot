import { FolderSimpleIcon } from "@phosphor-icons/react"
import { SidebarSection } from "@/components/layouts/sidebar-section"
import { useTranslation } from "@/lib/i18n"

export function FsSidebar(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <SidebarSection
      title={t("sections.files")}
      icon={FolderSimpleIcon}
      emptyText={t("empty.fs_description")}
    />
  )
}
