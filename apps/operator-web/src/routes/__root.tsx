import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { LazyMotion, domAnimation } from 'framer-motion'
import { QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app.store'
import type { RouterContext } from '@/router'
import { useEffect } from 'react'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <a href="/app" className="mt-4 text-sm underline">
        Go home
      </a>
    </div>
  ),
})

/** Sync theme from Zustand store to <html> class */
function useThemeSync() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme-switching', '')

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('light', !isDark)
      root.classList.toggle('dark', isDark)
    } else {
      root.classList.toggle('light', theme === 'light')
      root.classList.toggle('dark', theme === 'dark')
    }

    requestAnimationFrame(() => {
      root.removeAttribute('data-theme-switching')
    })
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const theme = useAppStore.getState().theme
      if (theme !== 'system') return
      const root = document.documentElement
      root.classList.toggle('light', !e.matches)
      root.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
}

function RootComponent() {
  useThemeSync()
  const { queryClient } = Route.useRouteContext()

  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <Outlet />
      </LazyMotion>
    </QueryClientProvider>
  )
}
