import { Outlet } from "@tanstack/react-router"
import { TopBar } from "./top-bar"
import { SideNav } from "./side-nav"
import { RightSidebar } from "./right-sidebar"
import { StatusBar } from "./status-bar"
import { BottomNav } from "./bottom-nav"
import { SkipLink } from "@/components/skip-link"

/**
 * App shell wrapping all authenticated routes.
 * SideNav is full-height (left edge). TopBar + Main sit beside it.
 *
 * Desktop:
 * ┌──────┬─── TopBar ───────────────────┐
 * │ Side │                              │
 * │ Nav  ├──────────────────┬───────────┤
 * │      │     Main         │ RightBar  │
 * │      │                  │           │
 * │      ├──────────────────┴───────────┤
 * │      │ StatusBar                    │
 * └──────┴──────────────────────────────┘
 *
 * Mobile: TopBar + Main + BottomNav (SideNav hidden, opens as sheet)
 */
export function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)]">
      <SkipLink />
      {/* SideNav — full height, left edge (hidden on mobile, sheet overlay) */}
      <SideNav />
      {/* Right column: TopBar + Main + StatusBar + BottomNav */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
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
    </div>
  )
}
