/**
 * Public re-exports for auth server functions.
 *
 * Route files must NOT import `auth.server.ts` directly because TanStack Start's
 * import-protection strips `.server.*` files from the client bundle.
 * `createServerFn` wrappers are safe to import anywhere — only their *handler*
 * runs on the server — so we re-export them from this non-`.server` module.
 */
export { checkAuthServer, type AuthCheckResult } from "./auth.server"
