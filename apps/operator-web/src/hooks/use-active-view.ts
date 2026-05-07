import { useMatchRoute } from '@tanstack/react-router'

export type ActiveView = 'chat' | 'knowledge' | 'tasks' | 'settings' | 'dashboard'

export function useActiveView(): ActiveView {
	const matchRoute = useMatchRoute()
	if (matchRoute({ to: '/knowledge', fuzzy: true })) return 'knowledge'
	if (matchRoute({ to: '/tasks', fuzzy: true })) return 'tasks'
	if (matchRoute({ to: '/settings', fuzzy: true })) return 'settings'
	if (matchRoute({ to: '/chat', fuzzy: true })) return 'chat'
	return 'dashboard'
}
