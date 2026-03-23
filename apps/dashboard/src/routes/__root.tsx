import { useState, useEffect } from 'react'
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import type * as React from 'react'
import appCss from '@/styles/app.css?url'
import { Sidebar } from '@/components/Sidebar'
import { API_URL } from '@/lib/api'

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ name: 'color-scheme', content: 'dark' },
			{ name: 'theme-color', content: '#B700FF' },
			{
				name: 'description',
				content: 'QUESTPIE Autopilot Dashboard — Monitor and manage your AI agents.',
			},
			{ property: 'og:title', content: 'QUESTPIE Autopilot Dashboard' },
			{
				property: 'og:description',
				content: 'Monitor and manage your AI agents.',
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

function OrchestratorStatus() {
	const [online, setOnline] = useState(false)

	useEffect(() => {
		let active = true
		const check = () => {
			fetch(`${API_URL}/api/status`)
				.then((res) => {
					if (active) setOnline(res.ok)
				})
				.catch(() => {
					if (active) setOnline(false)
				})
		}
		check()
		const interval = setInterval(check, 10000)
		return () => {
			active = false
			clearInterval(interval)
		}
	}, [])

	return (
		<div className="flex items-center gap-2">
			<div
				className={`w-2 h-2 ${online ? 'bg-accent-green' : 'bg-accent-red'}`}
			/>
			<span className="text-xs text-muted font-mono">
				orchestrator {online ? 'running' : 'offline'}
			</span>
		</div>
	)
}

function RootComponent() {
	return (
		<RootDocument>
			<div className="flex h-screen overflow-hidden">
				<Sidebar />
				<div className="flex-1 flex flex-col min-w-0">
					<header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
						<span className="text-sm font-semibold text-fg">QUESTPIE Autopilot</span>
						<OrchestratorStatus />
					</header>
					<main className="flex-1 overflow-auto p-4">
						<Outlet />
					</main>
				</div>
			</div>
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
