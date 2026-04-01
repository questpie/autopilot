import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/_app/observability/")({
  component: ObservabilityIndex,
})

function ObservabilityIndex() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: "/observability/activity", replace: true })
  }, [navigate])

  return null
}
