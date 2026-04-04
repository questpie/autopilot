import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import type * as React from 'react'

import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ name: 'format-detection', content: 'telephone=no' },
			{ name: 'color-scheme', content: 'light dark' },
			{ title: 'Autopilot — Workflow-driven AI execution' },
			{
				name: 'description',
				content:
					'Run AI work where your code, tools, and access already live. Workflow-driven execution across repo-native config, workers, approvals, and external actions.',
			},
		],
		links: [{ rel: 'stylesheet', href: appCss }],
	}),
	component: RootComponent,
})

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html suppressHydrationWarning lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
				<Scripts />
			</body>
		</html>
	)
}
