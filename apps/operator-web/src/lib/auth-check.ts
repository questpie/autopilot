import { getApiBaseUrl } from './env'

export interface AuthCheckResult {
  isAuthenticated: boolean
  needs2FA: boolean
  noUsersExist: boolean
  setupCompleted: boolean
  user: { id: string; email: string; name?: string; twoFactorEnabled?: boolean } | null
}

const NOT_AUTHENTICATED: AuthCheckResult = {
  isAuthenticated: false,
  needs2FA: false,
  noUsersExist: false,
  setupCompleted: false,
  user: null,
}

const PENDING_TWO_FACTOR_COOKIE_NAMES = [
  'better-auth.two_factor',
  '__Secure-better-auth.two_factor',
  '__Host-better-auth.two_factor',
]

function hasPendingTwoFactorCookie(): boolean {
  const cookie = document.cookie
  return PENDING_TWO_FACTOR_COOKIE_NAMES.some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|;\\s*)${escaped}=`).test(cookie)
  })
}

export async function checkAuth(): Promise<AuthCheckResult> {
  const base = getApiBaseUrl()

  try {
    const [statusRes, sessionRes] = await Promise.all([
      fetch(`${base}/api/status`, { credentials: 'include' }),
      fetch(`${base}/api/auth/get-session`, { credentials: 'include' }),
    ])

    let noUsersExist = false
    let setupCompleted = false

    if (statusRes.ok) {
      const data = (await statusRes.json()) as { userCount?: number; setupCompleted?: boolean }
      noUsersExist = (data.userCount ?? 0) === 0
      setupCompleted = data.setupCompleted ?? false

      if (noUsersExist) {
        return { ...NOT_AUTHENTICATED, noUsersExist: true, setupCompleted: false }
      }
    }

    if (sessionRes.ok) {
      const sessionData = (await sessionRes.json()) as {
        user?: { id: string; email: string; name?: string; twoFactorEnabled?: boolean }
      } | null

      if (sessionData?.user) {
        return {
          isAuthenticated: true,
          needs2FA: false,
          noUsersExist: false,
          setupCompleted,
          user: sessionData.user,
        }
      }
    }

    if (hasPendingTwoFactorCookie()) {
      return { ...NOT_AUTHENTICATED, needs2FA: true, setupCompleted }
    }

    return { ...NOT_AUTHENTICATED, setupCompleted }
  } catch {
    return NOT_AUTHENTICATED
  }
}
