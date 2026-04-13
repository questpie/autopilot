import { useMatchRoute } from '@tanstack/react-router'

export type ActiveView = 'chat' | 'files' | 'tasks' | 'settings' | 'dashboard'

export function useActiveView(): ActiveView {
  const matchRoute = useMatchRoute()
  if (matchRoute({ to: '/files', fuzzy: true })) return 'files'
  if (matchRoute({ to: '/tasks', fuzzy: true })) return 'tasks'
  if (matchRoute({ to: '/settings', fuzzy: true })) return 'settings'
  if (matchRoute({ to: '/chat', fuzzy: true })) return 'chat'
  return 'dashboard'
}
