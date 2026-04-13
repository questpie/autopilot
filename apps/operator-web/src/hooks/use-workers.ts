import { useQuery } from '@tanstack/react-query'
import { getWorkers } from '@/api/workers.api'

export const workerKeys = {
  all: ['workers'] as const,
}

export function useWorkers() {
  return useQuery({
    queryKey: workerKeys.all,
    queryFn: getWorkers,
    retry: false, // Workers endpoint requires worker auth — don't retry on 401/403
  })
}
