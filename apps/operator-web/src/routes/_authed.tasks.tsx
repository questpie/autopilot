import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TasksScreen } from '@/features/tasks'

const searchSchema = z.object({
  taskId: z.string().optional(),
  filter: z.string().optional(),
})

export const Route = createFileRoute('/_authed/tasks')({
  component: TasksScreen,
  validateSearch: (search) => searchSchema.parse(search),
})
