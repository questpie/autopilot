import { useQuery } from '@tanstack/react-query'
import { getAgents } from '@/api/agents.api'

export const agentKeys = {
  all: ['agents'] as const,
}

export function useAgents() {
  return useQuery({
    queryKey: agentKeys.all,
    queryFn: getAgents,
  })
}
