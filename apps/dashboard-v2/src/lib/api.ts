import { hc } from "hono/client"
import type { AppType } from "../../../../packages/orchestrator/src/api/app"

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

/**
 * Type-safe Hono RPC client for the orchestrator API.
 * Provides end-to-end type inference for all backend routes.
 */
export const api = hc<AppType>(API_BASE, {
  init: {
    credentials: "include",
  },
})
