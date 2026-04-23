import { api, ApiError } from '@/lib/api'

export interface JoinToken {
  token_id: string
  secret: string
  expires_at: string
}

export async function createJoinToken(input: { description?: string; ttl_seconds?: number }): Promise<JoinToken> {
  const res = await api.api.enrollment.tokens.$post({
    json: {
      description: input.description,
      ttl_seconds: input.ttl_seconds ?? 3600,
    },
  })

  if (!res.ok) throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
  return res.json() as Promise<JoinToken>
}
