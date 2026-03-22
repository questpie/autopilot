import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import type * as React from 'react'
import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ name: 'color-scheme', content: 'dark' },
			{ name: 'theme-color', content: '#B700FF' },
			{
				name: 'description',
				content:
					'QUESTPIE Autopilot — AI-native company operating system. Your company is a container. Your employees are agents.',
			},
			{ property: 'og:title', content: 'QUESTPIE Autopilot' },
			{
				property: 'og:description',
				content:
					'AI-native company operating system. Your company is a container. Your employees are agents.',
			},
			{ property: 'og:type', content: 'website' },
		],
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
			{
				rel: 'preconnect',
				href: 'https://fonts.gstatic.com',
				crossOrigin: 'anonymous',
			},
		],
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
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-bg text-fg font-sans antialiased">
				{children}
				<Scripts />
			</body>
		</html>
	)
}
