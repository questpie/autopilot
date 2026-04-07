import { authClient } from "@/lib/auth"

/**
 * Client-side session hook.
 *
 * Note: 2FA redirect is handled globally by twoFactorClient plugin
 * (onTwoFactorRedirect in auth.ts). Server-side 2FA checks use
 * checkAuthServer() which has access to raw session data.
 */
export function useSession() {
  const session = authClient.useSession()
  const user = session.data?.user

  return {
    user: user ?? null,
    session: session.data?.session ?? null,
    isPending: session.isPending,
    isAuthenticated: !!user,
    refetch: session.refetch,
  }
}
