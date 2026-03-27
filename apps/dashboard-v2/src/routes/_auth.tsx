import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SquareBuildLogo } from "@/components/brand"

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
})

/**
 * Auth layout -- centered card with QUESTPIE branding.
 * Used for login, signup, 2FA, and setup screens.
 * Setup wizard gets a wider card (640px) vs regular auth (400px).
 */
function AuthLayout() {
  const { t } = useTranslation()
  const matches = useMatches()

  // Check if we're on the setup route for wider layout
  const isSetup = matches.some((m) => m.routeId.includes("setup"))

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      {/* Brand header -- only show for non-setup routes (setup has its own header) */}
      {!isSetup && (
        <div className="mb-8 flex flex-col items-center gap-3">
          <SquareBuildLogo size={48} />
        </div>
      )}

      {/* Content card */}
      <div
        className={`w-full border border-border bg-card p-6 ${
          isSetup ? "max-w-[640px]" : "max-w-[400px]"
        }`}
      >
        <Outlet />
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted-foreground">
        {t("app.name")} {t("app.version")}
      </p>
    </div>
  )
}
