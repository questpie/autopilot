import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Outlet, Scripts, useNavigate, useLocation } from '@tanstack/react-router'
import type * as React from 'react'
import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { ToastContainer } from '@/components/feedback/toast-container'
import { createQueryClient } from '@/lib/query-client'
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
				content: 'QUESTPIE Autopilot Dashboard — observe and interact with your AI company.',
			},
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

function useThemeOverride() {
	return useQuery({
		queryKey: ['theme-override'],
		queryFn: async () => {
			const res = await fetch('http://localhost:7778/fs/dashboard/overrides/theme.css')
			if (!res.ok) return null
			return res.text()
		},
		refetchInterval: 30_000,
		staleTime: 10_000,
		retry: false,
	})
}

function ThemeOverride() {
	const { data: css } = useThemeOverride()
	if (!css) return null
	return <style dangerouslySetInnerHTML={{ __html: css }} />
}

/**
 * Check auth status. If auth is enabled and user is not authenticated,
 * redirect to /auth/login. If auth is disabled, skip entirely.
 */
function useAuthGuard() {
	const navigate = useNavigate()
	const location = useLocation()

	const { data: status } = useQuery({
		queryKey: ['auth-status'],
		queryFn: async () => {
			const res = await fetch('http://localhost:7778/api/status')
			if (res.status === 401) return { authRequired: true }
			if (res.ok) return { authRequired: false }
			return { authRequired: false }
		},
		retry: false,
		staleTime: 30_000,
	})

	useEffect(() => {
		if (status?.authRequired && !location.pathname.startsWith('/auth')) {
			navigate({ to: '/auth/login' })
		}
	}, [status, location.pathname, navigate])

	return status
}

function RootComponent() {
	const [queryClient] = useState(() => createQueryClient())

	return (
		<RootDocument>
			<QueryClientProvider client={queryClient}>
				<ThemeOverride />
				<AuthAwareLayout />
				<ToastContainer />
			</QueryClientProvider>
		</RootDocument>
	)
}

function AuthAwareLayout() {
	const location = useLocation()
	useAuthGuard()

	// Auth pages render without the app shell
	if (location.pathname.startsWith('/auth')) {
		return <Outlet />
	}

	return (
		<AppShell>
			<Outlet />
		</AppShell>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background text-foreground font-sans antialiased">
				{children}
				<Scripts />
			</body>
		</html>
	)
}
