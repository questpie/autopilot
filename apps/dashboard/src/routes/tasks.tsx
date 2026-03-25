import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks')({
	beforeLoad: () => {
		throw redirect({ to: '/', search: { view: 'kanban', pin: '' } })
	},
})
