import { FolderSimpleIcon } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@/components/feedback"
import { PageTransition } from "@/components/layouts/page-transition"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/fs/")({
  component: FilesHomePage,
})

function FilesHomePage() {
  const { t } = useTranslation()

  return (
    <PageTransition className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={FolderSimpleIcon}
        title={t("empty.fs_title")}
        description={t("empty.fs_description")}
      />
    </PageTransition>
  )
}
