import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SettingsScreen } from '@/features/settings'

const settingsSearchSchema = z.object({
	tab: z.enum(['profile', 'security', 'users', 'preferences', 'machines']).optional(),
})

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsScreen,
  validateSearch: (search) => settingsSearchSchema.parse(search),
})
