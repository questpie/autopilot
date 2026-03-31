import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { ArtifactGallery } from "@/features/artifacts/artifact-gallery"
import { PageTransition } from "@/components/layouts/page-transition"

export const Route = createFileRoute("/_app/artifacts/")({
  component: ArtifactsPage,
})

/**
 * Artifact gallery page at /artifacts.
 * Grid/list views of all artifacts with filtering.
 */
function ArtifactsPage() {
  const { t } = useTranslation()

  return (
    <PageTransition className="flex flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="font-heading text-lg font-bold text-foreground">
          {t("artifacts.title")}
        </h1>
      </div>
      <ArtifactGallery />
    </PageTransition>
  )
}
