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

/**
 * Check authentication state and determine the appropriate redirect.
 * Used in route beforeLoad guards.
 */
export async function checkAuth(): Promise<AuthCheckResult> {
  try {
    // Check if any users exist
    const statusRes = await api.api.status.$get()

    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as { userCount?: number }
      if (statusData.userCount === 0) {
        return {
          isAuthenticated: false,
          needs2FA: false,
          noUsersExist: true,
          user: null,
          session: null,
        }
      }
    }

    const sessionResult = await authClient.getSession()

    if (sessionResult.data?.user) {
      const user = sessionResult.data.user as { twoFactorEnabled?: boolean }
      const session = sessionResult.data.session as { twoFactorVerified?: boolean }

      const needs2FA = !!user.twoFactorEnabled && !session.twoFactorVerified

      return {
        isAuthenticated: true,
        needs2FA,
        noUsersExist: false,
        user,
        session,
      }
    }

    return {
      isAuthenticated: false,
      needs2FA: false,
      noUsersExist: false,
      user: null,
      session: null,
    }
  } catch {
    return {
      isAuthenticated: false,
      needs2FA: false,
      noUsersExist: false,
      user: null,
      session: null,
    }
  }
}

/**
 * Guard for authenticated routes. Redirects to login if not authenticated.
 * Preserves the current URL in ?redirect= param for deep linking.
 */
export async function requireAuth(opts: { location: { href: string } }) {
  const { isAuthenticated, needs2FA, noUsersExist } = await checkAuth()

  // First-time install: redirect to setup
  if (noUsersExist) {
    throw redirect({ to: "/setup" })
  }

  // 2FA pending: redirect to 2FA challenge
  if (isAuthenticated && needs2FA) {
    throw redirect({ to: "/login/2fa" })
  }

  // Not authenticated: redirect to login
  if (!isAuthenticated) {
    throw redirect({
      to: "/login",
      search: { redirect: opts.location.href },
    })
  }
}

/**
 * Guard for auth routes (login, signup). Redirects to / if already authenticated.
 */
export async function requireGuest() {
  const { isAuthenticated, needs2FA } = await checkAuth()

  // If authenticated but needs 2FA, allow access to 2FA page
  if (isAuthenticated && needs2FA) {
    return
  }

  if (isAuthenticated) {
    throw redirect({ to: "/" })
  }
}
