import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"

interface StartArtifactResult {
  id: string
  port: number
  url: string
}

async function startArtifact(id: string): Promise<StartArtifactResult> {
  const res = await api.api.artifacts[":id"].start.$post({ param: { id } })
  if (!res.ok) {
    const data = (await res.json()) as { error?: string }
    throw new Error(data.error ?? "Failed to start artifact")
  }
  return res.json() as Promise<StartArtifactResult>
}

async function stopArtifact(id: string): Promise<void> {
  const res = await api.api.artifacts[":id"].stop.$post({ param: { id } })
  if (!res.ok) {
    const data = (await res.json()) as { error?: string }
    throw new Error(data.error ?? "Failed to stop artifact")
  }
}

export function useStartArtifact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startArtifact,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.root })
    },
  })
}

export function useStopArtifact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: stopArtifact,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.artifacts.root })
    },
  })
}
