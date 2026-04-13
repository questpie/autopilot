import { useQuery } from '@tanstack/react-query'
import { getScripts } from '@/api/scripts.api'

export const scriptKeys = {
  all: ['scripts'] as const,
  detail: (id: string) => ['scripts', id] as const,
}

export function useScripts() {
  return useQuery({
    queryKey: scriptKeys.all,
    queryFn: getScripts,
  })
}
