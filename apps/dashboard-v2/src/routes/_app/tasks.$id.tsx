import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { TaskDetail } from "@/features/tasks/task-detail"

export const Route = createFileRoute("/_app/tasks/$id")({
  component: TaskDetailRoute,
})

/**
 * Route-based task detail sheet.
 * Opens as a sheet overlay on the tasks page.
 * Browser back closes the sheet.
 */
function TaskDetailRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  function handleClose() {
    void navigate({ to: "/tasks" })
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) handleClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px]"
        showCloseButton={false}
      >
        <TaskDetail taskId={id} onClose={handleClose} />
      </SheetContent>
    </Sheet>
  )
}
