import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import type * as React from 'react'
import appCss from '@/styles/app.css?url'
import { jsonLd, organizationSchema, websiteSchema } from '@/lib/seo'

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
			{ name: 'author', content: 'QUESTPIE' },
			{ property: 'og:title', content: 'QUESTPIE Autopilot' },
			{
				property: 'og:description',
				content:
					'AI-native company operating system. Your company is a container. Your employees are agents.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ property: 'og:locale', content: 'en_US' },
			{ property: 'og:image', content: 'https://autopilot.questpie.com/og-default.png' },
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:image', content: 'https://autopilot.questpie.com/og-default.png' },
		],
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
			{
				rel: 'preconnect',
				href: 'https://fonts.gstatic.com',
				crossOrigin: 'anonymous',
			},
			{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
			{ rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
			{ rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
			{ rel: 'manifest', href: '/site.webmanifest' },
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
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema) }}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }}
				/>
			</head>
			<body className="min-h-screen bg-bg text-fg font-sans antialiased">
				{children}
				<Scripts />
			</body>
		</html>
	)
}
