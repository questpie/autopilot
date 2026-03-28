import { useEffect } from "react"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { LazyMotion, domAnimation } from "framer-motion"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useAppStore } from "@/stores/app.store"
import { initWebVitals } from "@/lib/web-vitals"
import type { RouterContext } from "@/router"
import "@/lib/i18n"

// Initialize web vitals reporting
if (typeof window !== "undefined") {
  initWebVitals()
}

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "QUESTPIE Autopilot",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <a href="/" className="mt-4 text-sm underline">
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
    // Add data-theme-switching to disable transitions during swap
    root.setAttribute("data-theme-switching", "")

    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("light", !isDark)
      root.classList.toggle("dark", isDark)
    } else {
      root.classList.toggle("light", theme === "light")
      root.classList.toggle("dark", theme === "dark")
    }

    // Remove transition gate after a frame
    requestAnimationFrame(() => {
      root.removeAttribute("data-theme-switching")
    })
  }, [theme])

  // Listen for system preference changes when theme === "system"
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      const theme = useAppStore.getState().theme
      if (theme !== "system") return
      const root = document.documentElement
      root.classList.toggle("light", !e.matches)
      root.classList.toggle("dark", e.matches)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
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
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
