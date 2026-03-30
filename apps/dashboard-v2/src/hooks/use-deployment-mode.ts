import { useSuspenseQuery } from "@tanstack/react-query"
import { API_BASE } from "@/lib/api"

export type DeploymentMode = "selfhosted" | "cloud"

export function useDeploymentMode() {
  return useSuspenseQuery({
    queryKey: ["deployment-mode"],
    queryFn: async (): Promise<DeploymentMode> => {
      const res = await fetch(`${API_BASE}/api/settings/deployment-mode`, { credentials: "include" })
      if (!res.ok) return "selfhosted"
      const json = (await res.json()) as { mode?: string }
      return (json.mode === "cloud" ? "cloud" : "selfhosted") as DeploymentMode
    },
  })
}
