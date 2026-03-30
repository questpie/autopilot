import { createFileRoute, Outlet, redirect, useMatches } from "@tanstack/react-router"
import { checkAuthServer } from "@/lib/auth.fn"
import { AuthBrandPanel } from "@/components/brand"
import { SquareBuildLogo } from "@/components/brand"
import { m } from "framer-motion"
import { fadeInUp, EASING, DURATION } from "@/lib/motion"
import { useMotionPreference } from "@/lib/motion"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const result = await checkAuthServer()

    // Fully authenticated users with completed setup → redirect to dashboard
    // Users with pending 2FA or incomplete setup should stay on auth pages
    if (result.isAuthenticated && !result.needs2FA && result.setupCompleted) {
      throw redirect({ to: "/" })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  const matches = useMatches()
  const isSetup = matches.some((m) => m.routeId.includes("setup"))
  const { shouldReduce, variants } = useMotionPreference()

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Left: Brand panel (md+ only) */}
      <AuthBrandPanel />

      {/* Right: Form area */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 md:px-12 lg:px-16">
        {/* Mobile-only logo (brand panel hidden below md) */}
        <div className="mb-8 flex justify-center md:hidden">
          <SquareBuildLogo size={40} />
        </div>

        {/* Form content — vertically centered, scrollable when tall */}
        <m.div
          className={`my-auto w-full ${isSetup ? "max-w-[640px]" : "max-w-[420px]"}`}
          {...variants(fadeInUp)}
          transition={{
            duration: shouldReduce ? 0 : DURATION.slow,
            ease: EASING.enter,
          }}
        >
          <Outlet />
        </m.div>
      </div>
    </div>
  )
}
