import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { FolderOpenIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { directoryQuery } from "@/features/files/files.queries"
import { DirectoryListing } from "@/features/files/directory-listing"
import { BreadcrumbNav } from "@/features/files/breadcrumb-nav"
import { FileViewer } from "@/features/files/file-viewer"
import { EmptyState } from "@/components/feedback/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_app/files/$")({
  component: FilesCatchAll,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(directoryQuery(params._splat ?? ""))
  },
})

/**
 * Catch-all route for /files/* — renders directory listing or file viewer
 * based on whether the path is a directory or file.
 */
function FilesCatchAll() {
  const { t } = useTranslation()
  const { _splat: splatPath } = Route.useParams()
  const filePath = splatPath ?? ""

  // Try loading as directory first
  const {
    data: dirEntries,
    isLoading: dirLoading,
    error: dirError,
  } = useQuery(directoryQuery(filePath))

  // If we got a directory listing (array), show directory
  // If we got an error or non-array response, treat as file
  const isDirectory =
    !dirLoading && !dirError && Array.isArray(dirEntries)
  const isFile = !dirLoading && (dirError || !Array.isArray(dirEntries))

  return (
    <div className="flex flex-col">
      <BreadcrumbNav path={filePath} />

      {dirLoading && (
        <div className="flex flex-col gap-1 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-none" />
          ))}
        </div>
      )}

      {/* Directory view */}
      {isDirectory && dirEntries && dirEntries.length > 0 && (
        <DirectoryListing entries={dirEntries} parentPath={filePath} />
      )}

      {isDirectory && dirEntries && dirEntries.length === 0 && (
        <EmptyState
          icon={<FolderOpenIcon size={32} />}
          message={t("files.no_files")}
          description={t("files.no_files_description")}
        />
      )}

      {/* File view */}
      {isFile && <FileViewer path={filePath} />}
    </div>
  )
}
