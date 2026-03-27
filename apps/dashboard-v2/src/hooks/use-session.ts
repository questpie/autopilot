import { authClient } from "@/lib/auth"

export function useSession() {
  const session = authClient.useSession()

  return {
    user: session.data?.user ?? null,
    session: session.data?.session ?? null,
    isPending: session.isPending,
    isAuthenticated: !!session.data?.user,
    refetch: session.refetch,
    needs2FA:
      !!(session.data?.user as { twoFactorEnabled?: boolean } | null)
        ?.twoFactorEnabled &&
      !(session.data?.session as { twoFactorVerified?: boolean } | null)
        ?.twoFactorVerified,
  }
}
