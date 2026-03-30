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
      <AuthBrandPanel />

      {/* Right: Form area — full height flex so children can use justify-between */}
      <div className="flex min-h-dvh flex-1 flex-col items-center overflow-y-auto px-4 py-6 sm:px-6 md:px-12 md:py-8 lg:px-16">
        <div className="mb-6 flex justify-center sm:mb-8 md:hidden">
          <SquareBuildLogo size={40} />
        </div>

        <m.div
          className={`my-auto flex w-full flex-col ${isSetup ? "max-w-[640px]" : "max-w-[420px]"}`}
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
