import { KnowledgeScreen } from '@/features/knowledge'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
	path: z.string().optional(),
	runId: z.string().optional(),
	projectId: z.string().optional(),
	view: z.enum(['resource']).optional(),
	selected: z.string().optional(),
})

export const Route = createFileRoute('/_authed/knowledge')({
	component: KnowledgeScreen,
	validateSearch: (search) => searchSchema.parse(search),
})
