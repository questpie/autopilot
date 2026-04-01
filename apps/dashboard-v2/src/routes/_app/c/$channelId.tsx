import { HashIcon } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@/components/feedback"
import { PageTransition } from "@/components/layouts/page-transition"
import { SplitLayout } from "@/components/layouts/split-layout"
import { ChannelsSidebar } from "@/features/channels/channels-sidebar"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_app/c/$channelId")({
  component: ChannelPage,
})

function ChannelPage() {
  const { t } = useTranslation()

  return (
    <SplitLayout sidebar={<ChannelsSidebar />}>
      <PageTransition className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={HashIcon}
          title={t("empty.channel_title")}
          description={t("empty.channel_description")}
        />
      </PageTransition>
    </SplitLayout>
  )
}
