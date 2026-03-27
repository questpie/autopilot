import { useMemo, useState, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { TaskBoardColumn } from "./task-board-column"
import { TaskBoardCard } from "./task-board-card"
import { useUpdateTask } from "./task.mutations"
import { useHapticPattern } from "@/hooks/use-haptic"
import type { Task } from "./task-list"

const BOARD_STATUSES = [
  "backlog",
  "assigned",
  "in_progress",
  "review",
  "done",
] as const

interface TaskBoardProps {
  tasks: Task[]
  searchQuery: string
  onOpenTask: (id: string) => void
}

export function TaskBoard({ tasks, searchQuery, onOpenTask }: TaskBoardProps) {
  const updateTask = useUpdateTask()
  const { trigger: haptic } = useHapticPattern()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  )

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tasks
    const lower = searchQuery.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.id.toLowerCase().includes(lower),
    )
  }, [tasks, searchQuery])

  const columnTasks = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const status of BOARD_STATUSES) {
      map.set(status, [])
    }
    for (const task of filtered) {
      const col = BOARD_STATUSES.includes(task.status as typeof BOARD_STATUSES[number])
        ? task.status
        : "backlog"
      const arr = map.get(col) ?? []
      arr.push(task)
      map.set(col, arr)
    }
    return map
  }, [filtered])

  const activeTask = useMemo(
    () => (activeId ? filtered.find((t) => t.id === activeId) : null),
    [activeId, filtered],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over) return

      const taskId = active.id as string
      const overData = over.data.current

      let newStatus: string | undefined

      if (overData?.type === "column") {
        newStatus = overData.status as string
      } else if (overData?.type === "task") {
        // Dropped on another task — get its status
        const overTask = filtered.find((t) => t.id === over.id)
        if (overTask) newStatus = overTask.status
      }

      if (!newStatus) return

      const task = filtered.find((t) => t.id === taskId)
      if (!task || task.status === newStatus) return

      haptic("success")
      updateTask.mutate({ id: taskId, status: newStatus })
    },
    [filtered, updateTask, haptic],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-2 overflow-x-auto p-2">
        {BOARD_STATUSES.map((status) => (
          <TaskBoardColumn
            key={status}
            status={status}
            tasks={columnTasks.get(status) ?? []}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskBoardCard
            task={activeTask}
            onClick={onOpenTask}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
