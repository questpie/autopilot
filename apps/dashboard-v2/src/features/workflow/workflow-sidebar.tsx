import { CircleDashedIcon, FolderIcon, LightningIcon } from "@phosphor-icons/react"
import { SidebarSection } from "@/components/layouts/sidebar-section"
import { useTranslation } from "@/lib/i18n"

export function WorkflowSidebar(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <SidebarSection
        title={t("sections.workflows")}
        icon={LightningIcon}
        emptyText={t("empty.workflows_description")}
      />
      <SidebarSection
        title={t("sections.issues")}
        icon={CircleDashedIcon}
        emptyText={t("empty.issues_description")}
      />
      <SidebarSection
        title={t("sections.projects")}
        icon={FolderIcon}
        emptyText={t("empty.projects_description")}
      />
    </>
  )
}
