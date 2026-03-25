import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
			<h1 className="text-2xl font-bold">Page not found</h1>
			<p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
			<a href="/" className="text-primary hover:underline">Go to Dashboard</a>
		</div>
	)
}

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		defaultPreload: 'intent',
		scrollRestoration: true,
		defaultNotFoundComponent: NotFound,
	})
}
