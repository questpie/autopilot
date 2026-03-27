import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useTranslation } from "@/lib/i18n"
import { TaskBoardCard } from "./task-board-card"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Task {
  id: string
  title: string
  status: string
  priority: string
  assigned_to?: string
  updated_at: string
}

interface TaskBoardColumnProps {
  status: string
  tasks: Task[]
  onOpenTask: (id: string) => void
}

export function TaskBoardColumn({
  status,
  tasks,
  onOpenTask,
}: TaskBoardColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  })

  const label = t(`tasks.status_${status}`)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[240px] flex-1 flex-col border border-border transition-colors duration-200",
        isOver && "border-primary/20 bg-primary/[0.06]",
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-heading text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="font-heading text-[10px] text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2 p-2">
            {tasks.map((task) => (
              <TaskBoardCard
                key={task.id}
                task={task}
                onClick={onOpenTask}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}
