import { authClient } from "@/lib/auth"

/**
 * Hook that wraps Better Auth session state.
 * Provides current user session data with reactive updates on login/logout.
 */
export function useSession() {
  const session = authClient.useSession()

  return {
    /** The current user object, or null if not authenticated */
    user: session.data?.user ?? null,
    /** The current session object, or null if not authenticated */
    session: session.data?.session ?? null,
    /** Whether the session is still being loaded */
    isPending: session.isPending,
    /** Whether the user is authenticated */
    isAuthenticated: !!session.data?.user,
    /** Refetch the session data */
    refetch: session.refetch,
    /** Whether 2FA is pending verification */
    needs2FA:
      !!(session.data?.user as { twoFactorEnabled?: boolean } | null)
        ?.twoFactorEnabled &&
      !(session.data?.session as { twoFactorVerified?: boolean } | null)
        ?.twoFactorVerified,
  }
}
