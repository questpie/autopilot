import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { FolderOpenIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { directoryQuery } from "@/features/files/files.queries"
import { DirectoryListing } from "@/features/files/directory-listing"
import { BreadcrumbNav } from "@/features/files/breadcrumb-nav"
import { FileViewer } from "@/features/files/file-viewer"
import { EmptyState } from "@/components/feedback/empty-state"

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

  // Returns FsEntry[] for directories, null for files
  const { data: dirEntries } = useSuspenseQuery(directoryQuery(filePath))

  const isDirectory = dirEntries != null
  const isFile = dirEntries == null

  return (
    <div className="flex flex-col">
      <BreadcrumbNav path={filePath} />

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
