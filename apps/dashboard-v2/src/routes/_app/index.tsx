import { createFileRoute } from "@tanstack/react-router"
import { PageTransition } from "@/components/layouts/page-transition"
import { channelsQuery } from "@/features/chat/chat.queries"
import { unreadNotificationsQuery } from "@/features/notifications/notification.queries"
import { agentsQuery } from "@/features/team/team.queries"
import {
  WelcomeHero,
  QuickStats,
  RecentConversations,
} from "@/features/dashboard/chat-welcome"

export const Route = createFileRoute("/_app/")({
  component: DashboardHome,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(channelsQuery),
      context.queryClient.ensureQueryData(unreadNotificationsQuery()),
      context.queryClient.ensureQueryData(agentsQuery),
    ])
  },
})

function DashboardHome() {
  return (
    <PageTransition className="flex flex-1 flex-col gap-8 p-6">
      <WelcomeHero />
      <QuickStats />
      <RecentConversations />
    </PageTransition>
  )
}
