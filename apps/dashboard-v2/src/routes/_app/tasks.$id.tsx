import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { TaskDetail } from "@/features/tasks/task-detail"
import { PageTransition } from "@/components/layouts/page-transition"
import { taskDetailQuery } from "@/features/tasks/task.queries"

export const Route = createFileRoute("/_app/tasks/$id")({
  component: TaskDetailRoute,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(taskDetailQuery(params.id))
  },
})

function TaskDetailRoute() {
  const { id } = Route.useParams()
  const { t } = useTranslation()

  return (
    <PageTransition className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-3">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon size={14} />
          {t("tasks.back_to_tasks")}
        </Link>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1">
        <TaskDetail taskId={id} />
      </div>
    </PageTransition>
  )
}
