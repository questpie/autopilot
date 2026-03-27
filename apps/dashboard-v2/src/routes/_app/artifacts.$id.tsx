import { createFileRoute } from "@tanstack/react-router"
import { ArtifactViewer } from "@/features/artifacts/artifact-viewer"

export const Route = createFileRoute("/_app/artifacts/$id")({
  component: ArtifactViewerPage,
})

/**
 * Artifact viewer page at /artifacts/:id.
 * Full-page iframe sandbox with toolbar.
 */
function ArtifactViewerPage() {
  const { id } = Route.useParams()
  return <ArtifactViewer artifactId={id} />
}
