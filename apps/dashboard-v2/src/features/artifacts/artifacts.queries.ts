import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"

export interface ArtifactConfig {
  id: string
  name: string
  serve: string
  build?: string
  health?: string
  timeout?: string
  status?: "running" | "stopped"
  port?: number | null
}

export interface ArtifactListResponse {
  artifacts: ArtifactConfig[]
}

async function fetchArtifacts(): Promise<ArtifactConfig[]> {
  const res = await api.api.artifacts.$get()
  if (!res.ok) throw new Error("Failed to fetch artifacts")
  const data = (await res.json()) as ArtifactListResponse
  return data.artifacts
}

export function artifactsListQuery() {
  return queryOptions({
    queryKey: queryKeys.artifacts.list(),
    queryFn: fetchArtifacts,
    staleTime: 15_000,
  })
}

export function artifactDetailQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.artifacts.detail(id),
    queryFn: async () => {
      const artifacts = await fetchArtifacts()
      return artifacts.find((a) => a.id === id) ?? null
    },
    staleTime: 10_000,
    enabled: id.length > 0,
  })
}
