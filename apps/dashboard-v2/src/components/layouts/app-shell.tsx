import { SkipLink } from "@/components/skip-link"
import { Outlet } from "@tanstack/react-router"
import { BottomNav } from "./bottom-nav"
import { CompactSidebar } from "./compact-sidebar"
import { MobileTopBar } from "./mobile-top-bar"
import { StatusBar } from "./status-bar"

/**
 * App shell for the narrowed authenticated surface.
 * Desktop: icon rail + content + status bar.
 * Mobile: top bar + content + bottom nav.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)]">
      <SkipLink />
      <CompactSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main
          id="main-content"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
          tabIndex={-1}
        >
          <Outlet />
        </main>
        <StatusBar />
        <BottomNav />
      </div>
    </div>
  )
}
