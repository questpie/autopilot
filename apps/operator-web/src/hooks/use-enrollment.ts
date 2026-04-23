import { useMutation } from '@tanstack/react-query'
import { createJoinToken } from '@/api/enrollment.api'

export function useCreateJoinToken() {
  return useMutation({
    mutationFn: ({ description, ttlSeconds }: { description?: string; ttlSeconds?: number }) =>
      createJoinToken({ description, ttl_seconds: ttlSeconds }),
  })
}
