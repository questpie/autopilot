import { createFileRoute } from '@tanstack/react-router'
import { SettingsScreen } from '@/features/settings'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsScreen,
})
