import { createFileRoute, Outlet } from "@tanstack/react-router"
import { channelsQuery } from "@/features/chat/chat.queries"
import { agentsQuery } from "@/features/team/team.queries"
import { ChannelSidebar } from "@/features/chat/channel-sidebar"
import { PageError } from "@/components/feedback"

export const Route = createFileRoute("/_app/channels")({
  component: ChannelsLayout,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(channelsQuery),
      context.queryClient.ensureQueryData(agentsQuery),
    ])
  },
})

function ChannelsLayout() {
  return (
    <div className="flex h-full min-h-0">
      <div className="hidden md:block">
        <ChannelSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
