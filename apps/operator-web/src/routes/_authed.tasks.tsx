import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TasksScreen } from '@/features/tasks'

const taskFilterSchema = z.enum(['all', 'active', 'blocked', 'backlog', 'done', 'failed'])

const searchSchema = z.object({
  taskId: z.string().optional(),
  filter: taskFilterSchema.optional(),
})

export const Route = createFileRoute('/_authed/tasks')({
  component: TasksScreen,
  validateSearch: (search) => searchSchema.parse(search),
})
