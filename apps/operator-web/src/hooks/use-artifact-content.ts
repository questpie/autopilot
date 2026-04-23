import { useQuery } from '@tanstack/react-query'
import { getArtifactContentUrl } from '@/api/runs.api'

async function fetchArtifactContent(runId: string, artifactId: string): Promise<string> {
  const url = getArtifactContentUrl(runId, artifactId)
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Failed to fetch artifact content: ${res.status}`)
  }
  return res.text()
}

interface ArtifactContentParams {
  runId: string
  artifactId: string
}

export const artifactContentKeys = {
  content: (runId: string, artifactId: string) =>
    ['artifacts', 'content', runId, artifactId] as const,
}

/**
 * Fetches the raw text content for a blob-backed artifact.
 * Pass `null` to disable (e.g. when `ref_value` is already populated).
 */
export function useArtifactContent(params: ArtifactContentParams | null) {
  return useQuery({
    queryKey: params
      ? artifactContentKeys.content(params.runId, params.artifactId)
      : ['artifacts', 'content', null],
    queryFn: () => {
      if (!params) throw new Error('params is null — query should be disabled')
      return fetchArtifactContent(params.runId, params.artifactId)
    },
    enabled: params !== null,
  })
}
