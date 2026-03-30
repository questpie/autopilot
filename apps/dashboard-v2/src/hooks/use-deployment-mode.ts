import { useSuspenseQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export type DeploymentMode = "selfhosted" | "cloud"

export function useDeploymentMode() {
  return useSuspenseQuery({
    queryKey: ["deployment-mode"],
    queryFn: async (): Promise<DeploymentMode> => {
      const res = await api.api.settings["deployment-mode"].$get()
      const json = await res.json()
      return ("mode" in json ? json.mode : "selfhosted") as DeploymentMode
    },
  })
}
