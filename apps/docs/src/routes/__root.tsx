import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import type * as React from 'react'

import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
	head: () => {
		return {
			meta: [
				{ charSet: 'utf-8' },
				{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
				{ name: 'format-detection', content: 'telephone=no' },
				{ name: 'color-scheme', content: 'dark' },
				{ name: 'theme-color', content: '#B700FF' },
			],
			links: [
				{ rel: 'stylesheet', href: appCss },
				{ rel: 'icon', type: 'image/svg+xml', href: '/logo-symbol.svg' },
				{ rel: 'icon', href: '/favicon.ico' },
				{ rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
				{ rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
				{ rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
				{ rel: 'manifest', href: '/site.webmanifest' },
				{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
			],
		}
	},
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
		<html suppressHydrationWarning lang="en" className="dark">
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
