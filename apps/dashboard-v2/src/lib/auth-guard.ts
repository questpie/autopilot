import { redirect } from "@tanstack/react-router"
import { authClient } from "@/lib/auth"
import { api } from "@/lib/api"

interface AuthCheckResult {
  isAuthenticated: boolean
  needs2FA: boolean
  noUsersExist: boolean
  user: { twoFactorEnabled?: boolean } | null
  session: { twoFactorVerified?: boolean } | null
}

const NOT_AUTHENTICATED: AuthCheckResult = {
  isAuthenticated: false,
  needs2FA: false,
  noUsersExist: false,
  user: null,
  session: null,
}

export async function checkAuth(): Promise<AuthCheckResult> {
  try {
    const statusRes = await api.api.status.$get()

    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as { userCount?: number }
      if (statusData.userCount === 0) {
        return { ...NOT_AUTHENTICATED, noUsersExist: true }
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
        user,
        session,
      }
    }

    return NOT_AUTHENTICATED
  } catch {
    return NOT_AUTHENTICATED
  }
}

export async function requireAuth(opts: { location: { href: string } }) {
  // During SSR, skip auth check — client-side hydration will handle redirect
  if (typeof window === "undefined") return

  const { isAuthenticated, needs2FA, noUsersExist } = await checkAuth()

  if (noUsersExist) {
    throw redirect({ to: "/setup" })
  }

  if (isAuthenticated && needs2FA) {
    throw redirect({ to: "/login/2fa", search: {} as any })
  }

  if (!isAuthenticated) {
    throw redirect({
      to: "/login",
      search: { redirect: opts.location.href } as any,
    })
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
