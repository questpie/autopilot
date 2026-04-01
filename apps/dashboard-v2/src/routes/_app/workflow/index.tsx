import { LightningIcon } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@/components/feedback"
import { PageTransition } from "@/components/layouts/page-transition"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/workflow/")({
  component: WorkflowHomePage,
})

function WorkflowHomePage() {
  const { t } = useTranslation()

  return (
    <PageTransition className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={LightningIcon}
        title={t("empty.workflows_title")}
        description={t("empty.workflows_description")}
      />
    </PageTransition>
  )
}
