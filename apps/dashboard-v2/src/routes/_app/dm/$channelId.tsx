import { UserIcon } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@/components/feedback"
import { PageTransition } from "@/components/layouts/page-transition"
import { SplitLayout } from "@/components/layouts/split-layout"
import { ChannelsSidebar } from "@/features/channels/channels-sidebar"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/dm/$channelId")({
  component: DirectMessagePage,
})

function DirectMessagePage() {
  const { t } = useTranslation()

  return (
    <SplitLayout sidebar={<ChannelsSidebar />}>
      <PageTransition className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={UserIcon}
          title={t("empty.dm_title")}
          description={t("empty.dm_description")}
        />
      </PageTransition>
    </SplitLayout>
  )
}
