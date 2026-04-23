import { SettingsScreen } from '@/features/settings'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const settingsSearchSchema = z.object({
	tab: z
		.enum(['profile', 'security', 'users', 'preferences', 'machines', 'config', 'projects'])
		.optional(),
})

export const Route = createFileRoute('/_authed/settings')({
	component: SettingsScreen,
	validateSearch: (search) => settingsSearchSchema.parse(search),
})
