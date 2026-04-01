import { Outlet, createFileRoute } from "@tanstack/react-router"
import { SplitLayout } from "@/components/layouts/split-layout"
import { WorkflowSidebar } from "@/features/workflow/workflow-sidebar"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/workflow")({
  component: WorkflowLayout,
})

function WorkflowLayout() {
  const { t } = useTranslation()

  return (
    <SplitLayout sidebar={<WorkflowSidebar />} sidebarTitle={t("nav.workflow")}>
      <Outlet />
    </SplitLayout>
  )
}
