import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { motion } from "framer-motion"
import { ClockIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"
import { PRIORITY_COLORS, formatTaskId, formatTimeAgo } from "./task-list-item"

interface TaskBoardCardProps {
  task: {
    id: string
    title: string
    status: string
    priority: string
    assigned_to?: string
    updated_at: string
  }
  onClick: (id: string) => void
  isDragOverlay?: boolean
}

export function TaskBoardCard({
  task,
  onClick,
  isDragOverlay = false,
}: TaskBoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Only add will-change during active drag for compositing
    willChange: isDragging ? ("transform" as const) : ("auto" as const),
  }

  return (
    <motion.div
      layoutId={isDragOverlay ? undefined : task.id}
      layout={!isDragOverlay}
      transition={SPRING.snappy}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab border border-border bg-card p-3 transition-colors hover:border-primary/30 active:cursor-grabbing",
        isDragging && "opacity-40",
        isDragOverlay &&
          "rotate-2 scale-[1.03] border-primary/30 opacity-95 shadow-[0_8px_24px_rgba(0,0,0,0.15)]",
      )}
      onClick={() => onClick(task.id)}
      role="button"
      tabIndex={0}
    >
      {/* ID + Priority */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-heading text-[10px] text-muted-foreground">
          {formatTaskId(task.id)}
        </span>
        <div
          className={cn(
            "h-2 w-2",
            PRIORITY_COLORS[task.priority] ?? "bg-muted-foreground",
          )}
          title={task.priority}
        />
      </div>

      {/* Title */}
      <p className="mb-2 text-xs text-foreground line-clamp-2">{task.title}</p>

      {/* Footer: assignee + time */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-heading">
          {task.assigned_to ?? "---"}
        </span>
        <span className="flex items-center gap-0.5">
          <ClockIcon size={10} />
          {formatTimeAgo(task.updated_at)}
        </span>
      </div>
    </motion.div>
  )
}
