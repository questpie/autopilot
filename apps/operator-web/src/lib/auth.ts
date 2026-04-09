import { adminClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { getApiBaseUrl, getAppUrl } from './env'

const apiBase = getApiBaseUrl() || undefined

function toAppPath(path: string): string {
  if (path === '/app' || path.startsWith('/app/')) return path
  if (path === '/') return '/app'
  return `/app${path.startsWith('/') ? path : `/${path}`}`
}

export function getAppCallbackUrl(path: string): string {
  return new URL(toAppPath(path), getAppUrl()).toString()
}

export const authClient = createAuthClient({
  ...(apiBase ? { baseURL: apiBase } : {}),
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/app/login/2fa'
      },
    }),
  ],
})
