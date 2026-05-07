import { adminClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc as builtInAdminAc,
  defaultStatements,
  userAc as builtInUserAc,
} from 'better-auth/plugins/admin/access'
import { createAuthClient } from 'better-auth/react'
import { getApiBaseUrl } from './env'

const apiBase = getApiBaseUrl() || undefined

function toAppPath(path: string): string {
  if (path === '/app' || path.startsWith('/app/')) return path
  if (path === '/') return '/app'
  return `/app${path.startsWith('/') ? path : `/${path}`}`
}

export function getAppCallbackUrl(path: string): string {
  return toAppPath(path)
}

// Mirror of the server's product role definitions (orchestrator/src/auth/index.ts).
// Names must match server-side role keys exactly so authClient.admin.setRole
// type-narrows to the four product roles.
const ac = createAccessControl(defaultStatements)
const productRoles = {
  owner: ac.newRole({ ...builtInAdminAc.statements }),
  admin: ac.newRole({ ...builtInAdminAc.statements }),
  member: ac.newRole({ ...builtInUserAc.statements }),
  viewer: ac.newRole({ ...builtInUserAc.statements }),
}

export const authClient = createAuthClient({
  ...(apiBase ? { baseURL: apiBase } : {}),
  plugins: [
    adminClient({ ac, roles: productRoles }),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/app/login/2fa'
      },
    }),
  ],
})
