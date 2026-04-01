import { createFileRoute, Outlet } from "@tanstack/react-router"
import { PageError } from "@/components/feedback"
import { tasksQuery } from "@/features/tasks/task.queries"

export const Route = createFileRoute("/_app/tasks")({
  component: TasksLayout,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tasksQuery())
  },
})

function TasksLayout() {
  return <Outlet />
}
