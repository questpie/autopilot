import { adminClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { getPublicApiBase } from './env'

const publicApiUrl = import.meta.env.SSR ? undefined : getPublicApiBase() || undefined

export function getAppCallbackUrl(path: string): string {
	if (typeof window === 'undefined') return path
	return new URL(path, window.location.origin).toString()
}

export const authClient = createAuthClient({
	...(publicApiUrl ? { baseURL: publicApiUrl } : {}),
	plugins: [
		adminClient(),
		twoFactorClient({
			onTwoFactorRedirect() {
				window.location.href = '/login/2fa'
			},
		}),
	],
})
