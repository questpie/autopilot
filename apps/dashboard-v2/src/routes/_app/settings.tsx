import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SettingsNav } from "@/features/settings/settings-nav"
import { PageError } from "@/components/feedback"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
})

/**
 * Settings layout — renders the settings nav as a secondary left sidebar.
 * The primary nav compacts to a 56px icon rail when this route is active
 * (handled via CSS class on the app shell based on route match).
 */
function SettingsLayout() {
  return (
    <div className="flex h-full min-h-0">
      {/* Secondary sidebar: settings nav (hidden on mobile) */}
      <div className="hidden md:block">
        <SettingsNav />
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
