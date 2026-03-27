import { QueryClient } from "@tanstack/react-query"

/**
 * Shared QueryClient instance with sensible defaults for the dashboard.
 *
 * - staleTime: 30s — data is fresh for 30 seconds before refetching
 * - gcTime: 5 min — unused queries garbage-collected after 5 minutes
 * - retry: 1 — one retry on failure, then show error state
 * - refetchOnWindowFocus: true — refetch when user returns to tab
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
