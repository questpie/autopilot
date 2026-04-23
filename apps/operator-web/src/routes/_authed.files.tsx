import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { FilesScreen } from '@/features/files'

const searchSchema = z.object({
  path: z.string().optional(),
  runId: z.string().optional(),
  view: z.enum(['file']).optional(),
  layout: z.enum(['list', 'grid', 'columns', 'preview']).optional(),
  selected: z.string().optional(),
})

export const Route = createFileRoute('/_authed/files')({
  component: FilesScreen,
  validateSearch: (search) => searchSchema.parse(search),
})
