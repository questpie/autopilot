import { Outlet, createFileRoute } from "@tanstack/react-router"
import { SplitLayout } from "@/components/layouts/split-layout"
import { FsSidebar } from "@/features/fs/fs-sidebar"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/fs")({
  component: FsLayout,
})

function FsLayout() {
  const { t } = useTranslation()

  return (
    <SplitLayout sidebar={<FsSidebar />} sidebarTitle={t("nav.fs")}>
      <Outlet />
    </SplitLayout>
  )
}
