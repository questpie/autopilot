import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { AgentDetail } from "@/features/team/agent-detail"

export const Route = createFileRoute("/_app/team/$id")({
  component: AgentDetailRoute,
})

/**
 * Route-based agent detail sheet.
 * Opens as a 480px sheet overlay on the team page.
 * Browser back closes the sheet.
 */
function AgentDetailRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  function handleClose() {
    void navigate({ to: "/team" })
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) handleClose() }}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[480px]"
        showCloseButton={false}
      >
        <AgentDetail agentId={id} onClose={handleClose} />
      </SheetContent>
    </Sheet>
  )
}
