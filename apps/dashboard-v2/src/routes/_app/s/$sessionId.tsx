import { ChatCircleIcon } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@/components/feedback"
import { PageTransition } from "@/components/layouts/page-transition"
import { SplitLayout } from "@/components/layouts/split-layout"
import { ChannelsSidebar } from "@/features/channels/channels-sidebar"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/s/$sessionId")({
  component: SessionPage,
})

function SessionPage() {
  const { t } = useTranslation()

  return (
    <SplitLayout sidebar={<ChannelsSidebar />}>
      <PageTransition className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ChatCircleIcon}
          title={t("empty.session_title")}
          description={t("empty.session_description")}
        />
      </PageTransition>
    </SplitLayout>
  )
}
