import { Outlet } from "@tanstack/react-router"
import { TopBar } from "./top-bar"
import { SideNav } from "./side-nav"
import { RightSidebar } from "./right-sidebar"
import { StatusBar } from "./status-bar"
import { BottomNav } from "./bottom-nav"
import { SkipLink } from "@/components/skip-link"

/**
 * App shell wrapping all authenticated routes.
 * Desktop: TopBar + SideNav + Main + RightSidebar + StatusBar
 * Tablet: TopBar + collapsed SideNav rail + Main + overlay RightSidebar
 * Mobile: TopBar + Main + BottomNav
 */
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <SkipLink />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <SideNav />
        <main
          id="main-content"
          className="flex min-w-0 flex-1 flex-col overflow-auto"
          tabIndex={-1}
        >
          <Outlet />
        </main>
        <RightSidebar />
      </div>
      <StatusBar />
      <BottomNav />
    </div>
  )
}
