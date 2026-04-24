import { FilesScreen } from '@/features/files'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
	path: z.string().optional(),
	runId: z.string().optional(),
	projectId: z.string().optional(),
	view: z.enum(['file']).optional(),
	selected: z.string().optional(),
})

export const Route = createFileRoute('/_authed/files')({
	component: FilesScreen,
	validateSearch: (search) => searchSchema.parse(search),
})
