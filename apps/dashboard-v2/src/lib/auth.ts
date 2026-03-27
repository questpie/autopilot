import { createAuthClient } from "better-auth/react"
import { twoFactorClient } from "better-auth/client/plugins"

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

/**
 * Better Auth client configured against the orchestrator.
 * Provides sign-in, sign-up, sign-out, 2FA, and session management.
 */
export const authClient = createAuthClient({
  baseURL: baseUrl,
  plugins: [twoFactorClient()],
})
