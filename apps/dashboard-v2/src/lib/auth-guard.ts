import { redirect } from "@tanstack/react-router"
import { authClient } from "@/lib/auth"
import { api } from "@/lib/api"

interface AuthCheckResult {
  isAuthenticated: boolean
  needs2FA: boolean
  noUsersExist: boolean
  setupCompleted: boolean
  user: { twoFactorEnabled?: boolean } | null
  session: { twoFactorVerified?: boolean } | null
}

const NOT_AUTHENTICATED: AuthCheckResult = {
  isAuthenticated: false,
  needs2FA: false,
  noUsersExist: false,
  setupCompleted: false,
  user: null,
  session: null,
}

export async function checkAuth(): Promise<AuthCheckResult> {
  try {
    const statusRes = await api.api.status.$get()
    let noUsersExist = false
    let setupCompleted = false

    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as { userCount?: number; setupCompleted?: boolean }
      noUsersExist = (statusData.userCount ?? 0) === 0
      setupCompleted = statusData.setupCompleted ?? false

      if (noUsersExist) {
        return { ...NOT_AUTHENTICATED, noUsersExist: true, setupCompleted: false }
      }
    }

    const sessionResult = await authClient.getSession()

    if (sessionResult.data?.user) {
      const user = sessionResult.data.user as { twoFactorEnabled?: boolean }
      const session = sessionResult.data.session as { twoFactorVerified?: boolean }

      return {
        isAuthenticated: true,
        needs2FA: !!user.twoFactorEnabled && !session.twoFactorVerified,
        noUsersExist: false,
        setupCompleted,
        user,
        session,
      }
    }

    return { ...NOT_AUTHENTICATED, setupCompleted }
  } catch {
    return NOT_AUTHENTICATED
  }
}

export async function requireAuth(opts: { location: { href: string } }) {
  if (typeof window === "undefined") return

  const { isAuthenticated, needs2FA, noUsersExist, setupCompleted } = await checkAuth()

  // No users at all → setup wizard
  if (noUsersExist) {
    throw redirect({ to: "/setup" })
  }

  // Not logged in → login
  if (!isAuthenticated) {
    throw redirect({
      to: "/login",
      search: { redirect: opts.location.href } as any,
    })
  }

  // Logged in but needs 2FA
  if (needs2FA) {
    throw redirect({ to: "/login/2fa", search: {} as any })
  }

  // Logged in but setup not completed → finish setup
  if (!setupCompleted && !opts.location.href.includes("/setup")) {
    throw redirect({ to: "/setup" })
  }
}

export async function requireGuest() {
  const { isAuthenticated, needs2FA } = await checkAuth()

  if (isAuthenticated && needs2FA) {
    return
  }

  if (isAuthenticated) {
    throw redirect({ to: "/" })
  }
}
