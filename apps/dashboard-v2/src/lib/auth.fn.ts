import { createServerFn } from "@tanstack/react-start"

export interface AuthCheckResult {
  isAuthenticated: boolean
  needs2FA: boolean
  noUsersExist: boolean
  setupCompleted: boolean
  user: { id: string; email: string; name?: string; twoFactorEnabled?: boolean } | null
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

export const checkAuthServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthCheckResult> => {
    const { getRequest } = await import("@tanstack/react-start/server")
    const request = getRequest()
    const cookie = request.headers.get("cookie") ?? ""
    const apiBase = process.env.VITE_API_URL || "http://localhost:7778"

    try {
      const [statusRes, sessionRes] = await Promise.all([
        fetch(`${apiBase}/api/status`, {
          headers: { cookie },
        }),
        fetch(`${apiBase}/api/auth/get-session`, {
          headers: { cookie },
        }),
      ])

      let noUsersExist = false
      let setupCompleted = false

      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as {
          userCount?: number
          setupCompleted?: boolean
        }
        noUsersExist = (statusData.userCount ?? 0) === 0
        setupCompleted = statusData.setupCompleted ?? false

        if (noUsersExist) {
          return { ...NOT_AUTHENTICATED, noUsersExist: true, setupCompleted: false }
        }
      }

      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as {
          user?: { id: string; email: string; name?: string; twoFactorEnabled?: boolean }
          session?: { twoFactorVerified?: boolean }
        } | null

        if (sessionData?.user) {
          return {
            isAuthenticated: true,
            needs2FA: !!sessionData.user.twoFactorEnabled && !sessionData.session?.twoFactorVerified,
            noUsersExist: false,
            setupCompleted,
            user: sessionData.user,
            session: sessionData.session ?? null,
          }
        }
      }

      return { ...NOT_AUTHENTICATED, setupCompleted }
    } catch {
      return NOT_AUTHENTICATED
    }
  },
)
