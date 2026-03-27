import { hc } from "hono/client"
import type { AppType } from "../../../../packages/orchestrator/src/api/app"

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:7778"

export const api = hc<AppType>(API_BASE, {
  init: {
    credentials: "include",
  },
})
