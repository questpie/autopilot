import { createServerFn } from '@tanstack/react-start'
import { env } from './env'

type SessionShape = Record<string, object | string | number | boolean | null>

export interface AuthCheckResult {
	isAuthenticated: boolean
	needs2FA: boolean
	noUsersExist: boolean
	setupCompleted: boolean
	user: { id: string; email: string; name?: string; twoFactorEnabled?: boolean } | null
	session: SessionShape | null
}

const NOT_AUTHENTICATED: AuthCheckResult = {
	isAuthenticated: false,
	needs2FA: false,
	noUsersExist: false,
	setupCompleted: false,
	user: null,
	session: null,
}

const PENDING_TWO_FACTOR_COOKIE_NAMES = [
	'better-auth.two_factor',
	'__Secure-better-auth.two_factor',
	'__Host-better-auth.two_factor',
]

function hasCookie(cookieHeader: string, cookieName: string): boolean {
	const escapedName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp(`(?:^|;\\s*)${escapedName}=`).test(cookieHeader)
}

function hasPendingTwoFactorCookie(cookieHeader: string): boolean {
	return PENDING_TWO_FACTOR_COOKIE_NAMES.some((cookieName) => hasCookie(cookieHeader, cookieName))
}

export const checkAuthServer = createServerFn({ method: 'GET' }).handler(
	async (): Promise<AuthCheckResult> => {
		const { getRequest } = await import('@tanstack/react-start/server')
		const request = getRequest()
		const cookie = request.headers.get('cookie') ?? ''
		const apiInternalUrl = env.API_INTERNAL_URL
		const hasPending2FA = hasPendingTwoFactorCookie(cookie)

		try {
			const [statusRes, sessionRes] = await Promise.all([
				fetch(`${apiInternalUrl}/api/status`, {
					headers: { cookie },
				}),
				fetch(`${apiInternalUrl}/api/auth/get-session`, {
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
					session?: SessionShape
				} | null

				if (sessionData?.user) {
					return {
						isAuthenticated: true,
						needs2FA: false,
						noUsersExist: false,
						setupCompleted,
						user: sessionData.user,
						session: sessionData.session ?? null,
					}
				}
			}

			if (hasPending2FA) {
				return { ...NOT_AUTHENTICATED, needs2FA: true, setupCompleted }
			}

			return { ...NOT_AUTHENTICATED, setupCompleted }
		} catch {
			return NOT_AUTHENTICATED
		}
	},
)
